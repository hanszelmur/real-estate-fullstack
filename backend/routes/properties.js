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
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../config/database');
const { authenticate, requireRole, optionalAuth } = require('../middleware/auth');
const auditLogger = require('../utils/auditLogger');

// ============================================================================
// FILE UPLOAD CONFIGURATION
// ============================================================================
// Configure multer for property image uploads
// Images are stored in backend/uploads/images/
// ============================================================================

const uploadsDir = path.join(__dirname, '..', 'uploads', 'images');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename: property-{timestamp}-{random}.{ext}
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueName = `property-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
        cb(null, uniqueName);
    }
});

// File filter - only allow images
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'), false);
    }
};

// Multer configuration
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max file size
        files: 10 // Max 10 files per upload
    }
});

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
            includeArchived,
            page = 1,
            limit = 20
        } = req.query;
        
        // Build query with filters
        let sql = `
            SELECT p.*, 
                   u.first_name as agent_first_name, 
                   u.last_name as agent_last_name,
                   u.email as agent_email,
                   u.phone as agent_phone,
                   s.first_name as sold_by_first_name,
                   s.last_name as sold_by_last_name
            FROM properties p
            LEFT JOIN users u ON p.assigned_agent_id = u.id
            LEFT JOIN users s ON p.sold_by_agent_id = s.id
            WHERE p.deleted_at IS NULL
        `;
        const params = [];
        
        // Exclude archived properties by default (admin can include with ?includeArchived=true)
        if (req.user && req.user.role === 'admin' && includeArchived === 'true') {
            // Admin requesting archived - no filter
        } else {
            sql += ' AND (p.is_archived = FALSE OR p.is_archived IS NULL)';
        }
        
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
        let countSql = 'SELECT COUNT(*) as total FROM properties WHERE deleted_at IS NULL';
        const countParams = [];
        
        // Apply same archive filter to count
        if (req.user && req.user.role === 'admin' && includeArchived === 'true') {
            // Admin requesting archived - no filter
        } else {
            countSql += ' AND (is_archived = FALSE OR is_archived IS NULL)';
        }
        
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
            WHERE p.featured = TRUE AND p.status = 'available' AND p.deleted_at IS NULL
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
 * GET /api/properties/sold
 * List sold properties with agent info
 * 
 * @access Admin, Agent
 * @query agentId - Filter by sold_by_agent_id (admin only)
 * @query startDate - Filter from date (YYYY-MM-DD)
 * @query endDate - Filter to date (YYYY-MM-DD)
 * @query page, limit - Pagination
 * 
 * Agent View: Only their sales (sold_by_agent_id = current_user)
 * Admin View: All sales, can filter by agent
 */
router.get('/sold', authenticate, requireRole('admin', 'agent'), async (req, res) => {
    try {
        const { agentId, startDate, endDate, page = 1, limit = 20 } = req.query;
        
        let sql = `
            SELECT p.*, 
                   u.first_name as agent_first_name, 
                   u.last_name as agent_last_name,
                   u.email as agent_email,
                   s.first_name as sold_by_first_name,
                   s.last_name as sold_by_last_name,
                   s.email as sold_by_email
            FROM properties p
            LEFT JOIN users u ON p.assigned_agent_id = u.id
            LEFT JOIN users s ON p.sold_by_agent_id = s.id
            WHERE p.status IN ('sold', 'rented')
        `;
        const params = [];
        
        // Agents can only see their own sales
        if (req.user.role === 'agent') {
            sql += ' AND p.sold_by_agent_id = ?';
            params.push(req.user.id);
        } else if (agentId) {
            // Admin can filter by agent
            sql += ' AND p.sold_by_agent_id = ?';
            params.push(parseInt(agentId));
        }
        
        // Date filters
        if (startDate) {
            sql += ' AND p.sold_date >= ?';
            params.push(startDate);
        }
        
        if (endDate) {
            sql += ' AND p.sold_date <= ?';
            params.push(endDate + ' 23:59:59');
        }
        
        sql += ' ORDER BY p.sold_date DESC';
        
        const offset = (parseInt(page) - 1) * parseInt(limit);
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);
        
        const properties = await db.query(sql, params);
        
        // Get total count
        let countSql = `SELECT COUNT(*) as total FROM properties WHERE status IN ('sold', 'rented')`;
        const countParams = [];
        
        if (req.user.role === 'agent') {
            countSql += ' AND sold_by_agent_id = ?';
            countParams.push(req.user.id);
        } else if (agentId) {
            countSql += ' AND sold_by_agent_id = ?';
            countParams.push(parseInt(agentId));
        }
        
        if (startDate) {
            countSql += ' AND sold_date >= ?';
            countParams.push(startDate);
        }
        
        if (endDate) {
            countSql += ' AND sold_date <= ?';
            countParams.push(endDate + ' 23:59:59');
        }
        
        const countResult = await db.query(countSql, countParams);
        const total = countResult[0].total;
        
        // Calculate summary stats
        let summaryParams = [];
        let summarySql = `
            SELECT 
                COUNT(*) as totalSales,
                COALESCE(SUM(price), 0) as totalValue
            FROM properties 
            WHERE status IN ('sold', 'rented')
        `;
        
        if (req.user.role === 'agent') {
            summarySql += ' AND sold_by_agent_id = ?';
            summaryParams.push(req.user.id);
        } else if (agentId) {
            summarySql += ' AND sold_by_agent_id = ?';
            summaryParams.push(parseInt(agentId));
        }
        
        if (startDate) {
            summarySql += ' AND sold_date >= ?';
            summaryParams.push(startDate);
        }
        
        if (endDate) {
            summarySql += ' AND sold_date <= ?';
            summaryParams.push(endDate + ' 23:59:59');
        }
        
        const summaryResult = await db.query(summarySql, summaryParams);
        
        res.json({
            success: true,
            properties,
            summary: {
                totalSales: summaryResult[0].totalSales,
                totalValue: parseFloat(summaryResult[0].totalValue) || 0
            },
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('List sold properties error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sold properties.'
        });
    }
});

/**
 * GET /api/properties/archived
 * List archived properties
 * 
 * @access Admin only
 */
router.get('/archived', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        
        let sql = `
            SELECT p.*, 
                   u.first_name as agent_first_name, 
                   u.last_name as agent_last_name,
                   s.first_name as sold_by_first_name,
                   s.last_name as sold_by_last_name
            FROM properties p
            LEFT JOIN users u ON p.assigned_agent_id = u.id
            LEFT JOIN users s ON p.sold_by_agent_id = s.id
            WHERE p.is_archived = TRUE
            ORDER BY p.sold_date DESC
        `;
        
        const offset = (parseInt(page) - 1) * parseInt(limit);
        sql += ' LIMIT ? OFFSET ?';
        
        const properties = await db.query(sql, [parseInt(limit), offset]);
        
        const countResult = await db.query('SELECT COUNT(*) as total FROM properties WHERE is_archived = TRUE');
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
        console.error('List archived properties error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch archived properties.'
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
            WHERE p.id = ? AND p.deleted_at IS NULL
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
        
        // Fetch property photos
        const photos = await db.query(`
            SELECT id, filename, original_filename, is_primary, display_order
            FROM property_photos
            WHERE property_id = ?
            ORDER BY is_primary DESC, display_order ASC, created_at ASC
        `, [id]);
        
        // Add photos array to property object
        property.photos = photos;
        
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
 * Soft delete property (sets deleted_at timestamp)
 * Admin only
 * 
 * Note: Uses soft delete pattern to preserve data for audit trails.
 * The property is not actually removed from the database but marked
 * as deleted by setting the deleted_at timestamp.
 */
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if property exists and is not already deleted
        const properties = await db.query('SELECT * FROM properties WHERE id = ? AND deleted_at IS NULL', [id]);
        
        if (properties.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found.'
            });
        }
        
        // Soft delete: set deleted_at timestamp instead of hard delete
        await db.query('UPDATE properties SET deleted_at = NOW() WHERE id = ?', [id]);
        
        console.log(`[PROPERTY] Property ${id} soft deleted by admin ${req.user.id}`);
        
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

// ============================================================================
// PROPERTY PHOTO ENDPOINTS
// ============================================================================

/**
 * GET /api/properties/:id/photos
 * Get all photos for a property
 * Public endpoint
 */
router.get('/:id/photos', async (req, res) => {
    try {
        const { id } = req.params;
        
        const photos = await db.query(`
            SELECT id, filename, original_filename, is_primary, display_order, created_at
            FROM property_photos
            WHERE property_id = ?
            ORDER BY is_primary DESC, display_order ASC, created_at ASC
        `, [id]);
        
        res.json({
            success: true,
            photos
        });
        
    } catch (error) {
        console.error('Get property photos error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch property photos.'
        });
    }
});

/**
 * POST /api/properties/:id/photos
 * Upload photos for a property
 * Admin/Agent only (must be assigned agent for agents)
 * 
 * Accepts multipart/form-data with 'images' field containing one or more files
 */
router.post('/:id/photos', authenticate, requireRole('admin', 'agent'), upload.array('images', 10), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if property exists
        const properties = await db.query('SELECT * FROM properties WHERE id = ?', [id]);
        
        if (properties.length === 0) {
            // Delete uploaded files if property not found
            if (req.files) {
                req.files.forEach(file => {
                    fs.unlink(file.path, err => {
                        if (err) console.error('Error deleting file:', err);
                    });
                });
            }
            return res.status(404).json({
                success: false,
                error: 'Property not found.'
            });
        }
        
        const property = properties[0];
        
        // Agents can only upload photos to their assigned properties
        if (req.user.role === 'agent' && property.assigned_agent_id !== req.user.id) {
            // Delete uploaded files if not authorized
            if (req.files) {
                req.files.forEach(file => {
                    fs.unlink(file.path, err => {
                        if (err) console.error('Error deleting file:', err);
                    });
                });
            }
            return res.status(403).json({
                success: false,
                error: 'You can only upload photos to properties assigned to you.'
            });
        }
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No files uploaded.'
            });
        }
        
        // Check if property has any photos
        const existingPhotos = await db.query(
            'SELECT COUNT(*) as count FROM property_photos WHERE property_id = ?',
            [id]
        );
        const hasExistingPhotos = existingPhotos[0].count > 0;
        
        // Insert photo records
        const insertedPhotos = [];
        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            // First uploaded photo is primary if no existing photos
            const isPrimary = !hasExistingPhotos && i === 0;
            
            const result = await db.query(`
                INSERT INTO property_photos (property_id, filename, original_filename, is_primary, display_order, uploaded_by)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [id, file.filename, file.originalname, isPrimary, existingPhotos[0].count + i, req.user.id]);
            
            insertedPhotos.push({
                id: result.insertId,
                filename: file.filename,
                original_filename: file.originalname,
                is_primary: isPrimary,
                display_order: existingPhotos[0].count + i
            });
        }
        
        console.log(`[PROPERTY] ${req.files.length} photos uploaded for property ${id} by ${req.user.role} ${req.user.id}`);
        
        res.status(201).json({
            success: true,
            message: `${req.files.length} photo(s) uploaded successfully.`,
            photos: insertedPhotos
        });
        
    } catch (error) {
        console.error('Upload photos error:', error);
        // Clean up uploaded files on error
        if (req.files) {
            req.files.forEach(file => {
                fs.unlink(file.path, err => {
                    if (err) console.error('Error deleting file:', err);
                });
            });
        }
        res.status(500).json({
            success: false,
            error: 'Failed to upload photos.'
        });
    }
});

