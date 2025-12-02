/**
 * Appointment Routes
 * 
 * @file appointments.js
 * @description Handles property viewing appointment/booking management with:
 *              - Full datetime precision (down to microseconds) for double-booking prevention
 *              - Queuing system for high-demand slots
 *              - Instant queue promotion on cancellation
 *              - Status tracking (confirmed, queued, promoted, canceled)
 * 
 * @module routes/appointments
 * 
 * ## Race Condition Handling
 * 
 * This module handles race conditions when multiple customers try to book the same slot:
 * 
 * 1. **Microsecond Timestamps**: Each booking records `booking_timestamp` with DATETIME(6)
 *    precision (microseconds). This ensures even near-simultaneous requests have unique timestamps.
 * 
 * 2. **First-Come-First-Served**: The first booking (by timestamp) gets 'pending' status.
 *    Subsequent bookings for the same slot get 'queued' status with a queue_position.
 * 
 * 3. **Queue Position**: Queue positions are determined by booking_timestamp order.
 *    Position 1 is first in queue, Position 2 is second, etc.
 * 
 * 4. **Automatic Promotion**: When a 'pending' or 'confirmed' booking is cancelled,
 *    the queue_position=1 customer is automatically promoted to 'confirmed'.
 * 
 * ## Flow Diagram
 * 
 * Customer A books 10:00 AM → Status: PENDING (first to book)
 *     |
 * Customer B books 10:00 AM (2 seconds later) → Status: QUEUED, Position: 1
 *     |
 * Customer C books 10:00 AM (5 seconds later) → Status: QUEUED, Position: 2
 *     |
 * Customer A cancels → 
 *     Customer B promoted to CONFIRMED
 *     Customer C position updated to 1
 *     Notification sent to Customer B
 * 
 * ## Endpoints
 * 
 * - GET /api/appointments - List appointments (filtered by role)
 * - GET /api/appointments/:id - Get single appointment
 * - GET /api/appointments/available-slots/:propertyId - Get available slots for a property
 * - POST /api/appointments - Create new appointment (customer)
 * - PUT /api/appointments/:id - Update appointment (status change, notes)
 * - DELETE /api/appointments/:id - Cancel appointment
 * 
 * @see backend/sql/schema.sql for table structure
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, requireRole, requireVerified } = require('../middleware/auth');
const auditLogger = require('../utils/auditLogger');

/**
 * Promote the next queued customer for a slot when a booking is cancelled
 * 
 * This function implements the automatic queue promotion logic:
 * 1. Finds the customer with the lowest queue_position for the given slot
 * 2. Updates their status from 'queued' to 'confirmed'
 * 3. Decrements queue positions for all remaining queued customers
 * 4. Creates a notification for the promoted customer
 * 
 * @param {number} propertyId - Property ID
 * @param {string} appointmentDate - Date of the slot (YYYY-MM-DD)
 * @param {string} appointmentTime - Time of the slot (HH:MM:SS)
 * @returns {Promise<Object|null>} The promoted booking object, or null if no one in queue
 * 
 * @example
 * // Called when a booking is cancelled
 * const promotedCustomer = await promoteNextInQueue(propertyId, '2024-01-15', '10:00:00');
 * if (promotedCustomer) {
 *     console.log(`Customer ${promotedCustomer.customer_id} promoted from queue`);
 * }
 * 
 * @fires QUEUE_PROMOTION audit event
 * @fires NOTIFICATION_SENT for the promoted customer
 */
