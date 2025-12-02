/**
 * Analytics Routes
 * 
 * @file analytics.js
 * @description Analytics routes for admin dashboard with summary stats and trends.
 * 
 * @module routes/analytics
 * 
 * ## Endpoints
 * 
 * - GET /api/analytics/summary - Get dashboard overview statistics
 * - GET /api/analytics/sales-trends - Get sales trends over time
 * - GET /api/analytics/top-agents - Get top performing agents
 * - GET /api/analytics/booking-trends - Get booking trends over time
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

/**
 * GET /api/analytics/summary
 * Get overview statistics for the admin dashboard
 * 
 * @returns {Object} Dashboard statistics
 */
router.get('/summary', authenticate, requireRole('admin'), async (req, res) => {
    try {
        // Total users by role
        const userCounts = await db.query(`
            SELECT role, COUNT(*) as count 
            FROM users 
            GROUP BY role
        `);
        
        // Total properties by status
        const propertyCounts = await db.query(`
            SELECT status, COUNT(*) as count 
            FROM properties 
            WHERE is_archived = FALSE OR is_archived IS NULL
            GROUP BY status
        `);
        
        // Total appointments by status
        const appointmentCounts = await db.query(`
            SELECT status, COUNT(*) as count 
            FROM appointments 
            GROUP BY status
        `);
        
        // Active agents (with properties assigned)
        const activeAgentsResult = await db.query(`
            SELECT COUNT(DISTINCT assigned_agent_id) as count 
            FROM properties 
            WHERE assigned_agent_id IS NOT NULL 
              AND status = 'available'
        `);
        
        // Recent activity (last 7 days)
        const newUsersResult = await db.query(`
            SELECT COUNT(*) as count 
            FROM users 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `);
        
        const newBookingsResult = await db.query(`
            SELECT COUNT(*) as count 
            FROM appointments 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `);
        
        const completedViewingsResult = await db.query(`
            SELECT COUNT(*) as count 
            FROM appointments 
            WHERE status = 'completed'
              AND updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `);
        
        // Calculate totals
        const usersByRole = {};
        userCounts.forEach(r => { usersByRole[r.role] = r.count; });
        
        const propertiesByStatus = {};
        propertyCounts.forEach(r => { propertiesByStatus[r.status] = r.count; });
        
        const appointmentsByStatus = {};
        appointmentCounts.forEach(r => { appointmentsByStatus[r.status] = r.count; });
        
        res.json({
            success: true,
            stats: {
                totalUsers: Object.values(usersByRole).reduce((a, b) => a + b, 0),
                usersByRole,
                totalProperties: Object.values(propertiesByStatus).reduce((a, b) => a + b, 0),
                propertiesByStatus,
                totalAppointments: Object.values(appointmentsByStatus).reduce((a, b) => a + b, 0),
                appointmentsByStatus,
                activeAgents: activeAgentsResult[0].count,
                recentActivity: {
                    newUsers: newUsersResult[0].count,
                    newBookings: newBookingsResult[0].count,
                    completedViewings: completedViewingsResult[0].count
                }
            }
        });
        
    } catch (error) {
        console.error('Get analytics summary error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch analytics summary.'
        });
    }
});

/**
 * GET /api/analytics/sales-trends
 * Get sales trends over time
 * 
 * @queryparam {string} period - 'day', 'week', 'month' (default: 'month')
 * @queryparam {number} limit - Number of periods to return (default: 12)
 */
