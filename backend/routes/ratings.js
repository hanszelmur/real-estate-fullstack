/**
 * Agent Ratings Routes
 * 
 * Handles customer ratings for agents after completed viewings.
 * 
 * Business Rules:
 * - Only customers can rate agents
 * - Rating is only allowed after an appointment is completed
 * - One rating per appointment (no duplicates)
 * - Self-ratings are not possible (agents cannot rate themselves)
 * - Ratings are 1-5 stars with optional feedback text
 * 
 * Endpoints:
 * - POST /api/ratings - Submit a rating for an agent
 * - GET /api/ratings/agent/:agentId - Get all ratings for an agent
 * - GET /api/ratings/agent/:agentId/summary - Get rating summary for an agent
 * - GET /api/ratings/can-rate/:appointmentId - Check if user can rate a specific appointment
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, requireRole, requireVerified } = require('../middleware/auth');

/**
 * POST /api/ratings
 * Submit a rating for an agent after a completed viewing
 */
router.post('/', authenticate, requireVerified, async (req, res) => {
    try {
        const { appointmentId, rating, feedback } = req.body;
        const user = req.user;
        
        // Only customers can rate
        if (user.role !== 'customer') {
            return res.status(403).json({
                success: false,
                error: 'Only customers can rate agents.'
            });
        }
        
        // Validate required fields
        if (!appointmentId || !rating) {
            return res.status(400).json({
                success: false,
                error: 'Required fields: appointmentId, rating'
            });
        }
        
        // Validate rating value
        const ratingValue = parseInt(rating);
        if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
            return res.status(400).json({
                success: false,
                error: 'Rating must be between 1 and 5.'
            });
        }
        
        // Get the appointment
        const appointments = await db.query(`
            SELECT a.*, p.title as property_title
            FROM appointments a
            JOIN properties p ON a.property_id = p.id
            WHERE a.id = ?
        `, [appointmentId]);
        
        if (appointments.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found.'
            });
        }
        
        const appointment = appointments[0];
        
        // Verify the appointment belongs to this customer
        if (appointment.customer_id !== user.id) {
            return res.status(403).json({
                success: false,
                error: 'You can only rate appointments you participated in.'
            });
        }
        
        // Verify the appointment is completed
        if (appointment.status !== 'completed') {
            return res.status(400).json({
                success: false,
                error: 'You can only rate completed appointments.'
            });
        }
        
        // Verify there's an agent to rate
        if (!appointment.agent_id) {
            return res.status(400).json({
                success: false,
                error: 'No agent assigned to this appointment.'
            });
        }
        
        // Prevent self-rating (shouldn't happen but extra safety)
        if (appointment.agent_id === user.id) {
            return res.status(403).json({
                success: false,
                error: 'You cannot rate yourself.'
            });
        }
        
        // Check if already rated
        const existingRatings = await db.query(
            'SELECT * FROM agent_ratings WHERE appointment_id = ?',
            [appointmentId]
        );
        
        if (existingRatings.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'You have already rated this appointment.'
            });
        }
        
        // Create the rating
        const result = await db.query(`
            INSERT INTO agent_ratings (agent_id, customer_id, appointment_id, rating, feedback)
            VALUES (?, ?, ?, ?, ?)
        `, [appointment.agent_id, user.id, appointmentId, ratingValue, feedback || null]);
        
        // Create notification for the agent
        await db.query(`
            INSERT INTO notifications (user_id, type, title, message)
            VALUES (?, 'property', '⭐ New Rating Received', ?)
        `, [
            appointment.agent_id,
            `You received a ${ratingValue}-star rating for the viewing of ${appointment.property_title}.${feedback ? ' Customer feedback: "' + feedback.substring(0, 100) + '..."' : ''}`
        ]);
        
        res.status(201).json({
            success: true,
            message: 'Thank you for your rating!',
            rating: {
                id: result.insertId,
                agentId: appointment.agent_id,
                appointmentId,
                rating: ratingValue,
                feedback
            }
        });
        
    } catch (error) {
        console.error('Create rating error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit rating.'
        });
    }
});

/**
 * GET /api/ratings/agent/:agentId
 * Get all ratings for a specific agent
 */