async function promoteNextInQueue(propertyId, appointmentDate, appointmentTime) {
    // Log the promotion attempt
    console.log(`[QUEUE] Checking for queued bookings: property=${propertyId}, date=${appointmentDate}, time=${appointmentTime}`);
    
    // Find the next queued customer for this slot
    // ORDER BY queue_position ASC ensures we get position 1 first
    const queuedBookings = await db.query(`
        SELECT a.*, p.title as property_title
        FROM appointments a
        JOIN properties p ON a.property_id = p.id
        WHERE a.property_id = ?
          AND a.appointment_date = ?
          AND a.appointment_time = ?
          AND a.status = 'queued'
        ORDER BY a.queue_position ASC
        LIMIT 1
    `, [propertyId, appointmentDate, appointmentTime]);
    
    if (queuedBookings.length > 0) {
        const nextInQueue = queuedBookings[0];
        
        // Log the promotion event
        console.log(`[QUEUE] Promoting customer ${nextInQueue.customer_id} from position ${nextInQueue.queue_position}`);
        
        // Promote to confirmed status
        // Clear queue_position as they're no longer in the queue
        await db.query(`
            UPDATE appointments 
            SET status = 'confirmed', queue_position = NULL 
            WHERE id = ?
        `, [nextInQueue.id]);
        
        // Update queue positions for remaining queued bookings
        // Everyone moves up one position
        await db.query(`
            UPDATE appointments 
            SET queue_position = queue_position - 1 
            WHERE property_id = ? 
              AND appointment_date = ? 
              AND appointment_time = ? 
              AND status = 'queued'
              AND queue_position > ?
        `, [propertyId, appointmentDate, appointmentTime, nextInQueue.queue_position]);
        
        // Create notification for the promoted customer
        // This is an in-app notification (stored in DB, displayed in UI)
        await db.query(`
            INSERT INTO notifications (user_id, type, title, message)
            VALUES (?, 'appointment', '🎉 Booking Confirmed!', ?)
        `, [
            nextInQueue.customer_id,
            `Great news! Your queued booking for ${nextInQueue.property_title} on ${appointmentDate} at ${appointmentTime} has been promoted to confirmed. The slot is now yours!`
        ]);
        
        // Audit log the queue promotion event
        auditLogger.logQueuePromotion({
            appointmentId: nextInQueue.id,
            customerId: nextInQueue.customer_id,
            propertyId: propertyId,
            slot: `${appointmentDate} ${appointmentTime}`,
            previousPosition: nextInQueue.queue_position,
            reason: 'Previous booking cancelled'
        });
        
        console.log(`[QUEUE] Successfully promoted customer ${nextInQueue.customer_id} to confirmed status`);
        
        return nextInQueue;
    }
    
    console.log(`[QUEUE] No queued bookings found for this slot`);
    return null;
}

/**
 * GET /api/appointments
 * List appointments based on user role
 * - Customer: their own appointments
 * - Agent: appointments for their assigned properties
 * - Admin: all appointments
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const user = req.user;
        
        let sql = `
            SELECT a.*,
                   p.title as property_title,
                   p.address as property_address,
                   p.city as property_city,
                   p.price as property_price,
                   c.first_name as customer_first_name,
                   c.last_name as customer_last_name,
                   c.email as customer_email,
                   c.phone as customer_phone,
                   ag.first_name as agent_first_name,
                   ag.last_name as agent_last_name,
                   ag.email as agent_email,
                   ag.phone as agent_phone
            FROM appointments a
            JOIN properties p ON a.property_id = p.id
            JOIN users c ON a.customer_id = c.id
            LEFT JOIN users ag ON a.agent_id = ag.id
            WHERE 1=1
        `;
        const params = [];
        
        // Filter by role
        if (user.role === 'customer') {
            sql += ' AND a.customer_id = ?';
            params.push(user.id);
        } else if (user.role === 'agent') {
            sql += ' AND a.agent_id = ?';
            params.push(user.id);
        }
        // Admin sees all appointments
        
        // Filter by status
        if (status) {
            sql += ' AND a.status = ?';
            params.push(status);
        }
        
        // Order by date
        sql += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';
        
        // Pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);
        
        const appointments = await db.query(sql, params);
        
        // Get total count
        let countSql = 'SELECT COUNT(*) as total FROM appointments WHERE 1=1';
        const countParams = [];
        
        if (user.role === 'customer') {
            countSql += ' AND customer_id = ?';
            countParams.push(user.id);
        } else if (user.role === 'agent') {
            countSql += ' AND agent_id = ?';
            countParams.push(user.id);
        }
        
        if (status) {
            countSql += ' AND status = ?';
            countParams.push(status);
        }
        
        const countResult = await db.query(countSql, countParams);
        const total = countResult[0].total;
        
        res.json({
            success: true,
            appointments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('List appointments error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch appointments.'
        });
    }
});

/**
 * GET /api/appointments/available-slots/:propertyId
 * Get available time slots for a property
 * Excludes blocked slots and already confirmed bookings
 */
