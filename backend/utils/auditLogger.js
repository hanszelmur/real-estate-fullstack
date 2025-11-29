/**
 * Audit Logger Utility
 * 
 * @file auditLogger.js
 * @description Simple audit logging for tracking important system events.
 *              Logs to console and optionally to a file.
 * 
 * This is a stub implementation for demonstration purposes.
 * In production, you would integrate with a proper logging service
 * (Winston, Pino, CloudWatch, etc.)
 * 
 * @usage
 * const auditLogger = require('./utils/auditLogger');
 * auditLogger.log('BOOKING_CREATED', { userId: 1, propertyId: 2 });
 * auditLogger.logRaceCondition('BOOKING', { slot: '10:00', users: [1, 2] });
 */

const fs = require('fs');
const path = require('path');

/**
 * Audit log event types for categorization
 */
const EVENT_TYPES = {
    // Authentication events
    AUTH_LOGIN: 'AUTH_LOGIN',
    AUTH_LOGOUT: 'AUTH_LOGOUT',
    AUTH_REGISTER: 'AUTH_REGISTER',
    AUTH_VERIFY: 'AUTH_VERIFY',
    AUTH_FAILED: 'AUTH_FAILED',
    
    // Booking/Appointment events
    BOOKING_CREATED: 'BOOKING_CREATED',
    BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
    BOOKING_CANCELLED: 'BOOKING_CANCELLED',
    BOOKING_COMPLETED: 'BOOKING_COMPLETED',
    BOOKING_QUEUED: 'BOOKING_QUEUED',
    BOOKING_PROMOTED: 'BOOKING_PROMOTED',
    
    // Queue/Race condition events
    QUEUE_COLLISION: 'QUEUE_COLLISION',
    QUEUE_PROMOTION: 'QUEUE_PROMOTION',
    RACE_CONDITION_DETECTED: 'RACE_CONDITION_DETECTED',
    
    // Property events
    PROPERTY_CREATED: 'PROPERTY_CREATED',
    PROPERTY_UPDATED: 'PROPERTY_UPDATED',
    PROPERTY_DELETED: 'PROPERTY_DELETED',
    
    // User management events
    USER_CREATED: 'USER_CREATED',
    USER_UPDATED: 'USER_UPDATED',
    USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
    USER_DEACTIVATED: 'USER_DEACTIVATED',
    
    // Security events
    ACCESS_DENIED: 'ACCESS_DENIED',
    FORBIDDEN_ACTION: 'FORBIDDEN_ACTION',
    
    // Rating events
    RATING_SUBMITTED: 'RATING_SUBMITTED',
    
    // System events
    SYSTEM_ERROR: 'SYSTEM_ERROR',
    NOTIFICATION_SENT: 'NOTIFICATION_SENT'
};

/**
 * Log levels for filtering and severity
 */
const LOG_LEVELS = {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    CRITICAL: 'CRITICAL'
};

/**
 * Configuration for audit logging
 */
const config = {
    // Enable console logging (always true for demo)
    consoleEnabled: true,
    
    // Enable file logging (stub - set to true to write to file)
    fileEnabled: process.env.AUDIT_LOG_FILE === 'true' || false,
    
    // Log file path
    logFilePath: process.env.AUDIT_LOG_PATH || path.join(__dirname, '../logs/audit.log'),
    
    // Minimum log level to record
    minLevel: process.env.AUDIT_LOG_LEVEL || LOG_LEVELS.INFO
};

/**
 * Format a log entry as a structured string
 * 
 * @param {string} level - Log level
 * @param {string} eventType - Type of event
 * @param {Object} data - Event data
 * @returns {string} Formatted log entry
 */
function formatLogEntry(level, eventType, data) {
    const timestamp = new Date().toISOString();
    const entry = {
        timestamp,
        level,
        eventType,
        ...data
    };
    return JSON.stringify(entry);
}

/**
 * Write log to console
 * 
 * @param {string} level - Log level
 * @param {string} eventType - Event type
 * @param {Object} data - Event data
 */
