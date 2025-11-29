/**
 * Backend Unit Tests - Role-Based Authorization
 * 
 * @file roles.test.js
 * @description Tests for role-based access control (RBAC) logic.
 *              Uses Node.js built-in assert module - no external test frameworks required.
 * 
 * @usage Run from backend directory:
 *        node tests/roles.test.js
 * 
 * @note These tests run synchronously and test pure logic functions.
 *       They do not require a database connection.
 */

const assert = require('assert');

console.log('========================================');
console.log('ROLE-BASED AUTHORIZATION TESTS');
console.log('========================================\n');

/**
 * Simulates the role checking logic from middleware/auth.js
 * 
 * @param {string} userRole - User's role (customer, agent, admin)
 * @param {string[]} allowedRoles - Roles allowed for the action
 * @returns {boolean} True if user has permission
 */
function checkRole(userRole, allowedRoles) {
    return allowedRoles.includes(userRole);
}

/**
 * Simulates permission check for appointment operations
 * 
 * @param {Object} user - Current user {id, role}
 * @param {Object} appointment - Appointment {customer_id, agent_id, status}
 * @param {string} action - Action to perform (cancel, confirm, complete)
 * @returns {Object} {allowed: boolean, reason: string}
 */
function checkAppointmentPermission(user, appointment, action) {
    // Admin has full access
    if (user.role === 'admin') {
        return { allowed: true, reason: 'Admin has full access' };
    }
    
    // Agent can modify their assigned appointments
    if (user.role === 'agent') {
        if (appointment.agent_id !== user.id) {
            return { allowed: false, reason: 'Agent not assigned to this appointment' };
        }
        return { allowed: true, reason: 'Agent is assigned to this appointment' };
    }
    
    // Customer can only modify their own appointments
    if (user.role === 'customer') {
        if (appointment.customer_id !== user.id) {
            return { allowed: false, reason: 'Customer does not own this appointment' };
        }
        
        // Customers can only cancel, not confirm or complete
        if (action !== 'cancel') {
            return { allowed: false, reason: 'Customers can only cancel appointments' };
        }
        
        // Customers can only cancel pending, confirmed, or queued
        if (!['pending', 'confirmed', 'queued'].includes(appointment.status)) {
            return { allowed: false, reason: 'Cannot cancel completed or already cancelled appointments' };
        }
        
        return { allowed: true, reason: 'Customer can cancel their own appointment' };
    }
    
    return { allowed: false, reason: 'Unknown role' };
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
// ROLE CHECK TESTS
// ========================================

console.log('\n--- Role Check Tests ---\n');

runTest('Admin has admin role', () => {
    assert.strictEqual(checkRole('admin', ['admin']), true);
});

runTest('Agent has agent role', () => {
    assert.strictEqual(checkRole('agent', ['agent']), true);
});

runTest('Customer has customer role', () => {
    assert.strictEqual(checkRole('customer', ['customer']), true);
});

runTest('Admin is included in admin,agent', () => {
    assert.strictEqual(checkRole('admin', ['admin', 'agent']), true);
});

runTest('Agent is included in admin,agent', () => {
    assert.strictEqual(checkRole('agent', ['admin', 'agent']), true);
});

runTest('Customer is NOT included in admin,agent', () => {
    assert.strictEqual(checkRole('customer', ['admin', 'agent']), false);
});

runTest('Customer is NOT admin', () => {
    assert.strictEqual(checkRole('customer', ['admin']), false);
});

runTest('Unknown role is rejected', () => {
    assert.strictEqual(checkRole('unknown', ['admin', 'agent', 'customer']), false);
});

// ========================================
// APPOINTMENT PERMISSION TESTS
// ========================================

console.log('\n--- Appointment Permission Tests ---\n');

// Sample data
const customer1 = { id: 1, role: 'customer' };
const customer2 = { id: 2, role: 'customer' };
const agent1 = { id: 10, role: 'agent' };
const agent2 = { id: 11, role: 'agent' };
const admin = { id: 100, role: 'admin' };

const pendingAppointment = { customer_id: 1, agent_id: 10, status: 'pending' };
const confirmedAppointment = { customer_id: 1, agent_id: 10, status: 'confirmed' };
const completedAppointment = { customer_id: 1, agent_id: 10, status: 'completed' };
const cancelledAppointment = { customer_id: 1, agent_id: 10, status: 'cancelled' };
const queuedAppointment = { customer_id: 1, agent_id: 10, status: 'queued' };

// Customer tests
runTest('Customer CAN cancel their own pending appointment', () => {
    const result = checkAppointmentPermission(customer1, pendingAppointment, 'cancel');
    assert.strictEqual(result.allowed, true);
});

runTest('Customer CAN cancel their own confirmed appointment', () => {
    const result = checkAppointmentPermission(customer1, confirmedAppointment, 'cancel');
    assert.strictEqual(result.allowed, true);
});

runTest('Customer CAN cancel their own queued appointment', () => {
    const result = checkAppointmentPermission(customer1, queuedAppointment, 'cancel');
    assert.strictEqual(result.allowed, true);
});

runTest('Customer CANNOT cancel completed appointment', () => {
    const result = checkAppointmentPermission(customer1, completedAppointment, 'cancel');
    assert.strictEqual(result.allowed, false);
});

runTest('Customer CANNOT cancel already cancelled appointment', () => {
    const result = checkAppointmentPermission(customer1, cancelledAppointment, 'cancel');
    assert.strictEqual(result.allowed, false);
});

runTest('Customer CANNOT confirm appointment', () => {
    const result = checkAppointmentPermission(customer1, pendingAppointment, 'confirm');
    assert.strictEqual(result.allowed, false);
});

runTest('Customer CANNOT complete appointment', () => {
    const result = checkAppointmentPermission(customer1, pendingAppointment, 'complete');
    assert.strictEqual(result.allowed, false);
});

runTest('Customer CANNOT modify another customer\'s appointment', () => {
    const result = checkAppointmentPermission(customer2, pendingAppointment, 'cancel');
    assert.strictEqual(result.allowed, false);
});

// Agent tests
runTest('Agent CAN modify their assigned appointment', () => {
    const result = checkAppointmentPermission(agent1, pendingAppointment, 'confirm');
    assert.strictEqual(result.allowed, true);
});

runTest('Agent CANNOT modify another agent\'s appointment', () => {
    const result = checkAppointmentPermission(agent2, pendingAppointment, 'confirm');
    assert.strictEqual(result.allowed, false);
});

// Admin tests
runTest('Admin CAN modify any appointment', () => {
    const result = checkAppointmentPermission(admin, pendingAppointment, 'cancel');
    assert.strictEqual(result.allowed, true);
});

runTest('Admin CAN confirm any appointment', () => {
    const result = checkAppointmentPermission(admin, pendingAppointment, 'confirm');
    assert.strictEqual(result.allowed, true);
});

runTest('Admin CAN complete any appointment', () => {
    const result = checkAppointmentPermission(admin, confirmedAppointment, 'complete');
    assert.strictEqual(result.allowed, true);
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

console.log('All role-based authorization tests passed! ✅\n');
