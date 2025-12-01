/**
 * Backend Unit Tests - Sales Tracking
 * 
 * @file sales.test.js
 * @description Tests for property sales tracking and lifecycle management logic.
 *              Uses Node.js built-in assert module - no external test frameworks required.
 * 
 * @usage Run from backend directory:
 *        node tests/sales.test.js
 * 
 * @note These tests run synchronously and test pure logic functions.
 *       They do not require a database connection.
 */

const assert = require('assert');

console.log('========================================');
console.log('SALES TRACKING LOGIC TESTS');
console.log('========================================\n');

/**
 * Simulates permission check for marking property as sold
 * 
 * @param {Object} user - Current user {id, role}
 * @param {Object} property - Property {assigned_agent_id, status}
 * @returns {Object} {allowed: boolean, reason: string}
 */
function checkMarkSoldPermission(user, property) {
    // Admin has full access
    if (user.role === 'admin') {
        return { allowed: true, reason: 'Admin has full access' };
    }
    
    // Agent can only mark their assigned properties as sold
    if (user.role === 'agent') {
        if (property.assigned_agent_id !== user.id) {
            return { allowed: false, reason: 'Agent not assigned to this property' };
        }
        return { allowed: true, reason: 'Agent is assigned to this property' };
    }
    
    // Customers cannot mark properties as sold
    if (user.role === 'customer') {
        return { allowed: false, reason: 'Customers cannot mark properties as sold' };
    }
    
    return { allowed: false, reason: 'Unknown role' };
}

/**
 * Simulates permission check for archiving a property
 * 
 * @param {Object} user - Current user {id, role}
 * @param {Object} property - Property {assigned_agent_id, status, is_archived}
 * @returns {Object} {allowed: boolean, reason: string}
 */
function checkArchivePermission(user, property) {
    // Property must be sold or rented
    if (!['sold', 'rented'].includes(property.status)) {
        return { allowed: false, reason: 'Only sold or rented properties can be archived' };
    }
    
    // Already archived
    if (property.is_archived) {
        return { allowed: false, reason: 'Property is already archived' };
    }
    
    // Admin has full access
    if (user.role === 'admin') {
        return { allowed: true, reason: 'Admin has full access' };
    }
    
    // Agent can only archive their assigned properties
    if (user.role === 'agent') {
        if (property.assigned_agent_id !== user.id) {
            return { allowed: false, reason: 'Agent not assigned to this property' };
        }
        return { allowed: true, reason: 'Agent is assigned to this property' };
    }
    
    return { allowed: false, reason: 'Insufficient permissions' };
}

/**
 * Simulates permission check for unarchiving a property
 * 
 * @param {Object} user - Current user {id, role}
 * @param {Object} property - Property {is_archived}
 * @returns {Object} {allowed: boolean, reason: string}
 */
function checkUnarchivePermission(user, property) {
    // Property must be archived
    if (!property.is_archived) {
        return { allowed: false, reason: 'Property is not archived' };
    }
    
    // Only admin can unarchive
    if (user.role === 'admin') {
        return { allowed: true, reason: 'Admin can unarchive properties' };
    }
    
    return { allowed: false, reason: 'Only admins can unarchive properties' };
}

/**
 * Determines who gets credit for the sale
 * 
 * @param {Object} user - Current user {id, role}
 * @param {number|null} requestedAgentId - Requested soldByAgentId from body
 * @returns {number} - Agent ID who gets credit
 */
function determineSaleCredit(user, requestedAgentId) {
    // Admin can specify any agent
    if (user.role === 'admin' && requestedAgentId) {
        return requestedAgentId;
    }
    // Otherwise, current user gets credit
    return user.id;
}

/**
 * Check if sales should be visible to user
 * 
 * @param {Object} user - Current user {id, role}
 * @param {Object} sale - Sale record {sold_by_agent_id}
 * @returns {boolean} - Whether user can see this sale
 */
function canViewSale(user, sale) {
    // Admin can see all sales
    if (user.role === 'admin') {
        return true;
    }
    
    // Agent can only see their own sales
    if (user.role === 'agent') {
        return sale.sold_by_agent_id === user.id;
    }
    
    // Customers cannot access sales reports
    return false;
}

// Test counter
let passed = 0;
let failed = 0;

/**
 * Run a single test case
 */
function runTest(name, testFn) {
    try {
        testFn();
        console.log(`✅ PASS: ${name}`);
        passed++;
    } catch (error) {
        console.log(`❌ FAIL: ${name}`);
        console.log(`   Error: ${error.message}`);
        failed++;
    }
}

// ========================================
// MARK AS SOLD PERMISSION TESTS
// ========================================