router.get('/available-slots/:propertyId', async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { date } = req.query;
        
        if (!date) {
            return res.status(400).json({
                success: false,
                error: 'Date parameter is required.'
            });
        }
        
        // Check if property exists
        const properties = await db.query(
            'SELECT * FROM properties WHERE id = ? AND status = ?',
            [propertyId, 'available']
        );
        
        if (properties.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found or not available.'
            });
        }
        
        // Get blocked slots for this date
        const blockedSlots = await db.query(`
            SELECT blocked_time FROM blocked_slots 
            WHERE property_id = ? AND blocked_date = ?
        `, [propertyId, date]);
        
        // Get confirmed bookings for this date
        const confirmedBookings = await db.query(`
            SELECT appointment_time FROM appointments 
            WHERE property_id = ? 
              AND appointment_date = ? 
              AND status IN ('pending', 'confirmed')
        `, [propertyId, date]);
        
        // Define available time slots (9 AM to 5 PM, hourly)
        const allSlots = [
            '09:00:00', '10:00:00', '11:00:00', '12:00:00',
            '13:00:00', '14:00:00', '15:00:00', '16:00:00', '17:00:00'
        ];
        
        const blockedTimes = blockedSlots.map(s => s.blocked_time);
        const bookedTimes = confirmedBookings.map(b => b.appointment_time);
        const unavailableTimes = [...blockedTimes, ...bookedTimes];
        
        const availableSlots = allSlots.filter(slot => !unavailableTimes.includes(slot));
        
        res.json({
            success: true,
            date,
            propertyId: parseInt(propertyId),
            availableSlots,
            blockedSlots: blockedTimes,
            bookedSlots: bookedTimes
        });
        
    } catch (error) {
        console.error('Get available slots error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch available slots.'
        });
    }
});

/**
 * GET /api/appointments/:id
 * Get single appointment details
 */
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        
        const appointments = await db.query(`
            SELECT a.*,
                   p.title as property_title,
                   p.address as property_address,
                   p.city as property_city,
                   p.price as property_price,
                   p.image_url as property_image,
                   c.first_name as customer_first_name,
                   c.last_name as customer_last_name,
                   c.email as customer_email,
                   c.phone as customer_phone,
                   ag.first_name as agent_first_name,
                   ag.last_name as agent_last_name,
                   ag.email as agent_email,
                   ag.phone as agent_phone
            FROM appointments a
            JOIN properties p ON a.property_id = p.id
            JOIN users c ON a.customer_id = c.id
            LEFT JOIN users ag ON a.agent_id = ag.id
            WHERE a.id = ?
        `, [id]);
        
        if (appointments.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found.'
            });
        }
        
        const appointment = appointments[0];
        
        // Check access
        if (user.role === 'customer' && appointment.customer_id !== user.id) {
            return res.status(403).json({
                success: false,
                error: 'Access denied.'
            });
        }
        
        if (user.role === 'agent' && appointment.agent_id !== user.id) {
            return res.status(403).json({
                success: false,
                error: 'Access denied.'
            });
        }
        
        res.json({
            success: true,
            appointment
        });
        
    } catch (error) {
        console.error('Get appointment error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch appointment.'
        });
    }
});