/**
 * PUT /api/properties/:propertyId/photos/:photoId/primary
 * Set a photo as the primary image for a property
 * Admin/Agent only
 */
router.put('/:propertyId/photos/:photoId/primary', authenticate, requireRole('admin', 'agent'), async (req, res) => {
    try {
        const { propertyId, photoId } = req.params;
        
        // Check if property exists
        const properties = await db.query('SELECT * FROM properties WHERE id = ?', [propertyId]);
        
        if (properties.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found.'
            });
        }
        
        const property = properties[0];
        
        // Agents can only modify their assigned properties
        if (req.user.role === 'agent' && property.assigned_agent_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: 'You can only modify photos for properties assigned to you.'
            });
        }
        
        // Check if photo exists and belongs to this property
        const photos = await db.query(
            'SELECT * FROM property_photos WHERE id = ? AND property_id = ?',
            [photoId, propertyId]
        );
        
        if (photos.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Photo not found.'
            });
        }
        
        // Update: set all photos to non-primary, then set this one as primary
        await db.query('UPDATE property_photos SET is_primary = FALSE WHERE property_id = ?', [propertyId]);
        await db.query('UPDATE property_photos SET is_primary = TRUE WHERE id = ?', [photoId]);
        
        res.json({
            success: true,
            message: 'Primary photo updated successfully.'
        });
        
    } catch (error) {
        console.error('Set primary photo error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to set primary photo.'
        });
    }
});

