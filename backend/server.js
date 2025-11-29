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
const db = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/properties');
const appointmentRoutes = require('./routes/appointments');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');
const waitlistRoutes = require('./routes/waitlist');
const ratingsRoutes = require('./routes/ratings');

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
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

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
    console.error('Server error:', err);
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
        console.log('\n🔌 Connecting to database...');
        await db.testConnection();
        
        // Start server
        app.listen(PORT, () => {
            console.log('\n========================================');
            console.log('🏠 Real Estate Backend Server');
            console.log('========================================');
            console.log(`✓ Server running on http://localhost:${PORT}`);
            console.log(`✓ API endpoints available at http://localhost:${PORT}/api`);
            console.log('========================================');
            console.log('\nAvailable endpoints:');
            console.log('  GET  /api/health');
            console.log('  POST /api/auth/register');
            console.log('  POST /api/auth/verify');
            console.log('  POST /api/auth/resend-code');
            console.log('  POST /api/auth/login');
            console.log('  GET  /api/auth/me');
            console.log('  GET  /api/properties');
            console.log('  GET  /api/properties/featured');
            console.log('  GET  /api/properties/:id');
            console.log('  POST /api/properties');
            console.log('  PUT  /api/properties/:id');
            console.log('  DELETE /api/properties/:id');
            console.log('  GET  /api/appointments');
            console.log('  GET  /api/appointments/available-slots/:propertyId');
            console.log('  GET  /api/appointments/:id');
            console.log('  POST /api/appointments');
            console.log('  PUT  /api/appointments/:id');
            console.log('  DELETE /api/appointments/:id');
            console.log('  GET  /api/users');
            console.log('  GET  /api/users/agents');
            console.log('  GET  /api/users/:id');
            console.log('  PUT  /api/users/:id');
            console.log('  GET  /api/notifications');
            console.log('  PUT  /api/notifications/:id/read');
            console.log('  PUT  /api/notifications/read-all');
            console.log('  GET  /api/waitlist');
            console.log('  POST /api/waitlist');
            console.log('  DELETE /api/waitlist/:id');
            console.log('  POST /api/ratings');
            console.log('  GET  /api/ratings/agent/:agentId');
            console.log('  GET  /api/ratings/agent/:agentId/summary');
            console.log('  GET  /api/ratings/can-rate/:appointmentId');
            console.log('========================================\n');
        });
    } catch (error) {
        console.error('Failed to start server:', error.message);
        console.log('\n⚠️  Make sure your database is running and configured correctly.');
        console.log('Check your .env file for database credentials.\n');
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down server...');
    await db.closePool();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nShutting down server...');
    await db.closePool();
    process.exit(0);
});

// Start the server
startServer();