console.log('\n--- Mark as Sold Permission Tests ---\n');

// Sample data
const agent1 = { id: 10, role: 'agent' };
const agent2 = { id: 11, role: 'agent' };
const admin = { id: 100, role: 'admin' };
const customer = { id: 1, role: 'customer' };

const propertyAgent1 = { assigned_agent_id: 10, status: 'available' };
const propertyAgent2 = { assigned_agent_id: 11, status: 'available' };
const soldProperty = { assigned_agent_id: 10, status: 'sold', is_archived: false };
const archivedProperty = { assigned_agent_id: 10, status: 'sold', is_archived: true };

runTest('Admin CAN mark any property as sold', () => {
    const result = checkMarkSoldPermission(admin, propertyAgent1);
    assert.strictEqual(result.allowed, true);
});

runTest('Agent CAN mark their assigned property as sold', () => {
    const result = checkMarkSoldPermission(agent1, propertyAgent1);
    assert.strictEqual(result.allowed, true);
});

runTest('Agent CANNOT mark another agent\'s property as sold', () => {
    const result = checkMarkSoldPermission(agent1, propertyAgent2);
    assert.strictEqual(result.allowed, false);
});

runTest('Customer CANNOT mark property as sold', () => {
    const result = checkMarkSoldPermission(customer, propertyAgent1);
    assert.strictEqual(result.allowed, false);
});

// ========================================
// ARCHIVE PERMISSION TESTS
// ========================================

console.log('\n--- Archive Permission Tests ---\n');

runTest('Admin CAN archive sold property', () => {
    const result = checkArchivePermission(admin, soldProperty);
    assert.strictEqual(result.allowed, true);
});

runTest('Agent CAN archive their sold property', () => {
    const result = checkArchivePermission(agent1, soldProperty);
    assert.strictEqual(result.allowed, true);
});

runTest('Agent CANNOT archive another agent\'s property', () => {
    const result = checkArchivePermission(agent2, soldProperty);
    assert.strictEqual(result.allowed, false);
});

runTest('CANNOT archive available property', () => {
    const result = checkArchivePermission(admin, propertyAgent1);
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, 'Only sold or rented properties can be archived');
});

runTest('CANNOT archive already archived property', () => {
    const result = checkArchivePermission(admin, archivedProperty);
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, 'Property is already archived');
});

// ========================================
// UNARCHIVE PERMISSION TESTS
// ========================================

console.log('\n--- Unarchive Permission Tests ---\n');

runTest('Admin CAN unarchive property', () => {
    const result = checkUnarchivePermission(admin, archivedProperty);
    assert.strictEqual(result.allowed, true);
});

runTest('Agent CANNOT unarchive property', () => {
    const result = checkUnarchivePermission(agent1, archivedProperty);
    assert.strictEqual(result.allowed, false);
});

runTest('CANNOT unarchive non-archived property', () => {
    const result = checkUnarchivePermission(admin, soldProperty);
    assert.strictEqual(result.allowed, false);
});

// ========================================
// SALE CREDIT ASSIGNMENT TESTS
// ========================================

console.log('\n--- Sale Credit Assignment Tests ---\n');

runTest('Admin can assign sale credit to specific agent', () => {
    const creditTo = determineSaleCredit(admin, 15);
    assert.strictEqual(creditTo, 15);
});

runTest('Admin defaults to self if no agent specified', () => {
    const creditTo = determineSaleCredit(admin, null);
    assert.strictEqual(creditTo, 100);
});

runTest('Agent always gets credit for their own sales', () => {
    const creditTo = determineSaleCredit(agent1, 999);
    assert.strictEqual(creditTo, 10);
});

// ========================================
// SALES VISIBILITY TESTS
// ========================================

console.log('\n--- Sales Visibility Tests ---\n');

const sale1 = { sold_by_agent_id: 10 };
const sale2 = { sold_by_agent_id: 11 };

runTest('Admin can see all sales', () => {
    assert.strictEqual(canViewSale(admin, sale1), true);
    assert.strictEqual(canViewSale(admin, sale2), true);
});

runTest('Agent can see their own sales', () => {
    assert.strictEqual(canViewSale(agent1, sale1), true);
});

runTest('Agent cannot see other agent\'s sales', () => {
    assert.strictEqual(canViewSale(agent1, sale2), false);
});

runTest('Customer cannot access sales reports', () => {
    assert.strictEqual(canViewSale(customer, sale1), false);
});

// ========================================
// SUMMARY
// ========================================

console.log('\n========================================');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

// Exit with error code if any tests failed
if (failed > 0) {
    process.exit(1);
}

console.log('All sales tracking tests passed! ✅\n');