/**
 * DELETE /api/properties/:propertyId/photos/:photoId
 * Delete a property photo
 * Admin/Agent only
 */
router.delete('/:propertyId/photos/:photoId', authenticate, requireRole('admin', 'agent'), async (req, res) => {
    try {
        const { propertyId, photoId } = req.params;
        
        // Check if property exists
        const properties = await db.query('SELECT * FROM properties WHERE id = ?', [propertyId]);
        
        if (properties.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found.'
            });
        }
        
        const property = properties[0];
        
        // Agents can only delete photos from their assigned properties
        if (req.user.role === 'agent' && property.assigned_agent_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: 'You can only delete photos from properties assigned to you.'
            });
        }
        
        // Check if photo exists and belongs to this property
        const photos = await db.query(
            'SELECT * FROM property_photos WHERE id = ? AND property_id = ?',
            [photoId, propertyId]
        );
        
        if (photos.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Photo not found.'
            });
        }
        
        const photo = photos[0];
        
        // Delete file from disk
        const filePath = path.join(uploadsDir, photo.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        // Delete record from database
        await db.query('DELETE FROM property_photos WHERE id = ?', [photoId]);
        
        // If deleted photo was primary, make first remaining photo primary
        if (photo.is_primary) {
            const remainingPhotos = await db.query(
                'SELECT id FROM property_photos WHERE property_id = ? ORDER BY display_order ASC LIMIT 1',
                [propertyId]
            );
            if (remainingPhotos.length > 0) {
                await db.query('UPDATE property_photos SET is_primary = TRUE WHERE id = ?', [remainingPhotos[0].id]);
            }
        }
        
        console.log(`[PROPERTY] Photo ${photoId} deleted from property ${propertyId} by ${req.user.role} ${req.user.id}`);
        
        res.json({
            success: true,
            message: 'Photo deleted successfully.'
        });
        
    } catch (error) {
        console.error('Delete photo error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete photo.'
        });
    }
});

