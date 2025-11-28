/**
 * Appointment Routes
 * 
 * Handles property viewing appointment/booking management.
 * 
 * Endpoints:
 * - GET /api/appointments - List appointments (filtered by role)
 * - GET /api/appointments/:id - Get single appointment
 * - POST /api/appointments - Create new appointment (customer)
 * - PUT /api/appointments/:id - Update appointment (status change, notes)
 * - DELETE /api/appointments/:id - Cancel appointment
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, requireRole, requireVerified } = require('../middleware/auth');

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
        
        // Check for duplicate booking
        const existingBookings = await db.query(`
            SELECT * FROM appointments 
            WHERE property_id = ? AND customer_id = ? AND status IN ('pending', 'confirmed')
        `, [propertyId, user.id]);
        
        if (existingBookings.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'You already have a pending or confirmed appointment for this property.'
            });
        }
        
        // Create appointment
        const result = await db.query(`
            INSERT INTO appointments (property_id, customer_id, agent_id, appointment_date, appointment_time, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')
        `, [propertyId, user.id, property.assigned_agent_id, appointmentDate, appointmentTime, notes || null]);
        
        // Create notification for the agent
        if (property.assigned_agent_id) {
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
            message: 'Appointment request submitted successfully.',
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
 * - Customer: can cancel or reschedule their pending appointments
 * - Agent: can confirm, complete, or cancel assigned appointments
 * - Admin: full control
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
            // Customers can only cancel or reschedule pending appointments
            if (appointment.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: 'Can only modify pending appointments.'
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
        
        // Update appointment
        await db.query(`
            UPDATE appointments SET
                status = ?,
                appointment_date = ?,
                appointment_time = ?,
                notes = ?
            WHERE id = ?
        `, [
            status || appointment.status,
            appointmentDate || appointment.appointment_date,
            appointmentTime || appointment.appointment_time,
            notes !== undefined ? notes : appointment.notes,
            id
        ]);
        
        // Create notifications for status changes
        if (status && status !== appointment.status) {
            // Notify customer of status change
            await db.query(`
                INSERT INTO notifications (user_id, type, title, message)
                VALUES (?, 'appointment', 'Appointment Update', ?)
            `, [
                appointment.customer_id,
                `Your appointment for ${appointment.property_title} has been ${status}.`
            ]);
            
            // Notify agent of cancellation
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
            appointment: updatedAppointments[0]
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
