/**
 * User Management Routes (Admin Only)
 * 
 * Handles user administration for admin dashboard.
 * 
 * Endpoints:
 * - GET /api/users - List all users (admin only)
 * - GET /api/users/:id - Get single user (admin only)
 * - PUT /api/users/:id - Update user (admin only)
 * - GET /api/users/agents - List all agents
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { hashPassword } = require('../utils/auth');
const { authenticate, requireRole } = require('../middleware/auth');

/**
 * GET /api/users
 * List all users with optional filters
 * Admin only
 */
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const { role, isActive, page = 1, limit = 20 } = req.query;
        
        let sql = `
            SELECT id, email, phone, first_name, last_name, role, is_verified, is_active, created_at
            FROM users
            WHERE 1=1
        `;
        const params = [];
        
        if (role) {
            sql += ' AND role = ?';
            params.push(role);
        }
        
        if (isActive !== undefined) {
            sql += ' AND is_active = ?';
            params.push(isActive === 'true');
        }
        
        sql += ' ORDER BY created_at DESC';
        
        const offset = (parseInt(page) - 1) * parseInt(limit);
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);
        
        const users = await db.query(sql, params);
        
        // Get total count
        let countSql = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
        const countParams = [];
        
        if (role) {
            countSql += ' AND role = ?';
            countParams.push(role);
        }
        
        if (isActive !== undefined) {
            countSql += ' AND is_active = ?';
            countParams.push(isActive === 'true');
        }
        
        const countResult = await db.query(countSql, countParams);
        const total = countResult[0].total;
        
        res.json({
            success: true,
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('List users error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch users.'
        });
    }
});

/**
 * GET /api/users/agents
 * List all active agents
 * Available to admin and other agents
 */
router.get('/agents', authenticate, requireRole('admin', 'agent'), async (req, res) => {
    try {
        const agents = await db.query(`
            SELECT id, email, phone, first_name, last_name, created_at
            FROM users
            WHERE role = 'agent' AND is_active = TRUE
            ORDER BY first_name, last_name
        `);
        
        res.json({
            success: true,
            agents
        });
        
    } catch (error) {
        console.error('List agents error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch agents.'
        });
    }
});

/**
 * GET /api/users/:id
 * Get single user details
 * Admin only
 */
router.get('/:id', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        
        const users = await db.query(`
            SELECT id, email, phone, first_name, last_name, role, is_verified, is_active, created_at, updated_at
            FROM users
            WHERE id = ?
        `, [id]);
        
        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found.'
            });
        }
        
        const user = users[0];
        
        // Get additional stats based on role
        let stats = {};
        
        if (user.role === 'agent') {
            // Get agent's property count
            const propertyCount = await db.query(
                'SELECT COUNT(*) as count FROM properties WHERE assigned_agent_id = ?',
                [id]
            );
            
            // Get agent's appointment count
            const appointmentCount = await db.query(
                'SELECT COUNT(*) as count FROM appointments WHERE agent_id = ?',
                [id]
            );
            
            stats = {
                assignedProperties: propertyCount[0].count,
                totalAppointments: appointmentCount[0].count
            };
        } else if (user.role === 'customer') {
            // Get customer's appointment count
            const appointmentCount = await db.query(
                'SELECT COUNT(*) as count FROM appointments WHERE customer_id = ?',
                [id]
            );
            
            stats = {
                totalAppointments: appointmentCount[0].count
            };
        }
        
        res.json({
            success: true,
            user: { ...user, stats }
        });
        
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user.'
        });
    }
});

/**
 * PUT /api/users/:id
 * Update user (activate/deactivate, change role, etc.)
 * Admin only
 */
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, phone, role, isActive, isVerified, password } = req.body;
        
        // Check if user exists
        const users = await db.query('SELECT * FROM users WHERE id = ?', [id]);
        
        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found.'
            });
        }
        
        const user = users[0];
        
        // Prevent admin from deactivating themselves
        if (parseInt(id) === req.user.id && isActive === false) {
            return res.status(400).json({
                success: false,
                error: 'Cannot deactivate your own account.'
            });
        }
        
        // Build update query
        let updateFields = [];
        let params = [];
        
        if (firstName !== undefined) {
            updateFields.push('first_name = ?');
            params.push(firstName);
        }
        
        if (lastName !== undefined) {
            updateFields.push('last_name = ?');
            params.push(lastName);
        }
        
        if (phone !== undefined) {
            updateFields.push('phone = ?');
            params.push(phone);
        }
        
        if (role !== undefined) {
            updateFields.push('role = ?');
            params.push(role);
        }
        
        if (isActive !== undefined) {
            updateFields.push('is_active = ?');
            params.push(isActive);
        }
        
        if (isVerified !== undefined) {
            updateFields.push('is_verified = ?');
            params.push(isVerified);
        }
        
        if (password) {
            const passwordHash = await hashPassword(password);
            updateFields.push('password_hash = ?');
            params.push(passwordHash);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No fields to update.'
            });
        }
        
        params.push(id);
        
        await db.query(
            `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
            params
        );
        
        // Fetch updated user
        const updatedUsers = await db.query(`
            SELECT id, email, phone, first_name, last_name, role, is_verified, is_active, created_at
            FROM users WHERE id = ?
        `, [id]);
        
        res.json({
            success: true,
            message: 'User updated successfully.',
            user: updatedUsers[0]
        });
        
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update user.'
        });
    }
});

/**
 * GET /api/users/stats/overview
 * Get user statistics overview
 * Admin only
 */
router.get('/stats/overview', authenticate, requireRole('admin'), async (req, res) => {
    try {
        // Get counts by role
        const roleCounts = await db.query(`
            SELECT role, COUNT(*) as count
            FROM users
            GROUP BY role
        `);
        
        // Get recent registrations (last 30 days)
        const recentUsers = await db.query(`
            SELECT COUNT(*) as count
            FROM users
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        `);
        
        // Get verified vs unverified customers
        const verificationStats = await db.query(`
            SELECT is_verified, COUNT(*) as count
            FROM users
            WHERE role = 'customer'
            GROUP BY is_verified
        `);
        
        res.json({
            success: true,
            stats: {
                byRole: roleCounts.reduce((acc, row) => {
                    acc[row.role] = row.count;
                    return acc;
                }, {}),
                recentRegistrations: recentUsers[0].count,
                verificationStats: verificationStats.reduce((acc, row) => {
                    acc[row.is_verified ? 'verified' : 'unverified'] = row.count;
                    return acc;
                }, {})
            }
        });
        
    } catch (error) {
        console.error('Get user stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user statistics.'
        });
    }
});

module.exports = router;
