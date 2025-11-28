/**
 * Verification Utilities
 * 
 * Handles SMS verification code generation, storage, and validation.
 * In demo/development mode, codes are logged to console for manual SMS sending.
 * 
 * Features:
 * - Generate 6-digit random codes
 * - Store codes with 10-minute expiration
 * - Validate codes against stored values
 * - Support for code resend after expiry
 */

const db = require('../config/database');

// Verification code expiration time in minutes
const CODE_EXPIRATION_MINUTES = 10;

/**
 * Generate a random 6-digit verification code
 * @returns {string} - 6-digit code as string
 */
const generateCode = () => {
    // Generate a random number between 100000 and 999999
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Create and store a new verification code for a phone number
 * Logs the code to console for manual SMS sending in demo mode
 * 
 * @param {string} phone - Phone number to verify
 * @returns {Promise<object>} - Object with code and expiration details
 */
const createVerification = async (phone) => {
    // Generate new code
    const code = generateCode();
    
    // Calculate expiration time (10 minutes from now)
    const expiresAt = new Date(Date.now() + CODE_EXPIRATION_MINUTES * 60 * 1000);
    
    // Invalidate any existing unused codes for this phone
    await db.query(
        'UPDATE verifications SET is_used = TRUE WHERE phone = ? AND is_used = FALSE',
        [phone]
    );
    
    // Store new verification code
    await db.query(
        'INSERT INTO verifications (phone, code, expires_at) VALUES (?, ?, ?)',
        [phone, code, expiresAt]
    );
    
    // ============================================================================
    // DEMO/DEV MODE: Log verification code to console
    // In production, this would integrate with an SMS service
    // ============================================================================
    console.log('\n========================================');
    console.log('📱 SMS VERIFICATION CODE');
    console.log('========================================');
    console.log(`Phone: ${phone}`);
    console.log(`Code: ${code}`);
    console.log(`Expires: ${expiresAt.toISOString()}`);
    console.log('========================================');
    console.log('⚠️  Operator: Please manually send this code via SMS');
    console.log('========================================\n');
    
    return {
        phone,
        code, // Return code for testing/demo purposes
        expiresAt,
        expirationMinutes: CODE_EXPIRATION_MINUTES
    };
};

/**
 * Verify a code for a phone number
 * 
 * @param {string} phone - Phone number
 * @param {string} code - Verification code to check
 * @returns {Promise<object>} - Verification result with success status
 */
const verifyCode = async (phone, code) => {
    // Find valid (unexpired, unused) verification code for this phone
    const results = await db.query(
        `SELECT * FROM verifications 
         WHERE phone = ? AND code = ? AND is_used = FALSE AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [phone, code]
    );
    
    if (results.length === 0) {
        // Check if there's an expired code
        const expiredResults = await db.query(
            `SELECT * FROM verifications 
             WHERE phone = ? AND code = ? AND is_used = FALSE AND expires_at <= NOW()
             ORDER BY created_at DESC LIMIT 1`,
            [phone, code]
        );
        
        if (expiredResults.length > 0) {
            return {
                success: false,
                error: 'Verification code has expired. Please request a new code.',
                expired: true
            };
        }
        
        return {
            success: false,
            error: 'Invalid verification code.',
            expired: false
        };
    }
    
    // Mark code as used
    await db.query(
        'UPDATE verifications SET is_used = TRUE WHERE id = ?',
        [results[0].id]
    );
    
    return {
        success: true,
        message: 'Phone number verified successfully.'
    };
};

/**
 * Check if a phone number can request a new code
 * (prevents spam by checking last code creation time)
 * 
 * @param {string} phone - Phone number
 * @returns {Promise<object>} - Object indicating if resend is allowed
 */
const canResendCode = async (phone) => {
    // Get the most recent verification for this phone
    const results = await db.query(
        `SELECT * FROM verifications 
         WHERE phone = ? 
         ORDER BY created_at DESC LIMIT 1`,
        [phone]
    );
    
    if (results.length === 0) {
        return { canResend: true };
    }
    
    const lastVerification = results[0];
    
    // If the last code is still valid (not expired and not used), don't allow resend
    const now = new Date();
    const expiresAt = new Date(lastVerification.expires_at);
    
    if (!lastVerification.is_used && expiresAt > now) {
        const remainingTime = Math.ceil((expiresAt - now) / 1000 / 60);
        return {
            canResend: false,
            message: `A valid code was already sent. Please wait ${remainingTime} minutes or use the existing code.`,
            remainingMinutes: remainingTime
        };
    }
    
    return { canResend: true };
};

/**
 * Clean up expired verification codes (for maintenance)
 * @returns {Promise<number>} - Number of deleted records
 */
const cleanupExpiredCodes = async () => {
    const result = await db.query(
        'DELETE FROM verifications WHERE expires_at < NOW() AND is_used = FALSE'
    );
    return result.affectedRows;
};

module.exports = {
    generateCode,
    createVerification,
    verifyCode,
    canResendCode,
    cleanupExpiredCodes,
    CODE_EXPIRATION_MINUTES
};
