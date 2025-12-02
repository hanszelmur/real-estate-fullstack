/**
 * Authentication Routes
 * 
 * Handles user registration, login, verification, and password management.
 * 
 * Endpoints:
 * - POST /api/auth/register - Customer registration (starts verification)
 * - POST /api/auth/verify - Verify phone number with code
 * - POST /api/auth/resend-code - Resend verification code
 * - POST /api/auth/login - User login (all roles)
 * - GET /api/auth/me - Get current user profile
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { hashPassword, comparePassword, generateToken, validatePassword, validateEmail, validatePhone } = require('../utils/auth');
const { createVerification, verifyCode, canResendCode } = require('../utils/verification');
const { authenticate, requireVerified } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * POST /api/auth/register
 * Register a new customer account
 * 
 * Body: { email, password, phone, firstName, lastName }
 * Response: { success, message, verificationSent }
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password, phone, firstName, lastName } = req.body;
        
        // Validate required fields
        if (!email || !password || !phone || !firstName || !lastName) {
            return res.status(400).json({
                success: false,
                error: 'All fields are required: email, password, phone, firstName, lastName'
            });
        }
        
        // Validate email format
        if (!validateEmail(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format.'
            });
        }
        
        // Validate password strength
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                success: false,
                error: passwordValidation.message
            });
        }
        
        // Validate phone format
        if (!validatePhone(phone)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number format.'
            });
        }
        
        // Check if email already exists
        const existingUsers = await db.query(
            'SELECT id FROM users WHERE email = ?',
            [email.toLowerCase()]
        );
        
        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'An account with this email already exists.'
            });
        }
        
        // Check if phone already exists
        const existingPhones = await db.query(
            'SELECT id FROM users WHERE phone = ?',
            [phone]
        );
        
        if (existingPhones.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'An account with this phone number already exists.'
            });
        }
        
        // Hash password
        const passwordHash = await hashPassword(password);
        
        // Create user (unverified)
        const result = await db.query(
            `INSERT INTO users (email, password_hash, phone, first_name, last_name, role, is_verified) 
             VALUES (?, ?, ?, ?, ?, 'customer', FALSE)`,
            [email.toLowerCase(), passwordHash, phone, firstName, lastName]
        );
        
        // Create verification code and log it to console
        const verification = await createVerification(phone);
        
        res.status(201).json({
            success: true,
            message: 'Account created. Please verify your phone number with the code sent via SMS.',
            userId: result.insertId,
            verificationSent: true,
            expiresInMinutes: verification.expirationMinutes
        });
        
    } catch (error) {
        logger.error('Registration error', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            error: 'Registration failed. Please try again.'
        });
    }
});

/**
 * POST /api/auth/verify
 * Verify phone number with verification code
 * 
 * Body: { phone, code }
 * Response: { success, message, token, user }
 */
router.post('/verify', async (req, res) => {
    try {
        const { phone, code } = req.body;
        
        if (!phone || !code) {
            return res.status(400).json({
                success: false,
                error: 'Phone number and verification code are required.'
            });
        }
        
        // Verify the code
        const verificationResult = await verifyCode(phone, code);
        
        if (!verificationResult.success) {
            return res.status(400).json({
                success: false,
                error: verificationResult.error,
                expired: verificationResult.expired || false
            });
        }
        
        // Update user as verified
        await db.query(
            'UPDATE users SET is_verified = TRUE WHERE phone = ?',
            [phone]
        );
        
        // Get user data
        const users = await db.query(
            'SELECT id, email, phone, first_name, last_name, role, is_verified FROM users WHERE phone = ?',
            [phone]
        );
        
        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found.'
            });
        }
        
        const user = users[0];
        
        // Generate token
        const token = generateToken(user);
        
        res.json({
            success: true,
            message: 'Phone number verified successfully. You are now logged in.',
            token,
            user: {
                id: user.id,
                email: user.email,
                phone: user.phone,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role
            }
        });
        
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Verification failed. Please try again.'
        });
    }
});

/**
 * POST /api/auth/resend-code
 * Resend verification code (after expiry)
 * 
 * Body: { phone }
 * Response: { success, message, expiresInMinutes }
 */
router.post('/resend-code', async (req, res) => {
    try {
        const { phone } = req.body;
        
        if (!phone) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required.'
            });
        }
        
        // Check if user exists and is unverified
        const users = await db.query(
            'SELECT id, is_verified FROM users WHERE phone = ?',
            [phone]
        );
        
        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No account found with this phone number.'
            });
        }
        
        if (users[0].is_verified) {
            return res.status(400).json({
                success: false,
                error: 'This phone number is already verified.'
            });
        }
        
        // Check if resend is allowed
        const resendCheck = await canResendCode(phone);
        
        if (!resendCheck.canResend) {
            return res.status(429).json({
                success: false,
                error: resendCheck.message,
                remainingMinutes: resendCheck.remainingMinutes
            });
        }
        
        // Create new verification code
        const verification = await createVerification(phone);
        
        res.json({
            success: true,
            message: 'New verification code sent. Please check your SMS.',
            expiresInMinutes: verification.expirationMinutes
        });
        
    } catch (error) {
        console.error('Resend code error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to resend code. Please try again.'
        });
    }
});

