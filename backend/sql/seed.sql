-- ============================================================================
-- Real Estate Application Seed Data
-- ============================================================================
-- This script inserts initial data for DEMO/DEVELOPMENT purposes ONLY.
-- Includes: admin user, agent users, and sample properties.
-- 
-- ⚠️  SECURITY WARNING - FOR DEVELOPMENT/DEMO USE ONLY ⚠️
-- These credentials are hardcoded and publicly known.
-- NEVER use these credentials in a production environment!
-- Create new admin/agent accounts with strong passwords before deployment.
-- 
-- DEFAULT CREDENTIALS (CHANGE BEFORE PRODUCTION!):
-- Admin: admin@realestate.com / admin123
-- Agent1: agent1@realestate.com / agent123
-- Agent2: agent2@realestate.com / agent123
-- ============================================================================

-- ============================================================================
-- SEED USERS: Admin and Agents
-- ============================================================================
-- Password hashes are bcrypt hashes of the passwords mentioned above
-- Admin password: admin123
-- Agent password: agent123
-- ============================================================================

-- Admin user (pre-verified, active)
INSERT INTO users (email, password_hash, phone, first_name, last_name, role, is_verified, is_active)
VALUES (
    'admin@realestate.com',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/n3.a2D3xDfZ3.i.oq.iky', -- admin123
    '+1-555-000-0001',
    'System',
    'Administrator',
    'admin',
    TRUE,
    TRUE
);

-- Agent 1 (pre-verified, active)
INSERT INTO users (email, password_hash, phone, first_name, last_name, role, is_verified, is_active)
VALUES (
    'agent1@realestate.com',
    '$2a$10$6Bnv6HwV6uJLh6TwF3rNMeAoK5cXdYdp8rJY7e9oXK8tP3g5UVEWW', -- agent123
    '+1-555-000-0002',
    'John',
    'Smith',
    'agent',
    TRUE,
    TRUE
);

-- Agent 2 (pre-verified, active)
INSERT INTO users (email, password_hash, phone, first_name, last_name, role, is_verified, is_active)
VALUES (
    'agent2@realestate.com',
    '$2a$10$6Bnv6HwV6uJLh6TwF3rNMeAoK5cXdYdp8rJY7e9oXK8tP3g5UVEWW', -- agent123
    '+1-555-000-0003',
    'Sarah',
    'Johnson',
    'agent',
    TRUE,
    TRUE
);

-- ============================================================================
-- SEED PROPERTIES
-- ============================================================================
-- Sample property listings for demo purposes
-- ============================================================================

INSERT INTO properties (title, description, address, city, state, zip_code, price, property_type, listing_type, bedrooms, bathrooms, square_feet, lot_size, year_built, status, featured, assigned_agent_id)
VALUES
-- Featured properties
('Modern Downtown Condo', 'Stunning modern condo with city views, open floor plan, and high-end finishes. Walking distance to restaurants and entertainment.', '123 Main Street, Unit 4B', 'Seattle', 'WA', '98101', 450000.00, 'condo', 'sale', 2, 2.0, 1200, 0.00, 2019, 'available', TRUE, 2),

('Spacious Family Home', 'Beautiful 4-bedroom family home with large backyard, updated kitchen, and hardwood floors throughout. Great school district!', '456 Oak Avenue', 'Bellevue', 'WA', '98004', 875000.00, 'house', 'sale', 4, 3.0, 2800, 0.25, 2005, 'available', TRUE, 2),

('Luxury Waterfront Estate', 'Exceptional waterfront property with private dock, gourmet kitchen, home theater, and breathtaking views. Must see!', '789 Lakeshore Drive', 'Kirkland', 'WA', '98033', 2500000.00, 'house', 'sale', 5, 4.5, 5200, 1.20, 2015, 'available', TRUE, 3),