router.get('/agent/:agentId', async (req, res) => {
    try {
        const { agentId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        
        // Verify agent exists
        const agents = await db.query(
            'SELECT id, first_name, last_name FROM users WHERE id = ? AND role = ?',
            [agentId, 'agent']
        );
        
        if (agents.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found.'
            });
        }
        
        const agent = agents[0];
        
        // Get ratings with customer info (anonymized for privacy)
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const ratings = await db.query(`
            SELECT r.id, r.rating, r.feedback, r.created_at,
                   CONCAT(LEFT(c.first_name, 1), '***') as customer_name,
                   p.title as property_title
            FROM agent_ratings r
            JOIN users c ON r.customer_id = c.id
            JOIN appointments a ON r.appointment_id = a.id
            JOIN properties p ON a.property_id = p.id
            WHERE r.agent_id = ?
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        `, [agentId, parseInt(limit), offset]);
        
        // Get total count
        const countResult = await db.query(
            'SELECT COUNT(*) as total FROM agent_ratings WHERE agent_id = ?',
            [agentId]
        );
        const total = countResult[0].total;
        
        res.json({
            success: true,
            agent: {
                id: agent.id,
                firstName: agent.first_name,
                lastName: agent.last_name
            },
            ratings,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('Get agent ratings error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch ratings.'
        });
    }
});

/**
 * GET /api/ratings/agent/:agentId/summary
 * Get rating summary for an agent (average, count by star)
 */
router.get('/agent/:agentId/summary', async (req, res) => {
    try {
        const { agentId } = req.params;
        
        // Verify agent exists
        const agents = await db.query(
            'SELECT id, first_name, last_name FROM users WHERE id = ? AND role = ?',
            [agentId, 'agent']
        );
        
        if (agents.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found.'
            });
        }
        
        const agent = agents[0];
        
        // Get summary statistics
        const summaryResult = await db.query(`
            SELECT 
                COUNT(*) as total_ratings,
                COALESCE(AVG(rating), 0) as average_rating,
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
                SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
                SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
            FROM agent_ratings
            WHERE agent_id = ?
        `, [agentId]);
        
        const summary = summaryResult[0];
        
        res.json({
            success: true,
            agent: {
                id: agent.id,
                firstName: agent.first_name,
                lastName: agent.last_name
            },
            summary: {
                totalRatings: parseInt(summary.total_ratings),
                averageRating: parseFloat(summary.average_rating).toFixed(1),
                distribution: {
                    5: parseInt(summary.five_star) || 0,
                    4: parseInt(summary.four_star) || 0,
                    3: parseInt(summary.three_star) || 0,
                    2: parseInt(summary.two_star) || 0,
                    1: parseInt(summary.one_star) || 0
                }
            }
        });
        
    } catch (error) {
        console.error('Get agent rating summary error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch rating summary.'
        });
    }
});

/**
 * GET /api/ratings/can-rate/:appointmentId
 * Check if the current user can rate a specific appointment
 */
router.get('/can-rate/:appointmentId', authenticate, async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const user = req.user;
        
        // Only customers can rate
        if (user.role !== 'customer') {
            return res.json({
                success: true,
                canRate: false,
                reason: 'Only customers can rate agents.'
            });
        }
        
        // Get the appointment
        const appointments = await db.query(`
            SELECT a.*, p.title as property_title,
                   ag.first_name as agent_first_name,
                   ag.last_name as agent_last_name
            FROM appointments a
            JOIN properties p ON a.property_id = p.id
            LEFT JOIN users ag ON a.agent_id = ag.id
            WHERE a.id = ?
        `, [appointmentId]);
        
        if (appointments.length === 0) {
            return res.json({
                success: true,
                canRate: false,
                reason: 'Appointment not found.'
            });
        }
        
        const appointment = appointments[0];
        
        // Check if this is the customer's appointment
        if (appointment.customer_id !== user.id) {
            return res.json({
                success: true,
                canRate: false,
                reason: 'This is not your appointment.'
            });
        }
        
        // Check if completed
        if (appointment.status !== 'completed') {
            return res.json({
                success: true,
                canRate: false,
                reason: 'Rating is only available after the viewing is completed.'
            });
        }
        
        // Check if agent exists
        if (!appointment.agent_id) {
            return res.json({
                success: true,
                canRate: false,
                reason: 'No agent was assigned to this viewing.'
            });
        }
        
        // Check if already rated
        const existingRatings = await db.query(
            'SELECT * FROM agent_ratings WHERE appointment_id = ?',
            [appointmentId]
        );
        
        if (existingRatings.length > 0) {
            return res.json({
                success: true,
                canRate: false,
                reason: 'You have already rated this viewing.',
                existingRating: {
                    rating: existingRatings[0].rating,
                    feedback: existingRatings[0].feedback
                }
            });
        }
        
        res.json({
            success: true,
            canRate: true,
            appointment: {
                id: appointment.id,
                propertyTitle: appointment.property_title,
                agentName: `${appointment.agent_first_name} ${appointment.agent_last_name}`,
                agentId: appointment.agent_id
            }
        });
        
    } catch (error) {
        console.error('Check can rate error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check rating eligibility.'
        });
    }
});

module.exports = router;
