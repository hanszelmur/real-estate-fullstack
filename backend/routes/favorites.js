/**
 * Favorites Routes
 * 
 * @file favorites.js
 * @description Routes for customer property favorites/saved listings.
 *              Allows customers to save properties for later viewing.
 * 
 * @module routes/favorites
 * 
 * ## Endpoints
 * 
 * - GET /api/favorites - Get all favorited properties for current customer
 * - GET /api/favorites/check/:propertyId - Check if property is favorited
 * - POST /api/favorites - Add a property to favorites
 * - POST /api/favorites/toggle - Toggle favorite status
 * - PUT /api/favorites/:favoriteId - Update notes on a favorite
 * - DELETE /api/favorites/:favoriteId - Remove from favorites
 * - GET /api/favorites/property/:propertyId/count - Get favorite count (admin)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, requireRole, requireVerified } = require('../middleware/auth');

/**
 * GET /api/favorites
 * Get all favorited properties for the current customer
 * 
 * @queryparam {string} city - Filter by city
 * @queryparam {number} minPrice - Minimum price
 * @queryparam {number} maxPrice - Maximum price
 * @queryparam {string} propertyType - Filter by type
 * @queryparam {number} page - Page number (default: 1)
 * @queryparam {number} limit - Results per page (default: 20)
 */
router.get('/', authenticate, async (req, res) => {
    try {
        // Only customers can have favorites
        if (req.user.role !== 'customer') {
            return res.status(403).json({
                success: false,
                error: 'Only customers can have favorites'
            });
        }
        
        const { city, minPrice, maxPrice, propertyType, page = 1, limit = 20 } = req.query;
        const userId = req.user.id;
        
        let sql = `
            SELECT f.id, f.notes, f.created_at,
                   p.id as property_id, p.title, p.address, p.city, p.state,
                   p.price, p.status, p.image_url, p.bedrooms, p.bathrooms,
                   p.property_type, p.listing_type, p.square_feet
            FROM favorites f
            JOIN properties p ON f.property_id = p.id
            WHERE f.customer_id = ?
        `;
        const params = [userId];
        
        // Only show available properties (but keep favorited sold/rented for reference)
        // User can still see their favorites even if property is sold
        
        // Apply filters
        if (city) {
            sql += ' AND p.city LIKE ?';
            params.push(`%${city}%`);
        }
        
        if (minPrice) {
            sql += ' AND p.price >= ?';
            params.push(parseFloat(minPrice));
        }
        
        if (maxPrice) {
            sql += ' AND p.price <= ?';
            params.push(parseFloat(maxPrice));
        }
        
        if (propertyType) {
            sql += ' AND p.property_type = ?';
            params.push(propertyType);
        }
        
        sql += ' ORDER BY f.created_at DESC';
        
        const offset = (parseInt(page) - 1) * parseInt(limit);
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);
        
        const favorites = await db.query(sql, params);
        
        // Get total count
        let countSql = `
            SELECT COUNT(*) as total 
            FROM favorites f
            JOIN properties p ON f.property_id = p.id
            WHERE f.customer_id = ?
        `;
        const countParams = [userId];
        
        if (city) {
            countSql += ' AND p.city LIKE ?';
            countParams.push(`%${city}%`);
        }
        if (minPrice) {
            countSql += ' AND p.price >= ?';
            countParams.push(parseFloat(minPrice));
        }
        if (maxPrice) {
            countSql += ' AND p.price <= ?';
            countParams.push(parseFloat(maxPrice));
        }
        if (propertyType) {
            countSql += ' AND p.property_type = ?';
            countParams.push(propertyType);
        }
        
        const countResult = await db.query(countSql, countParams);
        const total = countResult[0].total;
        
        res.json({
            success: true,
            favorites,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('Get favorites error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch favorites.'
        });
    }
});

/**
 * GET /api/favorites/check/:propertyId
 * Check if a property is in the customer's favorites
 */
router.get('/check/:propertyId', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'customer') {
            return res.json({
                success: true,
                isFavorited: false
            });
        }
        
        const { propertyId } = req.params;
        const userId = req.user.id;
        
        const favorites = await db.query(
            'SELECT id, notes FROM favorites WHERE customer_id = ? AND property_id = ?',
            [userId, propertyId]
        );
        
        if (favorites.length > 0) {
            res.json({
                success: true,
                isFavorited: true,
                favoriteId: favorites[0].id,
                notes: favorites[0].notes
            });
        } else {
            res.json({
                success: true,
                isFavorited: false
            });
        }
        
    } catch (error) {
        console.error('Check favorite error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check favorite status.'
        });
    }
});

/**
 * POST /api/favorites
 * Add a property to favorites
 * 
 * @bodyparam {number} propertyId - Property to favorite
 * @bodyparam {string} notes - Optional notes about the property
 */
