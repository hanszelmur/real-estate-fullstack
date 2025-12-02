/**
 * Authentication Middleware
 * 
 * Provides middleware functions for authenticating requests and
 * authorizing access based on user roles.
 */

const db = require('../config/database');
const { decodeToken } = require('../utils/auth');
const logger = require('../utils/logger');

/**
 * Authenticate user from request token
 * Extracts token from Authorization header and validates it.
 * Attaches user object to request if valid.
 */
const authenticate = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required. Please provide a valid token.'
            });
        }
        
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        
        // Decode and validate token
        const payload = decodeToken(token);
        
        if (!payload) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token. Please log in again.'
            });
        }
        
        // Get user from database to ensure they still exist and are active
        const users = await db.query(
            'SELECT id, email, phone, first_name, last_name, role, is_verified, is_active FROM users WHERE id = ?',
            [payload.userId]
        );
        
        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'User not found. Please log in again.'
            });
        }
        
        const user = users[0];
        
        // Check if user is active
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                error: 'Account is deactivated. Please contact support.'
            });
        }
        
        // Attach user to request object
        req.user = user;
        next();
    } catch (error) {
        logger.error('Authentication error', { error: error.message, stack: error.stack });
        return res.status(500).json({
            success: false,
            error: 'Authentication failed. Please try again.'
        });
    }
};

/**
 * Require specific roles for access
 * @param {...string} roles - Allowed roles (e.g., 'admin', 'agent', 'customer')
 * @returns {Function} - Middleware function
 */
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required.'
            });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: `Access denied. Required role: ${roles.join(' or ')}`
            });
        }
        
        next();
    };
};

/**
 * Require user to be verified (for customers)
 */
const requireVerified = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required.'
        });
    }
    
    // Admins and agents are pre-verified, only check for customers
    if (req.user.role === 'customer' && !req.user.is_verified) {
        return res.status(403).json({
            success: false,
            error: 'Phone verification required. Please verify your phone number.'
        });
    }
    
    next();
};

/**
 * Optional authentication - attaches user if token present but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }
        
        const token = authHeader.substring(7);
        const payload = decodeToken(token);
        
        if (payload) {
            const users = await db.query(
                'SELECT id, email, phone, first_name, last_name, role, is_verified, is_active FROM users WHERE id = ?',
                [payload.userId]
            );
            
            if (users.length > 0 && users[0].is_active) {
                req.user = users[0];
            }
        }
        
        next();
    } catch (error) {
        // Silently continue without authentication
        next();
    }
};

module.exports = {
    authenticate,
    requireRole,
    requireVerified,
    optionalAuth
};
