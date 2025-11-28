/**
 * Authentication Utilities
 * 
 * Handles password hashing, verification, and JWT token management.
 * Uses bcryptjs for secure password hashing.
 */

const bcrypt = require('bcryptjs');

// Salt rounds for bcrypt (higher = more secure but slower)
const SALT_ROUNDS = 10;

// JWT secret from environment (simple token approach without jwt library)
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
const hashPassword = async (password) => {
    return await bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare a plain text password with a hash
 * @param {string} password - Plain text password
 * @param {string} hash - Stored password hash
 * @returns {Promise<boolean>} - True if passwords match
 */
const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

/**
 * Generate a simple session token
 * Uses base64 encoding of user data + timestamp + random component
 * Note: For production, use a proper JWT library
 * 
 * @param {object} user - User object with id, email, role
 * @returns {string} - Session token
 */
const generateToken = (user) => {
    const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        timestamp: Date.now(),
        random: Math.random().toString(36).substring(2)
    };
    
    // Simple token: base64 encoded JSON
    // In production, use proper JWT with signing
    const tokenData = JSON.stringify(payload);
    const token = Buffer.from(tokenData).toString('base64');
    
    return token;
};

/**
 * Decode and validate a session token
 * @param {string} token - Session token
 * @returns {object|null} - Decoded payload or null if invalid
 */
const decodeToken = (token) => {
    try {
        const tokenData = Buffer.from(token, 'base64').toString('utf8');
        const payload = JSON.parse(tokenData);
        
        // Check if token is not expired (24 hours validity)
        const tokenAge = Date.now() - payload.timestamp;
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        
        if (tokenAge > maxAge) {
            return null;
        }
        
        return payload;
    } catch (error) {
        return null;
    }
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} - Validation result with isValid and message
 */
const validatePassword = (password) => {
    if (!password || password.length < 6) {
        return {
            isValid: false,
            message: 'Password must be at least 6 characters long.'
        };
    }
    
    // Check for at least one letter and one number
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    if (!hasLetter || !hasNumber) {
        return {
            isValid: false,
            message: 'Password must contain at least one letter and one number.'
        };
    }
    
    return { isValid: true };
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email format
 */
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validate phone number format (basic validation)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid phone format
 */
const validatePhone = (phone) => {
    // Allow various phone formats: +1-555-555-5555, (555) 555-5555, 5555555555, etc.
    const phoneRegex = /^[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/;
    return phoneRegex.test(phone);
};

module.exports = {
    hashPassword,
    comparePassword,
    generateToken,
    decodeToken,
    validatePassword,
    validateEmail,
    validatePhone
};
