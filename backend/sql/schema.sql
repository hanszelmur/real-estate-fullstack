-- ============================================================================
-- Real Estate Application Database Schema
-- ============================================================================
-- This script creates all necessary tables for the real estate application.
-- Run this script to set up a fresh database.
-- ============================================================================

-- Create the database (run this separately if needed)
-- CREATE DATABASE IF NOT EXISTS real_estate_db;
-- USE real_estate_db;

-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- Stores all users: customers, agents, and admins
-- role: 'customer', 'agent', 'admin'
-- is_verified: customers must verify their phone before they can log in
-- deleted_at: soft delete timestamp (NULL if not deleted)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role ENUM('customer', 'agent', 'admin') NOT NULL DEFAULT 'customer',
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_phone (phone),
    INDEX idx_deleted_at (deleted_at)
);

-- ============================================================================
-- VERIFICATIONS TABLE
-- ============================================================================
-- Stores phone verification codes for customer registration
-- code: 6-digit verification code
-- expires_at: code expires 10 minutes after creation
-- is_used: set to true once code is verified
-- ============================================================================
CREATE TABLE IF NOT EXISTS verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone (phone),
    INDEX idx_code (code),
    INDEX idx_expires (expires_at)
);

-- ============================================================================
-- PROPERTIES TABLE
-- ============================================================================
-- Stores all real estate property listings
-- status: 'available', 'pending', 'sold', 'rented'
-- type: 'house', 'apartment', 'condo', 'land', 'commercial'
-- listing_type: 'sale', 'rent'
-- sold_by_agent_id: Agent who closed the sale (for commission tracking)
-- sold_date: When the sale was recorded
-- is_archived: Soft delete for reporting (hides from customer listings)
-- deleted_at: soft delete timestamp (NULL if not deleted)
-- ============================================================================
CREATE TABLE IF NOT EXISTS properties (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    address VARCHAR(500) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    zip_code VARCHAR(20) NOT NULL,
    price DECIMAL(15, 2) NOT NULL,
    property_type ENUM('house', 'apartment', 'condo', 'land', 'commercial') NOT NULL,
    listing_type ENUM('sale', 'rent') NOT NULL,
    bedrooms INT DEFAULT 0,
    bathrooms DECIMAL(3, 1) DEFAULT 0,
    square_feet INT DEFAULT 0,
    lot_size DECIMAL(10, 2) DEFAULT 0,
    year_built INT,
    status ENUM('available', 'pending', 'sold', 'rented') DEFAULT 'available',
    featured BOOLEAN DEFAULT FALSE,
    image_url VARCHAR(500),
    created_by INT,
    assigned_agent_id INT,
    sold_by_agent_id INT,
    sold_date DATETIME,
    is_archived BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_city (city),
    INDEX idx_price (price),
    INDEX idx_property_type (property_type),
    INDEX idx_listing_type (listing_type),
    INDEX idx_sold_by_agent (sold_by_agent_id),
    INDEX idx_sold_date (sold_date),
    INDEX idx_is_archived (is_archived),
    INDEX idx_deleted_at (deleted_at),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_agent_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (sold_by_agent_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- APPOINTMENTS TABLE
-- ============================================================================
-- Stores property viewing appointments/bookings
-- status: 'pending', 'confirmed', 'completed', 'cancelled', 'queued'
-- booking_timestamp: Full datetime with seconds precision for double-booking prevention
-- queue_position: Position in queue (NULL if confirmed, 0+ if queued)
-- ============================================================================
CREATE TABLE IF NOT EXISTS appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    property_id INT NOT NULL,
    customer_id INT NOT NULL,
    agent_id INT,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    booking_timestamp DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    status ENUM('pending', 'confirmed', 'completed', 'cancelled', 'queued') DEFAULT 'pending',
    queue_position INT DEFAULT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_property (property_id),
    INDEX idx_customer (customer_id),
    INDEX idx_agent (agent_id),
    INDEX idx_date (appointment_date),
    INDEX idx_status (status),
    INDEX idx_booking_timestamp (booking_timestamp),
    INDEX idx_slot (property_id, appointment_date, appointment_time),
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- WAITLIST TABLE
-- ============================================================================
-- Stores customers waiting for property availability
-- ============================================================================
CREATE TABLE IF NOT EXISTS waitlist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    property_id INT NOT NULL,
    customer_id INT NOT NULL,
    position INT NOT NULL,
    status ENUM('waiting', 'notified', 'expired') DEFAULT 'waiting',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_property (property_id),
    INDEX idx_customer (customer_id),
    INDEX idx_position (position),
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_property_customer (property_id, customer_id)
);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
-- Stores notifications for users
-- type: 'appointment', 'property', 'verification', 'system'
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('appointment', 'property', 'verification', 'system') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_type (type),
    INDEX idx_read (is_read),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- AGENT_ASSIGNMENTS TABLE
-- ============================================================================
-- Tracks agent assignments to properties (for workload management)
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_id INT NOT NULL,
    property_id INT NOT NULL,
    assigned_by INT,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active', 'completed', 'reassigned') DEFAULT 'active',
    INDEX idx_agent (agent_id),
    INDEX idx_property (property_id),
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_agent_property (agent_id, property_id)
);

-- ============================================================================
-- AGENT_RATINGS TABLE
-- ============================================================================
-- Stores customer ratings for agents after completed viewings
-- rating: 1-5 stars
-- One rating per appointment (after completion), prevents duplicates and self-ratings
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_id INT NOT NULL,
    customer_id INT NOT NULL,
    appointment_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_agent (agent_id),
    INDEX idx_customer (customer_id),
    INDEX idx_appointment (appointment_id),
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    UNIQUE KEY unique_appointment_rating (appointment_id)
);

-- ============================================================================
-- BLOCKED_SLOTS TABLE
-- ============================================================================
-- Stores blocked time slots for properties (agent unavailability, maintenance, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS blocked_slots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    property_id INT NOT NULL,
    blocked_date DATE NOT NULL,
    blocked_time TIME NOT NULL,
    reason VARCHAR(255),
    blocked_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_property (property_id),
    INDEX idx_date (blocked_date),
    INDEX idx_slot (property_id, blocked_date, blocked_time),
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_blocked_slot (property_id, blocked_date, blocked_time)
);

-- ============================================================================
-- PROPERTY_PHOTOS TABLE
-- ============================================================================
-- Stores uploaded property images (supports multiple images per property)
-- filename: Name of the file stored on disk (e.g., property-1-1234567890.jpg)
-- is_primary: Flag to indicate main property image shown in listings
-- display_order: Order in which images appear in gallery (lower = first)
-- ============================================================================
CREATE TABLE IF NOT EXISTS property_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    property_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    uploaded_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_property (property_id),
    INDEX idx_primary (property_id, is_primary),
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================
-- Stores two-way messages between users (customer-agent, customer-admin)
-- parent_id: For threaded replies, references the message being replied to
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    recipient_id INT NOT NULL,
    parent_id INT DEFAULT NULL,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sender (sender_id),
    INDEX idx_recipient (recipient_id),
    INDEX idx_parent (parent_id),
    INDEX idx_read (recipient_id, is_read),
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES messages(id) ON DELETE SET NULL
);

-- ============================================================================
-- FAVORITES TABLE
-- ============================================================================
-- Stores customer saved/favorited properties for later viewing
-- ============================================================================
CREATE TABLE IF NOT EXISTS favorites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    property_id INT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_customer (customer_id),
    INDEX idx_property (property_id),
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    UNIQUE KEY unique_favorite (customer_id, property_id)
);
