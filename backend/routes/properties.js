/**
 * Property Routes
 * 
 * @file properties.js
 * @description Handles property listing management - CRUD operations for real estate properties.
 *              Includes role-based access control for creating, updating, and deleting properties.
 * 
 * @module routes/properties
 * 
 * ## Role-Based Access Control
 * 
 * | Action | Roles Allowed | Notes |
 * |--------|---------------|-------|
 * | List/View | Public | Available properties only for non-admin |
 * | Create | Admin, Agent | Agents auto-assigned to their properties |
 * | Update | Admin, Agent | Agents can only update assigned properties |
 * | Delete | Admin only | Hard delete with cascade |
 * | Set Featured | Admin only | Featured flag for homepage display |
 * | Assign Agent | Admin only | Agents cannot reassign properties |
 * 
 * ## Endpoints
 * 
 * - GET /api/properties - List all available properties (public)
 * - GET /api/properties/:id - Get single property details (public)
 * - GET /api/properties/featured - Get featured properties (public)
 * - POST /api/properties - Create new property (admin/agent)
 * - PUT /api/properties/:id - Update property (admin/agent)
 * - DELETE /api/properties/:id - Delete property (admin only)
 * 
 * @see backend/sql/schema.sql for properties table structure
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, requireRole, optionalAuth } = require('../middleware/auth');
const auditLogger = require('../utils/auditLogger');

/**
 * GET /api/properties
 * List all available properties with optional filters
 * Public endpoint
 * 
 * Query params: city, state, minPrice, maxPrice, propertyType, listingType, bedrooms, status
 */
router.get('/', optionalAuth, async (req, res) => {
    try {
        const { 
            city, 
            state, 
            minPrice, 
            maxPrice, 
            propertyType, 
            listingType, 
            bedrooms,
            status,
            page = 1,
            limit = 20
        } = req.query;
        
        // Build query with filters
        let sql = `
            SELECT p.*, 
                   u.first_name as agent_first_name, 
                   u.last_name as agent_last_name,
                   u.email as agent_email,
                   u.phone as agent_phone
            FROM properties p
            LEFT JOIN users u ON p.assigned_agent_id = u.id
            WHERE 1=1
        `;
        const params = [];
        
        // Only show available properties to public/customers
        if (!req.user || req.user.role === 'customer') {
            sql += ' AND p.status = ?';
            params.push('available');
        } else if (status) {
            sql += ' AND p.status = ?';
            params.push(status);
        }
        
        // Apply filters
        if (city) {
            sql += ' AND p.city LIKE ?';
            params.push(`%${city}%`);
        }
        
        if (state) {
            sql += ' AND p.state = ?';
            params.push(state);
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
        
        if (listingType) {
            sql += ' AND p.listing_type = ?';
            params.push(listingType);
        }
        
        if (bedrooms) {
            sql += ' AND p.bedrooms >= ?';
            params.push(parseInt(bedrooms));
        }
        
        // Add sorting and pagination
        sql += ' ORDER BY p.featured DESC, p.created_at DESC';
        
        const offset = (parseInt(page) - 1) * parseInt(limit);
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);
        
        const properties = await db.query(sql, params);
        
        // Get total count for pagination
        let countSql = 'SELECT COUNT(*) as total FROM properties WHERE 1=1';
        const countParams = [];
        
        if (!req.user || req.user.role === 'customer') {
            countSql += ' AND status = ?';
            countParams.push('available');
        } else if (status) {
            countSql += ' AND status = ?';
            countParams.push(status);
        }
        
        const countResult = await db.query(countSql, countParams);
        const total = countResult[0].total;
        
        res.json({
            success: true,
            properties,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('List properties error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch properties.'
        });
    }
});

/**
 * GET /api/properties/featured
 * Get featured properties
 * Public endpoint
 */
router.get('/featured', async (req, res) => {
    try {
        const properties = await db.query(`
            SELECT p.*, 
                   u.first_name as agent_first_name, 
                   u.last_name as agent_last_name
            FROM properties p
            LEFT JOIN users u ON p.assigned_agent_id = u.id
            WHERE p.featured = TRUE AND p.status = 'available'
            ORDER BY p.created_at DESC
            LIMIT 6
        `);
        
        res.json({
            success: true,
            properties
        });
        
    } catch (error) {
        console.error('Get featured properties error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch featured properties.'
        });
    }
});