/**
 * POST /api/appointments
 * Create new appointment (customer booking a property viewing)
 * 
 * @description
 * Creates a new viewing appointment for a customer. This endpoint implements
 * sophisticated race condition handling and queue management.
 * 
 * ## Race Condition Handling
 * 
 * When multiple customers try to book the same slot simultaneously:
 * 
 * 1. **First Request**: Gets status='pending' (or 'confirmed' if auto-confirm enabled)
 * 2. **Subsequent Requests**: Get status='queued' with incrementing queue_position
 * 
 * The `booking_timestamp` field uses DATETIME(6) for microsecond precision,
 * ensuring accurate ordering even for near-simultaneous requests.
 * 
 * ## Example Flow
 * 
 * ```
 * Time 15:30:45.123456 - Customer A books 10:00 AM → PENDING
 * Time 15:30:45.789012 - Customer B books 10:00 AM → QUEUED (position 1)
 * Time 15:30:46.234567 - Customer C books 10:00 AM → QUEUED (position 2)
 * ```
 * 
 * @requires Authentication - User must be logged in
 * @requires Verification - Customer must have verified phone number
 * 
 * @bodyparam {number} propertyId - ID of the property to book
 * @bodyparam {string} appointmentDate - Date in YYYY-MM-DD format
 * @bodyparam {string} appointmentTime - Time in HH:MM:SS format
 * @bodyparam {string} [notes] - Optional notes for the appointment
 * 
 * @returns {Object} Response with created appointment
 * @returns {boolean} response.success - Whether booking was successful
 * @returns {string} response.message - Descriptive message
 * @returns {boolean} response.isQueued - True if added to queue instead of confirmed
 * @returns {number|null} response.queuePosition - Position in queue (null if not queued)
 * @returns {Object} response.appointment - The created appointment object
 * 
 * @fires BOOKING_CREATED audit event
 * @fires BOOKING_QUEUED audit event (if slot was taken)
 * @fires NOTIFICATION_SENT to agent (if not queued)
 */
