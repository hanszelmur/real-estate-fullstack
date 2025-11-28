/**
 * Waitlist Routes
 * 
 * Handles property waitlist/queue management.
 * 
 * Endpoints:
 * - GET /api/waitlist - List customer's waitlist entries
 * - POST /api/waitlist - Join waitlist for a property
 * - DELETE /api/waitlist/:id - Leave waitlist
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, requireRole, requireVerified } = require('../middleware/auth');

/**
 * GET /api/waitlist
 * List waitlist entries based on user role
 * - Customer: their own waitlist entries
 * - Agent/Admin: all waitlist entries for their properties
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const { propertyId, page = 1, limit = 20 } = req.query;
        const user = req.user;
        
        let sql = `
            SELECT w.*,
                   p.title as property_title,
                   p.address as property_address,
                   p.price as property_price,
                   p.status as property_status,
                   c.first_name as customer_first_name,
                   c.last_name as customer_last_name,
                   c.email as customer_email,
                   c.phone as customer_phone
            FROM waitlist w
            JOIN properties p ON w.property_id = p.id
            JOIN users c ON w.customer_id = c.id
            WHERE 1=1
        `;
        const params = [];
        
        if (user.role === 'customer') {
            sql += ' AND w.customer_id = ?';
            params.push(user.id);
        } else if (user.role === 'agent') {
            sql += ' AND p.assigned_agent_id = ?';
            params.push(user.id);
        }
        
        if (propertyId) {
            sql += ' AND w.property_id = ?';
            params.push(propertyId);
        }
        
        sql += ' ORDER BY w.position ASC';
        
        const offset = (parseInt(page) - 1) * parseInt(limit);
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);
        
        const waitlist = await db.query(sql, params);
        
        res.json({
            success: true,
            waitlist
        });
        
    } catch (error) {
        console.error('List waitlist error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch waitlist.'
        });
    }
});

/**
 * POST /api/waitlist
 * Join waitlist for a property
 * Customer only
 */
router.post('/', authenticate, requireVerified, async (req, res) => {
    try {
        const { propertyId } = req.body;
        const user = req.user;
        
        if (user.role !== 'customer') {
            return res.status(403).json({
                success: false,
                error: 'Only customers can join waitlists.'
            });
        }
        
        if (!propertyId) {
            return res.status(400).json({
                success: false,
                error: 'Property ID is required.'
            });
        }
        
        // Check if property exists
        const properties = await db.query('SELECT * FROM properties WHERE id = ?', [propertyId]);
        
        if (properties.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found.'
            });
        }
        
        // Check if already on waitlist
        const existing = await db.query(
            'SELECT * FROM waitlist WHERE property_id = ? AND customer_id = ?',
            [propertyId, user.id]
        );
        
        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'You are already on the waitlist for this property.'
            });
        }
        
        // Get next position
        const positionResult = await db.query(
            'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM waitlist WHERE property_id = ?',
            [propertyId]
        );
        const position = positionResult[0].next_position;
        
        // Add to waitlist
        const result = await db.query(`
            INSERT INTO waitlist (property_id, customer_id, position, status)
            VALUES (?, ?, ?, 'waiting')
        `, [propertyId, user.id, position]);
        
        res.status(201).json({
            success: true,
            message: `Added to waitlist at position ${position}.`,
            waitlistEntry: {
                id: result.insertId,
                propertyId,
                position
            }
        });
        
    } catch (error) {
        console.error('Join waitlist error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to join waitlist.'
        });
    }
});

/**
 * DELETE /api/waitlist/:id
 * Leave waitlist
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        
        // Check if entry exists
        const entries = await db.query('SELECT * FROM waitlist WHERE id = ?', [id]);
        
        if (entries.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Waitlist entry not found.'
            });
        }
        
        const entry = entries[0];
        
        // Check permissions
        if (user.role === 'customer' && entry.customer_id !== user.id) {
            return res.status(403).json({
                success: false,
                error: 'Access denied.'
            });
        }
        
        // Delete entry
        await db.query('DELETE FROM waitlist WHERE id = ?', [id]);
        
        // Update positions for remaining entries
        await db.query(`
            UPDATE waitlist 
            SET position = position - 1 
            WHERE property_id = ? AND position > ?
        `, [entry.property_id, entry.position]);
        
        res.json({
            success: true,
            message: 'Removed from waitlist.'
        });
        
    } catch (error) {
        console.error('Leave waitlist error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to leave waitlist.'
        });
    }
});

module.exports = router;