router.post('/', authenticate, requireVerified, async (req, res) => {
    try {
        // Only customers can add favorites
        if (req.user.role !== 'customer') {
            return res.status(403).json({
                success: false,
                error: 'Only customers can add favorites'
            });
        }
        
        const { propertyId, notes } = req.body;
        const userId = req.user.id;
        
        if (!propertyId) {
            return res.status(400).json({
                success: false,
                error: 'propertyId is required'
            });
        }
        
        // Verify property exists
        const properties = await db.query('SELECT id, title FROM properties WHERE id = ?', [propertyId]);
        if (properties.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found.'
            });
        }
        
        // Check if already favorited
        const existing = await db.query(
            'SELECT id FROM favorites WHERE customer_id = ? AND property_id = ?',
            [userId, propertyId]
        );
        
        if (existing.length > 0) {
            // Update notes if already favorited
            if (notes !== undefined) {
                await db.query('UPDATE favorites SET notes = ? WHERE id = ?', [notes, existing[0].id]);
            }
            return res.json({
                success: true,
                message: 'Property already in favorites.',
                favoriteId: existing[0].id
            });
        }
        
        // Create favorite
        const result = await db.query(`
            INSERT INTO favorites (customer_id, property_id, notes)
            VALUES (?, ?, ?)
        `, [userId, propertyId, notes || null]);
        
        console.log(`[FAVORITE] User ${userId} favorited property ${propertyId}`);
        
        res.status(201).json({
            success: true,
            message: 'Property added to favorites.',
            favoriteId: result.insertId
        });
        
    } catch (error) {
        console.error('Add favorite error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add to favorites.'
        });
    }
});

/**
 * POST /api/favorites/toggle
 * Toggle a property's favorite status (add if not favorited, remove if favorited)
 * 
 * @bodyparam {number} propertyId - Property to toggle
 */
router.post('/toggle', authenticate, requireVerified, async (req, res) => {
    try {
        if (req.user.role !== 'customer') {
            return res.status(403).json({
                success: false,
                error: 'Only customers can toggle favorites'
            });
        }
        
        const { propertyId } = req.body;
        const userId = req.user.id;
        
        if (!propertyId) {
            return res.status(400).json({
                success: false,
                error: 'propertyId is required'
            });
        }
        
        // Check if property exists
        const properties = await db.query('SELECT id FROM properties WHERE id = ?', [propertyId]);
        if (properties.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found.'
            });
        }
        
        // Check if already favorited
        const existing = await db.query(
            'SELECT id FROM favorites WHERE customer_id = ? AND property_id = ?',
            [userId, propertyId]
        );
        
        if (existing.length > 0) {
            // Remove from favorites
            await db.query('DELETE FROM favorites WHERE id = ?', [existing[0].id]);
            console.log(`[FAVORITE] User ${userId} unfavorited property ${propertyId}`);
            return res.json({
                success: true,
                isFavorited: false,
                message: 'Property removed from favorites.'
            });
        } else {
            // Add to favorites
            const result = await db.query(`
                INSERT INTO favorites (customer_id, property_id)
                VALUES (?, ?)
            `, [userId, propertyId]);
            console.log(`[FAVORITE] User ${userId} favorited property ${propertyId}`);
            return res.json({
                success: true,
                isFavorited: true,
                message: 'Property added to favorites.',
                favoriteId: result.insertId
            });
        }
        
    } catch (error) {
        console.error('Toggle favorite error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to toggle favorite.'
        });
    }
});

/**
 * PUT /api/favorites/:favoriteId
 * Update notes on a favorite
 * 
 * @bodyparam {string} notes - New notes
 */
router.put('/:favoriteId', authenticate, async (req, res) => {
    try {
        const { favoriteId } = req.params;
        const { notes } = req.body;
        const userId = req.user.id;
        
        // Get favorite
        const favorites = await db.query('SELECT * FROM favorites WHERE id = ?', [favoriteId]);
        
        if (favorites.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Favorite not found.'
            });
        }
        
        const favorite = favorites[0];
        
        // Verify ownership
        if (favorite.customer_id !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied.'
            });
        }
        
        await db.query('UPDATE favorites SET notes = ? WHERE id = ?', [notes || null, favoriteId]);
        
        res.json({
            success: true,
            message: 'Notes updated successfully.'
        });
        
    } catch (error) {
        console.error('Update favorite error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update favorite.'
        });
    }
});

/**
 * DELETE /api/favorites/:favoriteId
 * Remove a property from favorites
 */
router.delete('/:favoriteId', authenticate, async (req, res) => {
    try {
        const { favoriteId } = req.params;
        const userId = req.user.id;
        
        // Get favorite
        const favorites = await db.query('SELECT * FROM favorites WHERE id = ?', [favoriteId]);
        
        if (favorites.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Favorite not found.'
            });
        }
        
        const favorite = favorites[0];
        
        // Verify ownership
        if (favorite.customer_id !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied.'
            });
        }
        
        await db.query('DELETE FROM favorites WHERE id = ?', [favoriteId]);
        
        console.log(`[FAVORITE] User ${userId} removed favorite ${favoriteId}`);
        
        res.json({
            success: true,
            message: 'Removed from favorites.'
        });
        
    } catch (error) {
        console.error('Delete favorite error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove from favorites.'
        });
    }
});

/**
 * GET /api/favorites/property/:propertyId/count
 * Get the number of users who have favorited a property
 * (Admin only - useful for analytics)
 */
router.get('/property/:propertyId/count', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const { propertyId } = req.params;
        
        const result = await db.query(
            'SELECT COUNT(*) as count FROM favorites WHERE property_id = ?',
            [propertyId]
        );
        
        res.json({
            success: true,
            propertyId: parseInt(propertyId),
            favoriteCount: result[0].count
        });
        
    } catch (error) {
        console.error('Get favorite count error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get favorite count.'
        });
    }
});

module.exports = router;
