/**
 * Messages Routes
 * 
 * @file messages.js
 * @description Handles two-way messaging between users (customers, agents, admins).
 *              Supports inbox, sent messages, sending, and replying.
 * 
 * @module routes/messages
 * 
 * ## Endpoints
 * 
 * - GET /api/messages/inbox - Get received messages
 * - GET /api/messages/sent - Get sent messages
 * - GET /api/messages/:id - Get single message with thread
 * - POST /api/messages - Send a new message
 * - POST /api/messages/:id/reply - Reply to a message
 * - PUT /api/messages/:id/read - Mark message as read
 * - DELETE /api/messages/:id - Delete a message
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/messages/inbox
 * Get all messages received by the current user
 * 
 * @queryparam {boolean} unread - Filter by unread only
 * @queryparam {number} page - Page number (default: 1)
 * @queryparam {number} limit - Results per page (default: 20)
 */
router.get('/inbox', authenticate, async (req, res) => {
    try {
        const { unread, page = 1, limit = 20 } = req.query;
        const userId = req.user.id;
        
        let sql = `
            SELECT m.*,
                   s.first_name as sender_first_name,
                   s.last_name as sender_last_name,
                   s.email as sender_email,
                   s.role as sender_role
            FROM messages m
            JOIN users s ON m.sender_id = s.id
            WHERE m.recipient_id = ?
        `;
        const params = [userId];
        
        if (unread === 'true') {
            sql += ' AND m.is_read = FALSE';
        }
        
        sql += ' ORDER BY m.created_at DESC';
        
        const offset = (parseInt(page) - 1) * parseInt(limit);
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);
        
        const messages = await db.query(sql, params);
        
        // Get total count
        let countSql = 'SELECT COUNT(*) as total FROM messages WHERE recipient_id = ?';
        const countParams = [userId];
        if (unread === 'true') {
            countSql += ' AND is_read = FALSE';
        }
        const countResult = await db.query(countSql, countParams);
        const total = countResult[0].total;
        
        // Get unread count
        const unreadResult = await db.query(
            'SELECT COUNT(*) as unread FROM messages WHERE recipient_id = ? AND is_read = FALSE',
            [userId]
        );
        
        res.json({
            success: true,
            messages,
            unreadCount: unreadResult[0].unread,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('Get inbox error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch inbox.'
        });
    }
});

/**
 * GET /api/messages/sent
 * Get all messages sent by the current user
 * 
 * @queryparam {number} page - Page number (default: 1)
 * @queryparam {number} limit - Results per page (default: 20)
 */
router.get('/sent', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const userId = req.user.id;
        
        const sql = `
            SELECT m.*,
                   r.first_name as recipient_first_name,
                   r.last_name as recipient_last_name,
                   r.email as recipient_email,
                   r.role as recipient_role
            FROM messages m
            JOIN users r ON m.recipient_id = r.id
            WHERE m.sender_id = ?
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?
        `;
        
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const messages = await db.query(sql, [userId, parseInt(limit), offset]);
        
        // Get total count
        const countResult = await db.query(
            'SELECT COUNT(*) as total FROM messages WHERE sender_id = ?',
            [userId]
        );
        const total = countResult[0].total;
        
        res.json({
            success: true,
            messages,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('Get sent messages error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sent messages.'
        });
    }
});

/**
 * GET /api/messages/:id
 * Get a single message with its thread (parent and replies)
 */
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        // Get the message
        const messages = await db.query(`
            SELECT m.*,
                   s.first_name as sender_first_name,
                   s.last_name as sender_last_name,
                   s.email as sender_email,
                   s.role as sender_role,
                   r.first_name as recipient_first_name,
                   r.last_name as recipient_last_name,
                   r.email as recipient_email,
                   r.role as recipient_role
            FROM messages m
            JOIN users s ON m.sender_id = s.id
            JOIN users r ON m.recipient_id = r.id
            WHERE m.id = ?
        `, [id]);
        
        if (messages.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Message not found.'
            });
        }
        
        const message = messages[0];
        
        // Check access - user must be sender or recipient
        if (message.sender_id !== userId && message.recipient_id !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied.'
            });
        }
        
        // Mark as read if recipient is viewing
        if (message.recipient_id === userId && !message.is_read) {
            await db.query('UPDATE messages SET is_read = TRUE WHERE id = ?', [id]);
            message.is_read = true;
        }
        
        // Get thread (parent message if this is a reply)
        let parent = null;
        if (message.parent_id) {
            const parentMessages = await db.query(`
                SELECT m.*,
                       s.first_name as sender_first_name,
                       s.last_name as sender_last_name
                FROM messages m
                JOIN users s ON m.sender_id = s.id
                WHERE m.id = ?
            `, [message.parent_id]);
            if (parentMessages.length > 0) {
                parent = parentMessages[0];
            }
        }
        
        // Get replies to this message
        const replies = await db.query(`
            SELECT m.*,
                   s.first_name as sender_first_name,
                   s.last_name as sender_last_name
            FROM messages m
            JOIN users s ON m.sender_id = s.id
            WHERE m.parent_id = ?
            ORDER BY m.created_at ASC
        `, [id]);
        
        res.json({
            success: true,
            message,
            parent,
            replies
        });
        
    } catch (error) {
        console.error('Get message error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch message.'
        });
    }
});

/**
 * POST /api/messages
 * Send a new message
 * 
 * @bodyparam {number} recipientId - User ID of the recipient
 * @bodyparam {string} subject - Message subject
 * @bodyparam {string} body - Message body
 */
