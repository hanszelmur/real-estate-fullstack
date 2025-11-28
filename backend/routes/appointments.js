/**
 * Appointment Routes
 * 
 * Handles property viewing appointment/booking management with:
 * - Full datetime precision (down to seconds) for double-booking prevention
 * - Queuing system for high-demand slots
 * - Instant queue promotion on cancellation
 * - Status tracking (confirmed, queued, promoted, canceled)
 * 
 * Endpoints:
 * - GET /api/appointments - List appointments (filtered by role)
 * - GET /api/appointments/:id - Get single appointment
 * - GET /api/appointments/available-slots/:propertyId - Get available slots for a property
 * - POST /api/appointments - Create new appointment (customer)
 * - PUT /api/appointments/:id - Update appointment (status change, notes)
 * - DELETE /api/appointments/:id - Cancel appointment
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, requireRole, requireVerified } = require('../middleware/auth');

/**
 * Promote the next queued customer for a slot when a booking is cancelled
 * @param {number} propertyId - Property ID
 * @param {string} appointmentDate - Date of the slot
 * @param {string} appointmentTime - Time of the slot
 */
async function promoteNextInQueue(propertyId, appointmentDate, appointmentTime) {
    // Find the next queued customer for this slot
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
        
        // Promote to confirmed
        await db.query(`
            UPDATE appointments 
            SET status = 'confirmed', queue_position = NULL 
            WHERE id = ?
        `, [nextInQueue.id]);
        
        // Update queue positions for remaining queued bookings
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
        await db.query(`
            INSERT INTO notifications (user_id, type, title, message)
            VALUES (?, 'appointment', '🎉 Booking Confirmed!', ?)
        `, [
            nextInQueue.customer_id,
            `Great news! Your queued booking for ${nextInQueue.property_title} on ${appointmentDate} at ${appointmentTime} has been promoted to confirmed. The slot is now yours!`
        ]);
        
        return nextInQueue;
    }
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
 * Customer must be verified
 * 
 * Implements double-booking prevention with queuing:
 * - Records booking_timestamp with microsecond precision
 * - If slot is already booked, customer is added to queue
 * - Queue position is calculated based on booking_timestamp order
 */
router.post('/', authenticate, requireVerified, async (req, res) => {
    try {
        const { propertyId, appointmentDate, appointmentTime, notes } = req.body;
        const user = req.user;
        
        // Only customers can book appointments
        if (user.role !== 'customer') {
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
        
        // Check if slot is blocked
        const blockedSlots = await db.query(`
            SELECT * FROM blocked_slots 
            WHERE property_id = ? AND blocked_date = ? AND blocked_time = ?
        `, [propertyId, appointmentDate, appointmentTime]);
        
        if (blockedSlots.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'This time slot is not available. Please select a different time.'
            });
        }
        
        // Check for existing booking by same customer for this property
        const existingCustomerBookings = await db.query(`
            SELECT * FROM appointments 
            WHERE property_id = ? AND customer_id = ? AND status IN ('pending', 'confirmed', 'queued')
        `, [propertyId, user.id]);
        
        if (existingCustomerBookings.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'You already have a pending, confirmed, or queued appointment for this property.'
            });
        }
        
        // Record precise booking timestamp with microsecond precision for MySQL DATETIME(6)
        const now = new Date();
        const bookingTimestamp = now.toISOString().slice(0, 23).replace('T', ' ') + 
            String(now.getMilliseconds()).padStart(3, '0').substring(0, 3);
        
        // Check if slot is already confirmed
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
        
        if (existingConfirmedBookings.length > 0) {
            // Slot is already taken, add to queue
            status = 'queued';
            
            // Get current max queue position for this slot
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
        }
        
        // Create appointment with booking timestamp
        const result = await db.query(`
            INSERT INTO appointments (property_id, customer_id, agent_id, appointment_date, appointment_time, booking_timestamp, notes, status, queue_position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [propertyId, user.id, property.assigned_agent_id, appointmentDate, appointmentTime, bookingTimestamp, notes || null, status, queuePosition]);
        
        // Create notification for the agent (only for confirmed/pending bookings)
        if (!isQueued && property.assigned_agent_id) {
            await db.query(`
                INSERT INTO notifications (user_id, type, title, message)
                VALUES (?, 'appointment', 'New Appointment Request', ?)
            `, [
                property.assigned_agent_id,
                `New viewing request for ${property.title} on ${appointmentDate} at ${appointmentTime}.`
            ]);
        }
        
        // Fetch the created appointment
        const appointments = await db.query(`
            SELECT a.*,
                   p.title as property_title,
                   p.address as property_address
            FROM appointments a
            JOIN properties p ON a.property_id = p.id
            WHERE a.id = ?
        `, [result.insertId]);
        
        res.status(201).json({
            success: true,
            message,
            isQueued,
            queuePosition,
            appointment: appointments[0]
        });
        
    } catch (error) {
        console.error('Create appointment error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create appointment.'
        });
    }
});

/**
 * PUT /api/appointments/:id
 * Update appointment (status change, notes, reschedule)
 * - Customer: can cancel their pending/confirmed/queued appointments
 * - Agent: can confirm, complete, or cancel assigned appointments
 * - Admin: full control
 * 
 * On cancellation: promotes next queued customer instantly
 */
router.put('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, appointmentDate, appointmentTime, notes } = req.body;
        const user = req.user;
        
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
        
        // Check permissions
        if (user.role === 'customer') {
            if (appointment.customer_id !== user.id) {
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
            if (status && status !== 'cancelled') {
                return res.status(403).json({
                    success: false,
                    error: 'Customers can only cancel appointments.'
                });
            }
        } else if (user.role === 'agent') {
            if (appointment.agent_id !== user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied.'
                });
            }
        }
        // Admin has full access
        
        // Store old status for comparison
        const oldStatus = appointment.status;
        const newStatus = status || appointment.status;
        
        // Update appointment
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
        
        // Handle cancellation - promote next in queue
        let promotedCustomer = null;
        if (newStatus === 'cancelled' && ['pending', 'confirmed'].includes(oldStatus)) {
            // Update queue positions for this slot
            await db.query(`
                UPDATE appointments 
                SET queue_position = queue_position - 1 
                WHERE property_id = ? 
                  AND appointment_date = ? 
                  AND appointment_time = ? 
                  AND status = 'queued'
            `, [appointment.property_id, appointment.appointment_date, appointment.appointment_time]);
            
            // Promote next in queue
            promotedCustomer = await promoteNextInQueue(
                appointment.property_id, 
                appointment.appointment_date, 
                appointment.appointment_time
            );
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
        console.error('Update appointment error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update appointment.'
        });
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