/**
 * GET /api/properties/:id
 * Get single property details
 * Public endpoint
 */
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const properties = await db.query(`
            SELECT p.*, 
                   u.first_name as agent_first_name, 
                   u.last_name as agent_last_name,
                   u.email as agent_email,
                   u.phone as agent_phone
            FROM properties p
            LEFT JOIN users u ON p.assigned_agent_id = u.id
            WHERE p.id = ?
        `, [id]);
        
        if (properties.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found.'
            });
        }
        
        const property = properties[0];
        
        // Only show available properties to public/customers
        if ((!req.user || req.user.role === 'customer') && property.status !== 'available') {
            return res.status(404).json({
                success: false,
                error: 'Property not found.'
            });
        }
        
        res.json({
            success: true,
            property
        });
        
    } catch (error) {
        console.error('Get property error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch property.'
        });
    }
});

/**
 * POST /api/properties
 * Create new property listing
 * 
 * @description Creates a new property listing. Agents can create properties
 *              that are automatically assigned to themselves. Admins can
 *              assign properties to any agent and set featured status.
 * 
 * @requires Authentication (Admin or Agent role)
 * 
 * @bodyparam {string} title - Property title (required)
 * @bodyparam {string} [description] - Detailed description
 * @bodyparam {string} address - Street address (required)
 * @bodyparam {string} city - City (required)
 * @bodyparam {string} state - State abbreviation (required)
 * @bodyparam {string} zipCode - ZIP code (required)
 * @bodyparam {number} price - Listing price (required)
 * @bodyparam {string} propertyType - Type: house, apartment, condo, land, commercial (required)
 * @bodyparam {string} listingType - Type: sale, rent (required)
 * @bodyparam {number} [bedrooms] - Number of bedrooms
 * @bodyparam {number} [bathrooms] - Number of bathrooms
 * @bodyparam {number} [squareFeet] - Square footage
 * @bodyparam {number} [lotSize] - Lot size in acres
 * @bodyparam {number} [yearBuilt] - Year constructed
 * @bodyparam {string} [status] - Status: available, pending, sold, rented
 * @bodyparam {boolean} [featured] - Featured on homepage (admin only)
 * @bodyparam {string} [imageUrl] - URL to property image
 * @bodyparam {number} [assignedAgentId] - Agent to assign (admin only)
 * 
 * @returns {Object} Created property object
 * 
 * @fires PROPERTY_CREATED audit event
 */
