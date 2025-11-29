/**
 * Notification Routes
 * 
 * @file notifications.js
 * @description Handles in-app user notifications.
 *              Notifications are stored in the database and displayed in the user's portal.
 * 
 * @module routes/notifications
 * 
 * ## Feature Overview
 * 
 * The notification system provides:
 * - In-app messaging for important events
 * - Read/unread status tracking
 * - Type categorization (appointment, property, verification, system)
 * 
 * ## Notification Types
 * 
 * | Type | Description | Recipients |
 * |------|-------------|------------|
 * | appointment | Booking confirmations, cancellations, promotions | Customer, Agent |
 * | property | Rating notifications, property updates | Agent |
 * | verification | Phone verification status | Customer |
 * | system | System announcements | All users |
 * 
 * ## Usage in Other Routes
 * 
 * Notifications are created by other modules when events occur:
 * 
 * @example Creating a notification in appointments.js:
 * await db.query(`
 *     INSERT INTO notifications (user_id, type, title, message)
 *     VALUES (?, 'appointment', 'Booking Confirmed!', ?)
 * `, [customerId, 'Your appointment has been confirmed!']);
 * 
 * ## Endpoints
 * 
 * - GET /api/notifications - List user's notifications
 * - PUT /api/notifications/:id/read - Mark notification as read
 * - PUT /api/notifications/read-all - Mark all notifications as read
 * 
 * @see backend/utils/auditLogger.js for audit logging (separate from user notifications)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/notifications
 * List user's notifications
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const { unreadOnly, page = 1, limit = 20 } = req.query;
        const user = req.user;
        
        let sql = `
            SELECT * FROM notifications
            WHERE user_id = ?
        `;
        const params = [user.id];
        
        if (unreadOnly === 'true') {
            sql += ' AND is_read = FALSE';
        }
        
        sql += ' ORDER BY created_at DESC';
        
        const offset = (parseInt(page) - 1) * parseInt(limit);
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);
        
        const notifications = await db.query(sql, params);
        
        // Get unread count
        const unreadCount = await db.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
            [user.id]
        );
        
        res.json({
            success: true,
            notifications,
            unreadCount: unreadCount[0].count
        });
        
    } catch (error) {
        console.error('List notifications error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch notifications.'
        });
    }
});

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
router.put('/:id/read', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        
        // Check if notification exists and belongs to user
        const notifications = await db.query(
            'SELECT * FROM notifications WHERE id = ? AND user_id = ?',
            [id, user.id]
        );
        
        if (notifications.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Notification not found.'
            });
        }
        
        // Mark as read
        await db.query(
            'UPDATE notifications SET is_read = TRUE WHERE id = ?',
            [id]
        );
        
        res.json({
            success: true,
            message: 'Notification marked as read.'
        });
        
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update notification.'
        });
    }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', authenticate, async (req, res) => {
    try {
        const user = req.user;
        
        await db.query(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
            [user.id]
        );
        
        res.json({
            success: true,
            message: 'All notifications marked as read.'
        });
        
    } catch (error) {
        console.error('Mark all notifications read error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update notifications.'
        });
    }
});

module.exports = router;
