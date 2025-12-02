/**
 * Real Estate Backend Server
 * 
 * Main entry point for the Express API server.
 * Handles all REST API endpoints for the real estate application.
 * 
 * Features:
 * - User authentication (customer, agent, admin roles)
 * - SMS verification for customer registration
 * - Property listings management
 * - Appointment booking system
 * - Waitlist/queue management
 * - Notifications
 */

// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const db = require('./config/database');
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/properties');
const appointmentRoutes = require('./routes/appointments');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');
const waitlistRoutes = require('./routes/waitlist');
const ratingsRoutes = require('./routes/ratings');
const messagesRoutes = require('./routes/messages');
const favoritesRoutes = require('./routes/favorites');
const analyticsRoutes = require('./routes/analytics');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// Middleware
// ============================================================================

// Enable CORS for all frontend applications
app.use(cors({
    origin: [
        'http://localhost:3001', // Customer frontend
        'http://localhost:3002', // Agent frontend
        'http://localhost:3003', // Admin frontend
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3002',
        'http://127.0.0.1:3003'
    ],
    credentials: true
}));

// Serve uploaded images as static files
// Images are accessible at /uploads/images/filename.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('HTTP Request', {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('user-agent')
        });
    });
    
    next();
});

// ============================================================================
// Rate Limiting
// ============================================================================

// General rate limiter: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: 'Too many requests, please try again later.'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false // Disable the `X-RateLimit-*` headers
});

// Auth rate limiter: 5 attempts per 15 minutes per IP (for login/register)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: {
        success: false,
        error: 'Too many authentication attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Apply general rate limiter to all API routes
app.use('/api', generalLimiter);

// Apply stricter rate limiter to auth endpoints
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ============================================================================
// API Routes
// ============================================================================

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Real Estate API is running',
        timestamp: new Date().toISOString()
    });
});

// Mount route handlers
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/analytics', analyticsRoutes);

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler for unknown routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Global error handler
app.use((err, req, res, next) => {
    logger.error('Server error', { 
        error: err.message, 
        stack: err.stack,
        path: req.path,
        method: req.method
    });
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// ============================================================================
// Server Startup
// ============================================================================

const startServer = async () => {
    try {
        // Test database connection
        logger.info('Connecting to database...');
        await db.testConnection();
        
        // Start server
        app.listen(PORT, () => {
            logger.info('Real Estate Backend Server started', {
                port: PORT,
                apiUrl: `http://localhost:${PORT}/api`
            });
            logger.info('Available endpoints', {
                health: 'GET /api/health',
                auth: ['POST /api/auth/register', 'POST /api/auth/verify', 'POST /api/auth/resend-code', 'POST /api/auth/login', 'GET /api/auth/me'],
                properties: ['GET /api/properties', 'GET /api/properties/featured', 'GET /api/properties/:id', 'POST /api/properties', 'PUT /api/properties/:id', 'DELETE /api/properties/:id'],
                appointments: ['GET /api/appointments', 'GET /api/appointments/available-slots/:propertyId', 'GET /api/appointments/:id', 'POST /api/appointments', 'PUT /api/appointments/:id', 'DELETE /api/appointments/:id'],
                users: ['GET /api/users', 'GET /api/users/agents', 'GET /api/users/:id', 'PUT /api/users/:id'],
                notifications: ['GET /api/notifications', 'PUT /api/notifications/:id/read', 'PUT /api/notifications/read-all'],
                waitlist: ['GET /api/waitlist', 'POST /api/waitlist', 'DELETE /api/waitlist/:id'],
                ratings: ['POST /api/ratings', 'GET /api/ratings/agent/:agentId', 'GET /api/ratings/agent/:agentId/summary', 'GET /api/ratings/can-rate/:appointmentId']
            });
        });
    } catch (error) {
        logger.error('Failed to start server', { 
            error: error.message,
            hint: 'Make sure your database is running and configured correctly. Check your .env file for database credentials.'
        });
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Shutting down server...');
    await db.closePool();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Shutting down server...');
    await db.closePool();
    process.exit(0);
});

// Start the server
startServer();