-- Regular listings
('Cozy Studio Apartment', 'Charming studio apartment perfect for young professionals. Recently renovated with modern appliances.', '321 Pine Street, Apt 2A', 'Seattle', 'WA', '98102', 1500.00, 'apartment', 'rent', 0, 1.0, 450, 0.00, 1985, 'available', FALSE, 2),

('Commercial Office Space', 'Prime commercial space in business district. Open layout, ample parking, fiber internet ready.', '555 Commerce Blvd, Suite 100', 'Seattle', 'WA', '98104', 5000.00, 'commercial', 'rent', 0, 2.0, 3000, 0.00, 2010, 'available', FALSE, 3),

('Starter Home', 'Perfect starter home for first-time buyers. 3 bedrooms, 2 baths, attached garage. Move-in ready!', '222 Maple Lane', 'Renton', 'WA', '98055', 425000.00, 'house', 'sale', 3, 2.0, 1600, 0.15, 1998, 'available', FALSE, 2),

('Urban Loft', 'Industrial-style loft with exposed brick, high ceilings, and designer finishes. Pet-friendly building.', '888 Industrial Way, Unit 12', 'Seattle', 'WA', '98134', 2200.00, 'apartment', 'rent', 1, 1.0, 900, 0.00, 2008, 'available', FALSE, 3),

('Investment Property', 'Duplex with excellent rental history. Both units currently occupied. Great cash flow opportunity.', '444 Investment Road', 'Tacoma', 'WA', '98402', 550000.00, 'house', 'sale', 4, 3.0, 2200, 0.20, 1975, 'pending', FALSE, 2),

('Building Lot', 'Prime building lot in established neighborhood. Utilities at street. Approved for single-family residence.', '999 Future Drive', 'Issaquah', 'WA', '98027', 175000.00, 'land', 'sale', 0, 0.0, 0, 0.50, NULL, 'available', FALSE, 3),

('Executive Townhouse', '3-story townhouse with rooftop deck. High-end finishes, 2-car garage, smart home features.', '666 Executive Lane', 'Redmond', 'WA', '98052', 725000.00, 'condo', 'sale', 3, 2.5, 2100, 0.05, 2020, 'available', FALSE, 2);

-- ============================================================================
-- SEED AGENT ASSIGNMENTS
-- ============================================================================
-- Assign agents to properties
-- ============================================================================

INSERT INTO agent_assignments (agent_id, property_id, assigned_by, status)
SELECT 2, id, 1, 'active' FROM properties WHERE assigned_agent_id = 2;

INSERT INTO agent_assignments (agent_id, property_id, assigned_by, status)
SELECT 3, id, 1, 'active' FROM properties WHERE assigned_agent_id = 3;

-- ============================================================================
-- SEED PROPERTY PHOTOS (Sample placeholders)
-- ============================================================================
-- Note: These are placeholder references. In production, actual files would
-- be uploaded and stored in backend/uploads/images/
-- The seed demonstrates the data structure; real images should be uploaded
-- via the API endpoints.
-- ============================================================================

-- Property 1: Modern Downtown Condo (using existing image_url as reference)
INSERT INTO property_photos (property_id, filename, original_filename, is_primary, display_order, uploaded_by)
VALUES (1, 'sample-condo-1.jpg', 'condo-main.jpg', TRUE, 0, 1);

-- Property 2: Spacious Family Home
INSERT INTO property_photos (property_id, filename, original_filename, is_primary, display_order, uploaded_by)
VALUES (2, 'sample-house-1.jpg', 'family-home.jpg', TRUE, 0, 1);

-- Property 3: Luxury Waterfront Estate (multiple images)
INSERT INTO property_photos (property_id, filename, original_filename, is_primary, display_order, uploaded_by)
VALUES 
    (3, 'sample-estate-1.jpg', 'waterfront-main.jpg', TRUE, 0, 1),
    (3, 'sample-estate-2.jpg', 'waterfront-dock.jpg', FALSE, 1, 1),
    (3, 'sample-estate-3.jpg', 'waterfront-interior.jpg', FALSE, 2, 1);