/**
 * POST /api/auth/login
 * Login for all user roles
 * 
 * Body: { email, password }
 * Response: { success, token, user }
 * 
 * ⚠️  PRODUCTION NOTE: This endpoint should have rate limiting to prevent
 * brute force attacks. Consider using express-rate-limit middleware.
 * Example: app.use('/api/auth/login', rateLimit({ windowMs: 15*60*1000, max: 5 }))
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required.'
            });
        }
        
        // Find user by email
        const users = await db.query(
            'SELECT id, email, password_hash, phone, first_name, last_name, role, is_verified, is_active FROM users WHERE email = ?',
            [email.toLowerCase()]
        );
        
        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password.'
            });
        }
        
        const user = users[0];
        
        // Check if account is active
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                error: 'Account is deactivated. Please contact support.'
            });
        }
        
        // Verify password
        const passwordValid = await comparePassword(password, user.password_hash);
        
        if (!passwordValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password.'
            });
        }
        
        // For customers, check if verified
        if (user.role === 'customer' && !user.is_verified) {
            // Send a new verification code
            const verification = await createVerification(user.phone);
            
            return res.status(403).json({
                success: false,
                error: 'Phone verification required. A new verification code has been sent.',
                requiresVerification: true,
                phone: user.phone,
                expiresInMinutes: verification.expirationMinutes
            });
        }
        
        // Generate token
        const token = generateToken(user);
        
        res.json({
            success: true,
            message: 'Login successful.',
            token,
            user: {
                id: user.id,
                email: user.email,
                phone: user.phone,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role
            }
        });
        
    } catch (error) {
        logger.error('Login error', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            error: 'Login failed. Please try again.'
        });
    }
});

/**
 * GET /api/auth/me
 * Get current user profile
 * Requires authentication
 * 
 * Response: { success, user }
 */
router.get('/me', authenticate, async (req, res) => {
    try {
        res.json({
            success: true,
            user: {
                id: req.user.id,
                email: req.user.email,
                phone: req.user.phone,
                firstName: req.user.first_name,
                lastName: req.user.last_name,
                role: req.user.role,
                isVerified: req.user.is_verified
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get profile. Please try again.'
        });
    }
});

/**
 * POST /api/auth/forgot-password
 * Request a password reset code
 * 
 * Body: { email }
 * Response: { success, message }
 * 
 * This sends a reset code to the user's registered phone number.
 * In production, this could also send an email with a reset link.
 */
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required.'
            });
        }
        
        // Find user by email
        const users = await db.query(
            'SELECT id, phone, first_name FROM users WHERE email = ? AND is_active = TRUE',
            [email.toLowerCase()]
        );
        
        // Always return success to prevent email enumeration
        if (users.length === 0) {
            // Log attempt but don't reveal user doesn't exist
            logger.info('Password reset requested for non-existent email', { email });
            return res.json({
                success: true,
                message: 'If this email exists in our system, a reset code has been sent to the registered phone number.'
            });
        }
        
        const user = users[0];
        
        // Create verification code for password reset
        const verification = await createVerification(user.phone);
        
        logger.info('Password reset code created', { userId: user.id, email });
        
        res.json({
            success: true,
            message: 'If this email exists in our system, a reset code has been sent to the registered phone number.',
            // Only include phone hint in dev mode
            phoneHint: process.env.NODE_ENV !== 'production' ? user.phone.slice(-4) : undefined
        });
        
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process request. Please try again.'
        });
    }
});

/**
 * POST /api/auth/reset-password
 * Reset password with verification code
 * 
 * Body: { email, code, newPassword }
 * Response: { success, message }
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        
        if (!email || !code || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Email, code, and new password are required.'
            });
        }
        
        // Validate password strength
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                success: false,
                error: passwordValidation.message
            });
        }
        
        // Find user by email
        const users = await db.query(
            'SELECT id, phone FROM users WHERE email = ? AND is_active = TRUE',
            [email.toLowerCase()]
        );
        
        if (users.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email or code.'
            });
        }
        
        const user = users[0];
        
        // Verify the code
        const isValidCode = await verifyCode(user.phone, code);
        
        if (!isValidCode) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired reset code.'
            });
        }
        
        // Hash new password
        const passwordHash = await hashPassword(newPassword);
        
        // Update password
        await db.query(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [passwordHash, user.id]
        );
        
        logger.info('Password reset successful', { userId: user.id });
        
        res.json({
            success: true,
            message: 'Password reset successfully. You can now login with your new password.'
        });
        
    } catch (error) {
        logger.error('Reset password error', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            error: 'Failed to reset password. Please try again.'
        });
    }
});

module.exports = router;