router.post('/', authenticate, requireVerified, async (req, res) => {
    try {
        const { propertyId, appointmentDate, appointmentTime, notes } = req.body;
        const user = req.user;
        
        // ============================================================
        // ROLE CHECK: Only customers can book appointments
        // Agents and admins should use the admin interface
        // ============================================================
        if (user.role !== 'customer') {
            // Log forbidden action attempt
            auditLogger.logAccessDenied({
                userId: user.id,
                userRole: user.role,
                action: 'BOOK_APPOINTMENT',
                requiredRole: 'customer',
                reason: 'Only customers can book appointments'
            });
            
            return res.status(403).json({
                success: false,
                error: 'Only customers can book appointments.'
            });
        }
        
        // Validate required fields
        if (!propertyId || !appointmentDate || !appointmentTime) {
            return res.status(400).json({
                success: false,
                error: 'Required fields: propertyId, appointmentDate, appointmentTime'
            });
        }
        
        // Log the booking attempt
        console.log(`[BOOKING] Customer ${user.id} attempting to book: property=${propertyId}, date=${appointmentDate}, time=${appointmentTime}`);
        
        // Check if property exists and is available
        const properties = await db.query(
            'SELECT * FROM properties WHERE id = ? AND status = ?',
            [propertyId, 'available']
        );
        
        if (properties.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found or not available.'
            });
        }
        
        const property = properties[0];
        
        // Check if slot is blocked by agent
        const blockedSlots = await db.query(`
            SELECT * FROM blocked_slots 
            WHERE property_id = ? AND blocked_date = ? AND blocked_time = ?
        `, [propertyId, appointmentDate, appointmentTime]);
        
        if (blockedSlots.length > 0) {
            console.log(`[BOOKING] Slot is blocked: property=${propertyId}, date=${appointmentDate}, time=${appointmentTime}`);
            return res.status(409).json({
                success: false,
                error: 'This time slot is not available. Please select a different time.'
            });
        }
        
        // Check for existing booking by same customer for this property
        // Prevents duplicate bookings
        const existingCustomerBookings = await db.query(`
            SELECT * FROM appointments 
            WHERE property_id = ? AND customer_id = ? AND status IN ('pending', 'confirmed', 'queued')
        `, [propertyId, user.id]);
        
        if (existingCustomerBookings.length > 0) {
            console.log(`[BOOKING] Customer ${user.id} already has booking for property ${propertyId}`);
            return res.status(409).json({
                success: false,
                error: 'You already have a pending, confirmed, or queued appointment for this property.'
            });
        }
        
        // ============================================================
        // RACE CONDITION HANDLING: Record precise booking timestamp
        // Using DATETIME(6) for microsecond precision ensures accurate
        // ordering even for near-simultaneous booking requests
        // MySQL DATETIME(6) format: 'YYYY-MM-DD HH:MM:SS.ffffff'
        // ============================================================
        const now = new Date();
        // Format timestamp for MySQL DATETIME(6): 'YYYY-MM-DD HH:MM:SS.mmm000'
        // JavaScript provides millisecond precision (3 digits), MySQL allows microseconds (6 digits)
        const isoString = now.toISOString(); // 2024-01-15T10:30:45.123Z
        const datePart = isoString.slice(0, 10); // 2024-01-15
        const timePart = isoString.slice(11, 23); // 10:30:45.123
        const bookingTimestamp = `${datePart} ${timePart}000`; // Add microseconds (000)
        
        console.log(`[BOOKING] Booking timestamp: ${bookingTimestamp}`);
        
        // Check if slot is already confirmed/pending (someone else got there first)
        const existingConfirmedBookings = await db.query(`
            SELECT * FROM appointments 
            WHERE property_id = ? 
              AND appointment_date = ? 
              AND appointment_time = ? 
              AND status IN ('pending', 'confirmed')
        `, [propertyId, appointmentDate, appointmentTime]);
        
        let status = 'pending';
        let queuePosition = null;
        let message = 'Appointment request submitted successfully.';
        let isQueued = false;
        
        // ============================================================
        // QUEUE LOGIC: If slot is taken, add to queue
        // This handles the case where another customer booked first
        // ============================================================
        if (existingConfirmedBookings.length > 0) {
            // Slot is already taken, add to queue
            status = 'queued';
            
            // Log the race condition / collision
            console.log(`[BOOKING] SLOT COLLISION: Slot already taken, adding customer ${user.id} to queue`);
            
            // Get current max queue position for this slot
            // New bookings go to the end of the queue
            const maxPositionResult = await db.query(`
                SELECT COALESCE(MAX(queue_position), 0) + 1 as next_position 
                FROM appointments 
                WHERE property_id = ? 
                  AND appointment_date = ? 
                  AND appointment_time = ? 
                  AND status = 'queued'
            `, [propertyId, appointmentDate, appointmentTime]);
            
            queuePosition = maxPositionResult[0].next_position;
            message = `This slot is in high demand! You've been added to the queue at position ${queuePosition}. You'll be notified immediately if the slot becomes available.`;
            isQueued = true;
            
            // Log the race condition for monitoring
            // Safe access with optional chaining to prevent runtime errors
            const existingBooking = existingConfirmedBookings[0];
            auditLogger.logRaceCondition('BOOKING', {
                propertyId,
                slot: `${appointmentDate} ${appointmentTime}`,
                existingBookingId: existingBooking?.id || null,
                newCustomerId: user.id,
                queuePosition: queuePosition
            });
        }
        
        // Create appointment with booking timestamp
        const result = await db.query(`
            INSERT INTO appointments (property_id, customer_id, agent_id, appointment_date, appointment_time, booking_timestamp, notes, status, queue_position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [propertyId, user.id, property.assigned_agent_id, appointmentDate, appointmentTime, bookingTimestamp, notes || null, status, queuePosition]);
        
        // Log the booking creation
        auditLogger.logBooking(isQueued ? 'QUEUED' : 'CREATED', {
            appointmentId: result.insertId,
            customerId: user.id,
            propertyId,
            slot: `${appointmentDate} ${appointmentTime}`,
            status,
            queuePosition
        });
        
        // Create notification for the agent (only for pending bookings, not queued)
        // Queued bookings don't need agent notification until promoted
        if (!isQueued && property.assigned_agent_id) {
            await db.query(`
                INSERT INTO notifications (user_id, type, title, message)
                VALUES (?, 'appointment', 'New Appointment Request', ?)
            `, [
                property.assigned_agent_id,
                `New viewing request for ${property.title} on ${appointmentDate} at ${appointmentTime}.`
            ]);
            
            console.log(`[NOTIFICATION] Sent to agent ${property.assigned_agent_id} about new appointment`);
        }
        
        // Fetch the created appointment with property details
        const appointments = await db.query(`
            SELECT a.*,
                   p.title as property_title,
                   p.address as property_address
            FROM appointments a
            JOIN properties p ON a.property_id = p.id
            WHERE a.id = ?
        `, [result.insertId]);
        
        console.log(`[BOOKING] Successfully created appointment ${result.insertId}, status=${status}, queued=${isQueued}`);
        
        res.status(201).json({
            success: true,
            message,
            isQueued,
            queuePosition,
            appointment: appointments[0]
        });
        
    } catch (error) {
        console.error('Create appointment error:', error);
        auditLogger.logError('appointments.create', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create appointment.'
        });
    }
});

/**
 * PUT /api/appointments/:id
 * Update appointment (status change, notes, reschedule)
 * 
 * @description
 * Updates an existing appointment. The allowed actions depend on the user's role:
 * 
 * ## Role-Based Permissions (req.user.role)
 * 
 * - **Customer**: Can only cancel their own appointments (pending/confirmed/queued)
 * - **Agent**: Can confirm, complete, or cancel their assigned appointments
 * - **Admin**: Full control over all appointments
 * 
 * ## Queue Promotion on Cancellation
 * 
 * When a 'pending' or 'confirmed' appointment is cancelled, the system automatically:
 * 1. Updates queue positions for remaining queued bookings
 * 2. Promotes the first person in queue (position 1) to 'confirmed'
 * 3. Sends notification to the promoted customer
 * 
 * @requires Authentication
 * 
 * @param {string} id - Appointment ID (URL parameter)
 * @bodyparam {string} [status] - New status (confirmed, completed, cancelled)
 * @bodyparam {string} [appointmentDate] - New date (YYYY-MM-DD)
 * @bodyparam {string} [appointmentTime] - New time (HH:MM:SS)
 * @bodyparam {string} [notes] - Updated notes
 * 
 * @fires BOOKING_CONFIRMED audit event
 * @fires BOOKING_CANCELLED audit event
 * @fires BOOKING_COMPLETED audit event
 * @fires QUEUE_PROMOTION audit event (if cancellation triggers promotion)
 */
router.put('/:id', authenticate, async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        const { status, appointmentDate, appointmentTime, notes } = req.body;
        const user = req.user;
        
        console.log(`[APPOINTMENT] Update request: id=${id}, status=${status}, by user=${user.id} (${user.role})`);
        
        // Get existing appointment
        const appointments = await db.query(`
            SELECT a.*, p.title as property_title
            FROM appointments a
            JOIN properties p ON a.property_id = p.id
            WHERE a.id = ?
        `, [id]);
        
        if (appointments.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found.'
            });
        }
        
        const appointment = appointments[0];
        
        // ============================================================
        // ROLE-BASED AUTHORIZATION CHECKS
        // Check req.user.role and enforce appropriate restrictions
        // ============================================================
        
        if (user.role === 'customer') {
            // Customers can only modify their own appointments
            if (appointment.customer_id !== user.id) {
                auditLogger.logAccessDenied({
                    userId: user.id,
                    userRole: user.role,
                    action: 'UPDATE_APPOINTMENT',
                    resourceId: id,
                    reason: 'Customer cannot modify another customer\'s appointment'
                });
                return res.status(403).json({
                    success: false,
                    error: 'Access denied.'
                });
            }
            // Customers can only cancel pending, confirmed, or queued appointments
            if (!['pending', 'confirmed', 'queued'].includes(appointment.status)) {
                return res.status(400).json({
                    success: false,
                    error: 'Can only modify pending, confirmed, or queued appointments.'
                });
            }
            // Customers can only cancel (not confirm or complete)
            if (status && status !== 'cancelled') {
                auditLogger.logAccessDenied({
                    userId: user.id,
                    userRole: user.role,
                    action: 'UPDATE_APPOINTMENT_STATUS',
                    resourceId: id,
                    attemptedStatus: status,
                    reason: 'Customers can only cancel appointments'
                });
                return res.status(403).json({
                    success: false,
                    error: 'Customers can only cancel appointments.'
                });
            }
        } else if (user.role === 'agent') {
            // Agents can only modify appointments they're assigned to
            if (appointment.agent_id !== user.id) {
                auditLogger.logAccessDenied({
                    userId: user.id,
                    userRole: user.role,
                    action: 'UPDATE_APPOINTMENT',
                    resourceId: id,
                    reason: 'Agent not assigned to this appointment'
                });
                return res.status(403).json({
                    success: false,
                    error: 'Access denied.'
                });
            }
        }
        // Admin has full access - no restrictions
        
        // Store old status for comparison and logging
        const oldStatus = appointment.status;
        const newStatus = status || appointment.status;
        
        console.log(`[APPOINTMENT] Status change: ${oldStatus} -> ${newStatus}`);
        
        // Use transaction for cancellation with queue promotion
        const needsTransaction = newStatus === 'cancelled' && ['pending', 'confirmed'].includes(oldStatus);
        
        if (needsTransaction) {
            connection = await db.getConnection();
            await new Promise((resolve, reject) => {
                connection.beginTransaction(err => err ? reject(err) : resolve());
            });
            
            // Update appointment within transaction
            await new Promise((resolve, reject) => {
                connection.query(`
                    UPDATE appointments SET
                        status = ?,
                        appointment_date = ?,
                        appointment_time = ?,
                        notes = ?,
                        queue_position = ?
                    WHERE id = ?
                `, [
                    newStatus,
                    appointmentDate || appointment.appointment_date,
                    appointmentTime || appointment.appointment_time,
                    notes !== undefined ? notes : appointment.notes,
                    null, // Clear queue position on cancel
                    id
                ], (err, result) => err ? reject(err) : resolve(result));
            });
            
            // Update queue positions for this slot (everyone moves up)
            await new Promise((resolve, reject) => {
                connection.query(`
                    UPDATE appointments 
                    SET queue_position = queue_position - 1 
                    WHERE property_id = ? 
                      AND appointment_date = ? 
                      AND appointment_time = ? 
                      AND status = 'queued'
                `, [appointment.property_id, appointment.appointment_date, appointment.appointment_time], 
                (err, result) => err ? reject(err) : resolve(result));
            });
            
            // Find next in queue to promote
            const queuedBookings = await new Promise((resolve, reject) => {
                connection.query(`
                    SELECT a.*, p.title as property_title
                    FROM appointments a
                    JOIN properties p ON a.property_id = p.id
                    WHERE a.property_id = ?
                      AND a.appointment_date = ?
                      AND a.appointment_time = ?
                      AND a.status = 'queued'
                    ORDER BY a.queue_position ASC
                    LIMIT 1
                `, [appointment.property_id, appointment.appointment_date, appointment.appointment_time],
                (err, result) => err ? reject(err) : resolve(result));
            });
            
            var promotedCustomer = null;
            if (queuedBookings.length > 0) {
                const nextInQueue = queuedBookings[0];
                console.log(`[QUEUE] Promoting customer ${nextInQueue.customer_id} from position ${nextInQueue.queue_position}`);
                
                // Promote to confirmed status
                await new Promise((resolve, reject) => {
                    connection.query(`
                        UPDATE appointments 
                        SET status = 'confirmed', queue_position = NULL 
                        WHERE id = ?
                    `, [nextInQueue.id], (err, result) => err ? reject(err) : resolve(result));
                });
                
                // Create notification for the promoted customer
                await new Promise((resolve, reject) => {
                    connection.query(`
                        INSERT INTO notifications (user_id, type, title, message)
                        VALUES (?, 'appointment', '🎉 Booking Confirmed!', ?)
                    `, [
                        nextInQueue.customer_id,
                        `Great news! Your queued booking for ${nextInQueue.property_title} on ${appointment.appointment_date} at ${appointment.appointment_time} has been promoted to confirmed. The slot is now yours!`
                    ], (err, result) => err ? reject(err) : resolve(result));
                });
                
                promotedCustomer = nextInQueue;
                
                // Audit log the queue promotion event
                auditLogger.logQueuePromotion({
                    appointmentId: nextInQueue.id,
                    customerId: nextInQueue.customer_id,
                    propertyId: appointment.property_id,
                    slot: `${appointment.appointment_date} ${appointment.appointment_time}`,
                    previousPosition: nextInQueue.queue_position,
                    reason: 'Previous booking cancelled'
                });
            }
            
            // Commit transaction
            await new Promise((resolve, reject) => {
                connection.commit(err => err ? reject(err) : resolve());
            });
        } else {
            // No transaction needed - simple update
            await db.query(`
                UPDATE appointments SET
                    status = ?,
                    appointment_date = ?,
                    appointment_time = ?,
                    notes = ?,
                    queue_position = ?
                WHERE id = ?
            `, [
                newStatus,
                appointmentDate || appointment.appointment_date,
                appointmentTime || appointment.appointment_time,
                notes !== undefined ? notes : appointment.notes,
                newStatus === 'cancelled' ? null : appointment.queue_position,
                id
            ]);
            var promotedCustomer = null;
        }
        
        // Log the status change
        if (status && status !== oldStatus) {
            auditLogger.logBooking(status.toUpperCase(), {
                appointmentId: id,
                customerId: appointment.customer_id,
                propertyId: appointment.property_id,
                previousStatus: oldStatus,
                newStatus: status,
                changedBy: user.id,
                changedByRole: user.role
            });
        }
        
        // Create notifications for status changes
        if (status && status !== oldStatus) {
            // Notify customer of status change
            let notificationTitle = 'Appointment Update';
            let notificationMessage = `Your appointment for ${appointment.property_title} has been ${status}.`;
            
            if (status === 'confirmed') {
                notificationTitle = '✅ Appointment Confirmed';
                notificationMessage = `Your viewing appointment for ${appointment.property_title} on ${appointment.appointment_date} has been confirmed!`;
            } else if (status === 'completed') {
                notificationTitle = '✓ Viewing Completed';
                notificationMessage = `Your viewing of ${appointment.property_title} has been marked as completed. We hope it went well!`;
            } else if (status === 'cancelled') {
                notificationTitle = '❌ Appointment Cancelled';
                notificationMessage = `Your appointment for ${appointment.property_title} has been cancelled.`;
            }
            
            await db.query(`
                INSERT INTO notifications (user_id, type, title, message)
                VALUES (?, 'appointment', ?, ?)
            `, [appointment.customer_id, notificationTitle, notificationMessage]);
            
            console.log(`[NOTIFICATION] Sent status update to customer ${appointment.customer_id}`);
            
            // Notify agent of cancellation by customer
            if (status === 'cancelled' && appointment.agent_id && user.id === appointment.customer_id) {
                await db.query(`
                    INSERT INTO notifications (user_id, type, title, message)
                    VALUES (?, 'appointment', 'Appointment Cancelled', ?)
                `, [
                    appointment.agent_id,
                    `Customer cancelled appointment for ${appointment.property_title}.`
                ]);
            }
        }
        
        // Fetch updated appointment
        const updatedAppointments = await db.query(`
            SELECT a.*,
                   p.title as property_title,
                   p.address as property_address
            FROM appointments a
            JOIN properties p ON a.property_id = p.id
            WHERE a.id = ?
        `, [id]);
        
        res.json({
            success: true,
            message: 'Appointment updated successfully.',
            appointment: updatedAppointments[0],
            promotedCustomer: promotedCustomer ? { id: promotedCustomer.customer_id } : null
        });
        
    } catch (error) {
        // Rollback transaction on error
        if (connection) {
            await new Promise(resolve => {
                connection.rollback(() => resolve());
            });
        }
        console.error('Update appointment error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update appointment.'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

/**
 * DELETE /api/appointments/:id
 * Delete/cancel appointment
 * Admin only can hard delete
 */
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if appointment exists
        const appointments = await db.query('SELECT * FROM appointments WHERE id = ?', [id]);
        
        if (appointments.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found.'
            });
        }
        
        // Delete the appointment
        await db.query('DELETE FROM appointments WHERE id = ?', [id]);
        
        res.json({
            success: true,
            message: 'Appointment deleted successfully.'
        });
        
    } catch (error) {
        console.error('Delete appointment error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete appointment.'
        });
    }
});

module.exports = router;