/**
 * PUT /api/properties/:id/mark-sold
 * Mark a property as sold
 * 
 * @access Admin, Agent (own properties only)
 * @body soldByAgentId - Agent who closed the deal (Admin can specify, Agent defaults to self)
 * 
 * - Updates status to 'sold'
 * - Sets sold_by_agent_id and sold_date
 * - Auto-cancels pending/confirmed appointments
 * - Creates notifications for affected customers
 */
router.put('/:id/mark-sold', authenticate, requireRole('admin', 'agent'), async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        const { soldByAgentId } = req.body;
        
        // Check if property exists
        const properties = await db.query('SELECT * FROM properties WHERE id = ?', [id]);
        
        if (properties.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found.'
            });
        }
        
        const property = properties[0];
        
        // Agents can only mark their own properties as sold
        if (req.user.role === 'agent' && property.assigned_agent_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: 'You can only mark properties assigned to you as sold.'
            });
        }
        
        // Check if property is already sold
        if (property.status === 'sold') {
            return res.status(400).json({
                success: false,
                error: 'Property is already marked as sold.'
            });
        }
        
        // Determine who gets credit for the sale
        const agentId = req.user.role === 'admin' && soldByAgentId 
            ? parseInt(soldByAgentId) 
            : req.user.id;
        
        // Start transaction for atomic operation
        connection = await db.getConnection();
        await new Promise((resolve, reject) => {
            connection.beginTransaction(err => err ? reject(err) : resolve());
        });
        
        // Update property status within transaction
        await new Promise((resolve, reject) => {
            connection.query(`
                UPDATE properties 
                SET status = 'sold', sold_by_agent_id = ?, sold_date = NOW()
                WHERE id = ?
            `, [agentId, id], (err, result) => err ? reject(err) : resolve(result));
        });
        
        // Get affected appointments (pending or confirmed)
        const appointments = await new Promise((resolve, reject) => {
            connection.query(`
                SELECT a.id, a.customer_id, u.email, u.first_name
                FROM appointments a
                JOIN users u ON a.customer_id = u.id
                WHERE a.property_id = ? AND a.status IN ('pending', 'confirmed', 'queued')
            `, [id], (err, result) => err ? reject(err) : resolve(result));
        });
        
        // Cancel all affected appointments and create notifications
        if (appointments.length > 0) {
            await new Promise((resolve, reject) => {
                connection.query(`
                    UPDATE appointments 
                    SET status = 'cancelled' 
                    WHERE property_id = ? AND status IN ('pending', 'confirmed', 'queued')
                `, [id], (err, result) => err ? reject(err) : resolve(result));
            });
            
            // Create notifications for each affected customer
            for (const apt of appointments) {
                await new Promise((resolve, reject) => {
                    connection.query(`
                        INSERT INTO notifications (user_id, type, title, message)
                        VALUES (?, 'property', 'Property Sold', ?)
                    `, [apt.customer_id, `The property "${property.title}" you had an appointment for has been sold. Your appointment has been cancelled.`], (err, result) => err ? reject(err) : resolve(result));
                });
            }
        }
        
        // Commit transaction
        await new Promise((resolve, reject) => {
            connection.commit(err => err ? reject(err) : resolve());
        });
        
        // Fetch updated property (outside transaction)
        const updatedProperties = await db.query(`
            SELECT p.*, 
                   s.first_name as sold_by_first_name,
                   s.last_name as sold_by_last_name
            FROM properties p
            LEFT JOIN users s ON p.sold_by_agent_id = s.id
            WHERE p.id = ?
        `, [id]);
        
        console.log(`[PROPERTY] Property ${id} marked as sold by agent ${agentId}. ${appointments.length} appointments cancelled.`);
        
        res.json({
            success: true,
            message: `Property marked as sold. ${appointments.length} appointment(s) cancelled.`,
            property: updatedProperties[0],
            cancelledAppointments: appointments.length
        });
        
    } catch (error) {
        // Rollback on error
        if (connection) {
            await new Promise(resolve => {
                connection.rollback(() => resolve());
            });
        }
        console.error('Mark property sold error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark property as sold.'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

/**
 * PUT /api/properties/:id/mark-rented
 * Mark a property as rented
 * 
 * @access Admin, Agent (own properties only)
 * @body soldByAgentId - Agent who closed the deal
 * 
 * Same logic as mark-sold but status = 'rented'
 */
router.put('/:id/mark-rented', authenticate, requireRole('admin', 'agent'), async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        const { soldByAgentId } = req.body;
        
        // Check if property exists
        const properties = await db.query('SELECT * FROM properties WHERE id = ?', [id]);
        
        if (properties.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found.'
            });
        }
        
        const property = properties[0];
        
        // Agents can only mark their own properties as rented
        if (req.user.role === 'agent' && property.assigned_agent_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: 'You can only mark properties assigned to you as rented.'
            });
        }
        
        // Check if property is already rented
        if (property.status === 'rented') {
            return res.status(400).json({
                success: false,
                error: 'Property is already marked as rented.'
            });
        }
        
        // Determine who gets credit for the rental
        const agentId = req.user.role === 'admin' && soldByAgentId 
            ? parseInt(soldByAgentId) 
            : req.user.id;
        
        // Start transaction for atomic operation
        connection = await db.getConnection();
        await new Promise((resolve, reject) => {
            connection.beginTransaction(err => err ? reject(err) : resolve());
        });
        
        // Update property status within transaction
        await new Promise((resolve, reject) => {
            connection.query(`
                UPDATE properties 
                SET status = 'rented', sold_by_agent_id = ?, sold_date = NOW()
                WHERE id = ?
            `, [agentId, id], (err, result) => err ? reject(err) : resolve(result));
        });
        
        // Get affected appointments (pending or confirmed)
        const appointments = await new Promise((resolve, reject) => {
            connection.query(`
                SELECT a.id, a.customer_id, u.email, u.first_name
                FROM appointments a
                JOIN users u ON a.customer_id = u.id
                WHERE a.property_id = ? AND a.status IN ('pending', 'confirmed', 'queued')
            `, [id], (err, result) => err ? reject(err) : resolve(result));
        });
        
        // Cancel all affected appointments and create notifications
        if (appointments.length > 0) {
            await new Promise((resolve, reject) => {
                connection.query(`
                    UPDATE appointments 
                    SET status = 'cancelled' 
                    WHERE property_id = ? AND status IN ('pending', 'confirmed', 'queued')
                `, [id], (err, result) => err ? reject(err) : resolve(result));
            });
            
            // Create notifications for each affected customer
            for (const apt of appointments) {
                await new Promise((resolve, reject) => {
                    connection.query(`
                        INSERT INTO notifications (user_id, type, title, message)
                        VALUES (?, 'property', 'Property Rented', ?)
                    `, [apt.customer_id, `The property "${property.title}" you had an appointment for has been rented. Your appointment has been cancelled.`], (err, result) => err ? reject(err) : resolve(result));
                });
            }
        }
        
        // Commit transaction
        await new Promise((resolve, reject) => {
            connection.commit(err => err ? reject(err) : resolve());
        });
        
        // Fetch updated property (outside transaction)
        const updatedProperties = await db.query(`
            SELECT p.*, 
                   s.first_name as sold_by_first_name,
                   s.last_name as sold_by_last_name
            FROM properties p
            LEFT JOIN users s ON p.sold_by_agent_id = s.id
            WHERE p.id = ?
        `, [id]);
        
        console.log(`[PROPERTY] Property ${id} marked as rented by agent ${agentId}. ${appointments.length} appointments cancelled.`);
        
        res.json({
            success: true,
            message: `Property marked as rented. ${appointments.length} appointment(s) cancelled.`,
            property: updatedProperties[0],
            cancelledAppointments: appointments.length
        });
        
    } catch (error) {
        // Rollback on error
        if (connection) {
            await new Promise(resolve => {
                connection.rollback(() => resolve());
            });
        }
        console.error('Mark property rented error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark property as rented.'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

/**
 * PUT /api/properties/:id/archive
 * Archive a sold or rented property
 * 
 * @access Admin, Agent (own properties only)
 * @requires Property must be sold or rented
 */
router.put('/:id/archive', authenticate, requireRole('admin', 'agent'), async (req, res) => {
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
        
        const property = properties[0];
        
        // Agents can only archive their own properties
        if (req.user.role === 'agent' && property.assigned_agent_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: 'You can only archive properties assigned to you.'
            });
        }
        
        // Property must be sold or rented to archive
        if (!['sold', 'rented'].includes(property.status)) {
            return res.status(400).json({
                success: false,
                error: 'Only sold or rented properties can be archived.'
            });
        }
        
        // Check if already archived
        if (property.is_archived) {
            return res.status(400).json({
                success: false,
                error: 'Property is already archived.'
            });
        }
        
        // Archive the property
        await db.query('UPDATE properties SET is_archived = TRUE WHERE id = ?', [id]);
        
        console.log(`[PROPERTY] Property ${id} archived by ${req.user.role} ${req.user.id}`);
        
        res.json({
            success: true,
            message: 'Property archived successfully.'
        });
        
    } catch (error) {
        console.error('Archive property error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to archive property.'
        });
    }
});

/**
 * PUT /api/properties/:id/unarchive
 * Unarchive a property
 * 
 * @access Admin only
 */
router.put('/:id/unarchive', authenticate, requireRole('admin'), async (req, res) => {
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
        
        const property = properties[0];
        
        // Check if property is archived
        if (!property.is_archived) {
            return res.status(400).json({
                success: false,
                error: 'Property is not archived.'
            });
        }
        
        // Unarchive the property
        await db.query('UPDATE properties SET is_archived = FALSE WHERE id = ?', [id]);
        
        console.log(`[PROPERTY] Property ${id} unarchived by admin ${req.user.id}`);
        
        res.json({
            success: true,
            message: 'Property unarchived successfully.'
        });
        
    } catch (error) {
        console.error('Unarchive property error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to unarchive property.'
        });
    }
});

// Handle multer errors
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File too large. Maximum size is 5MB.'
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                error: 'Too many files. Maximum is 10 files per upload.'
            });
        }
        return res.status(400).json({
            success: false,
            error: 'File upload error: ' + error.message
        });
    }
    if (error.message && error.message.includes('Only image files')) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
    next(error);
});

module.exports = router;
