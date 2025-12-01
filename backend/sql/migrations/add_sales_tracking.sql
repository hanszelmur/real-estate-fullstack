-- ============================================================================
-- Migration: Add Sales Tracking Columns
-- ============================================================================
-- This migration adds columns to the properties table for sales tracking:
-- - sold_by_agent_id: The agent who closed the sale (for commission tracking)
-- - sold_date: When the sale was recorded
-- - is_archived: Soft delete flag for sold/rented properties
-- ============================================================================

-- Add sales tracking columns to properties table
ALTER TABLE properties 
ADD COLUMN sold_by_agent_id INT NULL AFTER assigned_agent_id,
ADD COLUMN sold_date DATETIME NULL AFTER sold_by_agent_id,
ADD COLUMN is_archived BOOLEAN DEFAULT FALSE AFTER sold_date,
ADD FOREIGN KEY (sold_by_agent_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add indexes for sales queries
CREATE INDEX idx_sold_by_agent ON properties(sold_by_agent_id);
CREATE INDEX idx_sold_date ON properties(sold_date);
CREATE INDEX idx_is_archived ON properties(is_archived);