function logToConsole(level, eventType, data) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [AUDIT] [${level}]`;
    
    // Color-code based on level for console visibility
    const colors = {
        DEBUG: '\x1b[36m',    // Cyan
        INFO: '\x1b[32m',     // Green
        WARN: '\x1b[33m',     // Yellow
        ERROR: '\x1b[31m',    // Red
        CRITICAL: '\x1b[35m'  // Magenta
    };
    const reset = '\x1b[0m';
    const color = colors[level] || '';
    
    console.log(`${color}${prefix} ${eventType}${reset}`, data);
}

/**
 * Write log to file (stub implementation)
 * 
 * @param {string} logEntry - Formatted log entry
 */
function logToFile(logEntry) {
    if (!config.fileEnabled) return;
    
    try {
        // Ensure logs directory exists
        const logsDir = path.dirname(config.logFilePath);
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        
        // Append to log file
        fs.appendFileSync(config.logFilePath, logEntry + '\n');
    } catch (error) {
        console.error('[AUDIT] Failed to write to log file:', error.message);
    }
}

/**
 * Main logging function
 * 
 * @param {string} eventType - Type of event (use EVENT_TYPES constants)
 * @param {Object} data - Event data (userId, details, etc.)
 * @param {string} level - Log level (default: INFO)
 * 
 * @example
 * auditLogger.log(EVENT_TYPES.BOOKING_CREATED, {
 *     userId: 1,
 *     propertyId: 2,
 *     appointmentId: 3,
 *     slot: '2024-01-15 10:00:00'
 * });
 */
function log(eventType, data = {}, level = LOG_LEVELS.INFO) {
    // Check if we should log this level
    const levelOrder = [LOG_LEVELS.DEBUG, LOG_LEVELS.INFO, LOG_LEVELS.WARN, LOG_LEVELS.ERROR, LOG_LEVELS.CRITICAL];
    if (levelOrder.indexOf(level) < levelOrder.indexOf(config.minLevel)) {
        return;
    }
    
    // Log to console
    if (config.consoleEnabled) {
        logToConsole(level, eventType, data);
    }
    
    // Log to file
    if (config.fileEnabled) {
        const logEntry = formatLogEntry(level, eventType, data);
        logToFile(logEntry);
    }
}

/**
 * Log a race condition or collision event
 * This is specifically for booking/queue race conditions.
 * 
 * @param {string} resourceType - Type of resource (e.g., 'BOOKING', 'QUEUE')
 * @param {Object} details - Details about the collision
 * 
 * @example
 * auditLogger.logRaceCondition('BOOKING', {
 *     propertyId: 2,
 *     slot: '2024-01-15 10:00:00',
 *     firstUserId: 1,
 *     secondUserId: 2,
 *     firstTimestamp: '2024-01-14 15:30:45.123456',
 *     secondTimestamp: '2024-01-14 15:30:45.789012'
 * });
 */
function logRaceCondition(resourceType, details) {
    log(EVENT_TYPES.RACE_CONDITION_DETECTED, {
        resourceType,
        ...details,
        note: 'Multiple users attempted to access the same resource simultaneously'
    }, LOG_LEVELS.WARN);
}

/**
 * Log a queue promotion event
 * Called when a user is promoted from the queue to confirmed status.
 * 
 * @param {Object} details - Promotion details
 * 
 * @example
 * auditLogger.logQueuePromotion({
 *     appointmentId: 5,
 *     customerId: 2,
 *     propertyId: 3,
 *     slot: '2024-01-15 10:00:00',
 *     previousPosition: 1,
 *     reason: 'Previous booking cancelled'
 * });
 */
function logQueuePromotion(details) {
    log(EVENT_TYPES.QUEUE_PROMOTION, details, LOG_LEVELS.INFO);
}

/**
 * Log an access denied event
 * Called when a user attempts an action they're not authorized for.
 * 
 * @param {Object} details - Access denied details
 * 
 * @example
 * auditLogger.logAccessDenied({
 *     userId: 3,
 *     userRole: 'customer',
 *     action: 'DELETE_PROPERTY',
 *     resourceId: 5,
 *     requiredRole: 'admin'
 * });
 */
function logAccessDenied(details) {
    log(EVENT_TYPES.ACCESS_DENIED, details, LOG_LEVELS.WARN);
}

/**
 * Log an authentication event
 * 
 * @param {string} action - Auth action ('LOGIN', 'LOGOUT', 'REGISTER', 'VERIFY')
 * @param {Object} details - Event details
 * @param {boolean} success - Whether the action was successful
 * 
 * @example
 * logAuth('LOGIN', { userId: 1, email: 'user@example.com' }, true);
 * logAuth('LOGIN', { email: 'user@example.com', reason: 'Invalid password' }, false);
 */
function logAuth(action, details, success = true) {
    // Map action to valid EVENT_TYPE constant
    // This ensures we use defined event types instead of arbitrary strings
    const actionUpper = action.toUpperCase();
    const eventTypeKey = `AUTH_${actionUpper}`;
    const eventType = success 
        ? (EVENT_TYPES[eventTypeKey] || eventTypeKey)  // Use defined type if exists
        : EVENT_TYPES.AUTH_FAILED;
    const level = success ? LOG_LEVELS.INFO : LOG_LEVELS.WARN;
    log(eventType, { ...details, success }, level);
}

/**
 * Log a booking event
 * 
 * @param {string} action - Booking action ('CREATED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'QUEUED', 'PROMOTED')
 * @param {Object} details - Booking details
 * 
 * @example
 * logBooking('CREATED', { appointmentId: 1, customerId: 2, propertyId: 3 });
 */
function logBooking(action, details) {
    // Map action to valid EVENT_TYPE constant
    const actionUpper = action.toUpperCase();
    const eventTypeKey = `BOOKING_${actionUpper}`;
    const eventType = EVENT_TYPES[eventTypeKey] || eventTypeKey;
    log(eventType, details, LOG_LEVELS.INFO);
}

/**
 * Log an error
 * 
 * @param {string} context - Where the error occurred
 * @param {Error|Object} error - Error object or details
 */
function logError(context, error) {
    log(EVENT_TYPES.SYSTEM_ERROR, {
        context,
        message: error.message || error,
        stack: error.stack
    }, LOG_LEVELS.ERROR);
}

module.exports = {
    log,
    logRaceCondition,
    logQueuePromotion,
    logAccessDenied,
    logAuth,
    logBooking,
    logError,
    EVENT_TYPES,
    LOG_LEVELS
};