router.post('/', authenticate, requireRole('admin', 'agent'), async (req, res) => {
    try {
        const {
            title,
            description,
            address,
            city,
            state,
            zipCode,
            price,
            propertyType,
            listingType,
            bedrooms,
            bathrooms,
            squareFeet,
            lotSize,
            yearBuilt,
            status,
            featured,
            imageUrl,
            assignedAgentId
        } = req.body;
        
        // Validate required fields
        if (!title || !address || !city || !state || !zipCode || !price || !propertyType || !listingType) {
            return res.status(400).json({
                success: false,
                error: 'Required fields: title, address, city, state, zipCode, price, propertyType, listingType'
            });
        }
        
        // ============================================================
        // ROLE-BASED RESTRICTIONS
        // - Only admins can set featured status (highlights on homepage)
        // - Agents auto-assign properties to themselves
        // ============================================================
        
        // Only admins can set featured status
        const isFeatured = req.user.role === 'admin' ? (featured || false) : false;
        
        // If agent is creating, assign to themselves by default
        // Admins can assign to any agent or leave unassigned
        const agentId = req.user.role === 'admin' 
            ? (assignedAgentId || null) 
            : req.user.id;
        
        console.log(`[PROPERTY] Creating property: ${title} by ${req.user.role} ${req.user.id}`);
        
        const result = await db.query(`
            INSERT INTO properties (
                title, description, address, city, state, zip_code, price,
                property_type, listing_type, bedrooms, bathrooms, square_feet,
                lot_size, year_built, status, featured, image_url, created_by, assigned_agent_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            title,
            description || null,
            address,
            city,
            state,
            zipCode,
            price,
            propertyType,
            listingType,
            bedrooms || 0,
            bathrooms || 0,
            squareFeet || 0,
            lotSize || 0,
            yearBuilt || null,
            status || 'available',
            isFeatured,
            imageUrl || null,
            req.user.id,
            agentId
        ]);
        
        // Create agent assignment record if agent assigned
        if (agentId) {
            await db.query(`
                INSERT INTO agent_assignments (agent_id, property_id, assigned_by, status)
                VALUES (?, ?, ?, 'active')
            `, [agentId, result.insertId, req.user.id]);
        }
        
        // Fetch the created property
        const properties = await db.query('SELECT * FROM properties WHERE id = ?', [result.insertId]);
        
        res.status(201).json({
            success: true,
            message: 'Property created successfully.',
            property: properties[0]
        });
        
    } catch (error) {
        console.error('Create property error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create property.'
        });
    }
});

/**
 * PUT /api/properties/:id
 * Update property
 * Admin can update any property, Agent can only update their assigned properties
 */
router.put('/:id', authenticate, requireRole('admin', 'agent'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            description,
            address,
            city,
            state,
            zipCode,
            price,
            propertyType,
            listingType,
            bedrooms,
            bathrooms,
            squareFeet,
            lotSize,
            yearBuilt,
            status,
            featured,
            imageUrl,
            assignedAgentId
        } = req.body;
        
        // Check if property exists
        const properties = await db.query('SELECT * FROM properties WHERE id = ?', [id]);
        
        if (properties.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found.'
            });
        }
        
        const property = properties[0];
        
        // Agents can only update their own properties
        if (req.user.role === 'agent' && property.assigned_agent_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: 'You can only update properties assigned to you.'
            });
        }
        
        // Only admins can change featured status
        const isFeatured = req.user.role === 'admin' 
            ? (featured !== undefined ? featured : property.featured)
            : property.featured;
        
        // Only admins can reassign properties
        const agentId = req.user.role === 'admin'
            ? (assignedAgentId !== undefined ? assignedAgentId : property.assigned_agent_id)
            : property.assigned_agent_id;
        
        await db.query(`
            UPDATE properties SET
                title = ?,
                description = ?,
                address = ?,
                city = ?,
                state = ?,
                zip_code = ?,
                price = ?,
                property_type = ?,
                listing_type = ?,
                bedrooms = ?,
                bathrooms = ?,
                square_feet = ?,
                lot_size = ?,
                year_built = ?,
                status = ?,
                featured = ?,
                image_url = ?,
                assigned_agent_id = ?
            WHERE id = ?
        `, [
            title || property.title,
            description !== undefined ? description : property.description,
            address || property.address,
            city || property.city,
            state || property.state,
            zipCode || property.zip_code,
            price || property.price,
            propertyType || property.property_type,
            listingType || property.listing_type,
            bedrooms !== undefined ? bedrooms : property.bedrooms,
            bathrooms !== undefined ? bathrooms : property.bathrooms,
            squareFeet !== undefined ? squareFeet : property.square_feet,
            lotSize !== undefined ? lotSize : property.lot_size,
            yearBuilt !== undefined ? yearBuilt : property.year_built,
            status || property.status,
            isFeatured,
            imageUrl !== undefined ? imageUrl : property.image_url,
            agentId,
            id
        ]);
        
        // Update agent assignment if agent changed
        if (req.user.role === 'admin' && assignedAgentId !== undefined && assignedAgentId !== property.assigned_agent_id) {
            // Mark old assignment as reassigned
            await db.query(`
                UPDATE agent_assignments SET status = 'reassigned'
                WHERE property_id = ? AND status = 'active'
            `, [id]);
            
            // Create new assignment if new agent assigned
            if (assignedAgentId) {
                await db.query(`
                    INSERT INTO agent_assignments (agent_id, property_id, assigned_by, status)
                    VALUES (?, ?, ?, 'active')
                    ON DUPLICATE KEY UPDATE status = 'active', assigned_by = ?, assigned_at = NOW()
                `, [assignedAgentId, id, req.user.id, req.user.id]);
            }
        }
        
        // Fetch updated property
        const updatedProperties = await db.query('SELECT * FROM properties WHERE id = ?', [id]);
        
        res.json({
            success: true,
            message: 'Property updated successfully.',
            property: updatedProperties[0]
        });
        
    } catch (error) {
        console.error('Update property error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update property.'
        });
    }
});

/**
 * DELETE /api/properties/:id
 * Delete property
 * Admin only
 */
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if property exists
        const properties = await db.query('SELECT * FROM properties WHERE id = ?', [id]);
        
        if (properties.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found.'
            });
        }
        
        // Delete the property (cascades to appointments, waitlist, assignments)
        await db.query('DELETE FROM properties WHERE id = ?', [id]);
        
        res.json({
            success: true,
            message: 'Property deleted successfully.'
        });
        
    } catch (error) {
        console.error('Delete property error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete property.'
        });
    }
});

module.exports = router;