router.post('/', authenticate, async (req, res) => {
    try {
        const { recipientId, subject, body } = req.body;
        const senderId = req.user.id;
        
        // Validate required fields
        if (!recipientId || !subject || !body) {
            return res.status(400).json({
                success: false,
                error: 'Required fields: recipientId, subject, body'
            });
        }
        
        // Prevent sending to self
        if (parseInt(recipientId) === senderId) {
            return res.status(400).json({
                success: false,
                error: 'Cannot send a message to yourself.'
            });
        }
        
        // Verify recipient exists
        const recipients = await db.query('SELECT id, first_name, last_name FROM users WHERE id = ?', [recipientId]);
        if (recipients.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Recipient not found.'
            });
        }
        
        // Create message
        const result = await db.query(`
            INSERT INTO messages (sender_id, recipient_id, subject, body)
            VALUES (?, ?, ?, ?)
        `, [senderId, recipientId, subject, body]);
        
        // Create notification for recipient
        await db.query(`
            INSERT INTO notifications (user_id, type, title, message)
            VALUES (?, 'system', 'New Message', ?)
        `, [recipientId, `You have a new message from ${req.user.first_name} ${req.user.last_name}: "${subject}"`]);
        
        // Fetch created message
        const messages = await db.query(`
            SELECT m.*,
                   r.first_name as recipient_first_name,
                   r.last_name as recipient_last_name
            FROM messages m
            JOIN users r ON m.recipient_id = r.id
            WHERE m.id = ?
        `, [result.insertId]);
        
        console.log(`[MESSAGE] User ${senderId} sent message to user ${recipientId}: "${subject}"`);
        
        res.status(201).json({
            success: true,
            message: 'Message sent successfully.',
            data: messages[0]
        });
        
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send message.'
        });
    }
});

/**
 * POST /api/messages/:id/reply
 * Reply to a message
 * 
 * @param {number} id - Parent message ID
 * @bodyparam {string} body - Reply body
 */
router.post('/:id/reply', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { body } = req.body;
        const senderId = req.user.id;
        
        if (!body) {
            return res.status(400).json({
                success: false,
                error: 'Reply body is required.'
            });
        }
        
        // Get parent message
        const parentMessages = await db.query('SELECT * FROM messages WHERE id = ?', [id]);
        
        if (parentMessages.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Message not found.'
            });
        }
        
        const parentMessage = parentMessages[0];
        
        // User must be sender or recipient of parent message
        if (parentMessage.sender_id !== senderId && parentMessage.recipient_id !== senderId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied.'
            });
        }
        
        // Determine recipient (the other person in the conversation)
        const recipientId = parentMessage.sender_id === senderId 
            ? parentMessage.recipient_id 
            : parentMessage.sender_id;
        
        // Create reply with subject prepended with "Re: "
        const subject = parentMessage.subject.startsWith('Re: ') 
            ? parentMessage.subject 
            : `Re: ${parentMessage.subject}`;
        
        const result = await db.query(`
            INSERT INTO messages (sender_id, recipient_id, parent_id, subject, body)
            VALUES (?, ?, ?, ?, ?)
        `, [senderId, recipientId, id, subject, body]);
        
        // Create notification for recipient
        await db.query(`
            INSERT INTO notifications (user_id, type, title, message)
            VALUES (?, 'system', 'New Reply', ?)
        `, [recipientId, `${req.user.first_name} ${req.user.last_name} replied to: "${parentMessage.subject}"`]);
        
        // Fetch created reply
        const replies = await db.query(`
            SELECT m.*,
                   r.first_name as recipient_first_name,
                   r.last_name as recipient_last_name
            FROM messages m
            JOIN users r ON m.recipient_id = r.id
            WHERE m.id = ?
        `, [result.insertId]);
        
        console.log(`[MESSAGE] User ${senderId} replied to message ${id}`);
        
        res.status(201).json({
            success: true,
            message: 'Reply sent successfully.',
            data: replies[0]
        });
        
    } catch (error) {
        console.error('Reply to message error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send reply.'
        });
    }
});

/**
 * PUT /api/messages/:id/read
 * Mark a message as read
 */
router.put('/:id/read', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        // Get message
        const messages = await db.query('SELECT * FROM messages WHERE id = ?', [id]);
        
        if (messages.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Message not found.'
            });
        }
        
        const message = messages[0];
        
        // Only recipient can mark as read
        if (message.recipient_id !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied.'
            });
        }
        
        await db.query('UPDATE messages SET is_read = TRUE WHERE id = ?', [id]);
        
        res.json({
            success: true,
            message: 'Message marked as read.'
        });
        
    } catch (error) {
        console.error('Mark message read error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark message as read.'
        });
    }
});

/**
 * DELETE /api/messages/:id
 * Delete a message (soft delete - only removes from sender/recipient view)
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        // Get message
        const messages = await db.query('SELECT * FROM messages WHERE id = ?', [id]);
        
        if (messages.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Message not found.'
            });
        }
        
        const message = messages[0];
        
        // User must be sender or recipient
        if (message.sender_id !== userId && message.recipient_id !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied.'
            });
        }
        
        // Hard delete for now (could be soft delete in future)
        await db.query('DELETE FROM messages WHERE id = ?', [id]);
        
        res.json({
            success: true,
            message: 'Message deleted successfully.'
        });
        
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete message.'
        });
    }
});

module.exports = router;