router.get('/sales-trends', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const { period = 'month', limit = 12 } = req.query;
        
        let dateFormat, interval;
        switch (period) {
            case 'day':
                dateFormat = '%Y-%m-%d';
                interval = 'DAY';
                break;
            case 'week':
                dateFormat = '%Y-%u'; // Year-week number
                interval = 'WEEK';
                break;
            case 'month':
            default:
                dateFormat = '%Y-%m';
                interval = 'MONTH';
                break;
        }
        
        const salesTrends = await db.query(`
            SELECT 
                DATE_FORMAT(sold_date, ?) as period,
                COUNT(*) as sales_count,
                SUM(price) as total_value,
                AVG(price) as average_price
            FROM properties
            WHERE status IN ('sold', 'rented')
              AND sold_date IS NOT NULL
              AND sold_date >= DATE_SUB(NOW(), INTERVAL ? ${interval})
            GROUP BY period
            ORDER BY period DESC
            LIMIT ?
        `, [dateFormat, parseInt(limit), parseInt(limit)]);
        
        res.json({
            success: true,
            period,
            trends: salesTrends.reverse() // Return in chronological order
        });
        
    } catch (error) {
        console.error('Get sales trends error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sales trends.'
        });
    }
});

/**
 * GET /api/analytics/top-agents
 * Get top performing agents by sales and ratings
 * 
 * @queryparam {number} limit - Number of agents to return (default: 10)
 * @queryparam {string} sortBy - 'sales', 'value', 'rating' (default: 'sales')
 */
router.get('/top-agents', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const { limit = 10, sortBy = 'sales' } = req.query;
        
        let orderBy;
        switch (sortBy) {
            case 'value':
                orderBy = 'total_value DESC';
                break;
            case 'rating':
                orderBy = 'average_rating DESC';
                break;
            case 'sales':
            default:
                orderBy = 'sales_count DESC';
                break;
        }
        
        const agents = await db.query(`
            SELECT 
                u.id,
                CONCAT(u.first_name, ' ', u.last_name) as name,
                u.email,
                COUNT(DISTINCT p.id) as sales_count,
                COALESCE(SUM(p.price), 0) as total_value,
                (SELECT COUNT(*) FROM properties WHERE assigned_agent_id = u.id AND status = 'available') as active_listings,
                (SELECT COALESCE(AVG(rating), 0) FROM agent_ratings WHERE agent_id = u.id) as average_rating,
                (SELECT COUNT(*) FROM agent_ratings WHERE agent_id = u.id) as total_ratings,
                (SELECT COUNT(*) FROM appointments WHERE agent_id = u.id AND status = 'completed') as completed_viewings
            FROM users u
            LEFT JOIN properties p ON u.id = p.sold_by_agent_id AND p.status IN ('sold', 'rented')
            WHERE u.role = 'agent' AND u.is_active = TRUE
            GROUP BY u.id
            ORDER BY ${orderBy}
            LIMIT ?
        `, [parseInt(limit)]);
        
        res.json({
            success: true,
            sortBy,
            agents
        });
        
    } catch (error) {
        console.error('Get top agents error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch top agents.'
        });
    }
});

/**
 * GET /api/analytics/booking-trends
 * Get booking trends over time
 * 
 * @queryparam {string} period - 'day', 'week', 'month' (default: 'week')
 * @queryparam {number} limit - Number of periods to return (default: 12)
 */
router.get('/booking-trends', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const { period = 'week', limit = 12 } = req.query;
        
        let dateFormat, interval;
        switch (period) {
            case 'day':
                dateFormat = '%Y-%m-%d';
                interval = 'DAY';
                break;
            case 'month':
                dateFormat = '%Y-%m';
                interval = 'MONTH';
                break;
            case 'week':
            default:
                dateFormat = '%Y-%u';
                interval = 'WEEK';
                break;
        }
        
        const bookingTrends = await db.query(`
            SELECT 
                DATE_FORMAT(created_at, ?) as period,
                COUNT(*) as total_bookings,
                SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
                SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued
            FROM appointments
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? ${interval})
            GROUP BY period
            ORDER BY period DESC
            LIMIT ?
        `, [dateFormat, parseInt(limit), parseInt(limit)]);
        
        res.json({
            success: true,
            period,
            trends: bookingTrends.reverse() // Return in chronological order
        });
        
    } catch (error) {
        console.error('Get booking trends error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch booking trends.'
        });
    }
});

module.exports = router;
