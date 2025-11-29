/**
 * Backend Unit Tests - Booking Business Logic
 * 
 * @file bookings.test.js
 * @description Tests for booking validation, constraints, and business rules.
 *              Uses Node.js built-in assert module - no external test frameworks required.
 * 
 * @usage Run from backend directory:
 *        node tests/bookings.test.js
 * 
 * @note These tests run synchronously and test pure logic functions.
 *       They do not require a database connection.
 */

const assert = require('assert');

console.log('========================================');
console.log('BOOKING BUSINESS LOGIC TESTS');
console.log('========================================\n');

/**
 * Validate required booking fields
 * Simulates validation logic from POST /appointments
 * 
 * @param {Object} booking - Booking data
 * @returns {Object} {valid: boolean, errors: string[]}
 */
function validateBookingFields(booking) {
    const errors = [];
    
    if (!booking.propertyId) {
        errors.push('Property ID is required');
    }
    
    if (!booking.appointmentDate) {
        errors.push('Appointment date is required');
    }
    
    if (!booking.appointmentTime) {
        errors.push('Appointment time is required');
    }
    
    // Validate date format (YYYY-MM-DD)
    if (booking.appointmentDate && !/^\d{4}-\d{2}-\d{2}$/.test(booking.appointmentDate)) {
        errors.push('Invalid date format. Use YYYY-MM-DD');
    }
    
    // Validate time format (HH:MM:SS)
    if (booking.appointmentTime && !/^\d{2}:\d{2}:\d{2}$/.test(booking.appointmentTime)) {
        errors.push('Invalid time format. Use HH:MM:SS');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Check if a date is in the past
 * 
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @returns {boolean} True if date is in the past
 */
function isDateInPast(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
}

/**
 * Check if a time slot is valid (business hours: 9 AM - 5 PM)
 * 
 * @param {string} timeStr - Time string (HH:MM:SS)
 * @returns {boolean} True if within business hours
 */
function isValidBusinessHours(timeStr) {
    const [hours] = timeStr.split(':').map(Number);
    return hours >= 9 && hours <= 17;
}

/**
 * Validate booking status transition
 * 
 * @param {string} currentStatus - Current booking status
 * @param {string} newStatus - New status to transition to
 * @param {string} userRole - Role of user making the change
 * @returns {Object} {valid: boolean, reason: string}
 */
function validateStatusTransition(currentStatus, newStatus, userRole) {
    // Define valid transitions by role
    const transitions = {
        customer: {
            pending: ['cancelled'],
            confirmed: ['cancelled'],
            queued: ['cancelled'],
            completed: [],
            cancelled: []
        },
        agent: {
            pending: ['confirmed', 'cancelled'],
            confirmed: ['completed', 'cancelled'],
            queued: ['cancelled'],
            completed: [],
            cancelled: []
        },
        admin: {
            pending: ['confirmed', 'cancelled', 'completed', 'queued'],
            confirmed: ['completed', 'cancelled', 'pending'],
            queued: ['confirmed', 'cancelled', 'pending'],
            completed: ['confirmed', 'cancelled'], // Admin can re-open
            cancelled: ['pending'] // Admin can re-open
        }
    };
    
    const allowedTransitions = transitions[userRole]?.[currentStatus] || [];
    
    if (currentStatus === newStatus) {
        return { valid: true, reason: 'No status change' };
    }
    
    if (allowedTransitions.includes(newStatus)) {
        return { valid: true, reason: `${userRole} can change ${currentStatus} to ${newStatus}` };
    }
    
    return {
        valid: false,
        reason: `${userRole} cannot change ${currentStatus} to ${newStatus}. Allowed: ${allowedTransitions.join(', ') || 'none'}`
    };
}

/**
 * Check if customer can book a property
 * 
 * @param {Object} customer - Customer object
 * @param {Object} property - Property object
 * @param {Object[]} existingBookings - Customer's existing bookings for this property
 * @returns {Object} {canBook: boolean, reason: string}
 */
function canCustomerBook(customer, property, existingBookings) {
    // Check if customer is verified
    if (!customer.isVerified) {
        return { canBook: false, reason: 'Customer must verify phone number first' };
    }
    
    // Check if customer is active
    if (!customer.isActive) {
        return { canBook: false, reason: 'Customer account is deactivated' };
    }
    
    // Check if property is available
    if (property.status !== 'available') {
        return { canBook: false, reason: `Property is ${property.status}, not available for booking` };
    }
    
    // Check for existing active booking
    const activeBooking = existingBookings.find(b => 
        ['pending', 'confirmed', 'queued'].includes(b.status)
    );
    
    if (activeBooking) {
        return { 
            canBook: false, 
            reason: `Customer already has a ${activeBooking.status} booking for this property` 
        };
    }
    
    return { canBook: true, reason: 'Customer can book this property' };
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
// FIELD VALIDATION TESTS
// ========================================

console.log('\n--- Field Validation Tests ---\n');

runTest('Valid booking passes validation', () => {
    const booking = {
        propertyId: 1,
        appointmentDate: '2024-06-15',
        appointmentTime: '10:00:00'
    };
    const result = validateBookingFields(booking);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
});

runTest('Missing propertyId fails validation', () => {
    const booking = {
        appointmentDate: '2024-06-15',
        appointmentTime: '10:00:00'
    };
    const result = validateBookingFields(booking);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.includes('Property ID is required'));
});

runTest('Missing date fails validation', () => {
    const booking = {
        propertyId: 1,
        appointmentTime: '10:00:00'
    };
    const result = validateBookingFields(booking);
    assert.strictEqual(result.valid, false);
});

runTest('Missing time fails validation', () => {
    const booking = {
        propertyId: 1,
        appointmentDate: '2024-06-15'
    };
    const result = validateBookingFields(booking);
    assert.strictEqual(result.valid, false);
});

runTest('Invalid date format fails validation', () => {
    const booking = {
        propertyId: 1,
        appointmentDate: '06-15-2024', // Wrong format
        appointmentTime: '10:00:00'
    };
    const result = validateBookingFields(booking);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.includes('Invalid date format. Use YYYY-MM-DD'));
});

runTest('Invalid time format fails validation', () => {
    const booking = {
        propertyId: 1,
        appointmentDate: '2024-06-15',
        appointmentTime: '10:00' // Missing seconds
    };
    const result = validateBookingFields(booking);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.includes('Invalid time format. Use HH:MM:SS'));
});

// ========================================
// DATE/TIME VALIDATION TESTS
// ========================================

console.log('\n--- Date/Time Validation Tests ---\n');

runTest('Past date is detected', () => {
    assert.strictEqual(isDateInPast('2020-01-01'), true);
});

runTest('Future date is not past', () => {
    assert.strictEqual(isDateInPast('2030-01-01'), false);
});

runTest('9:00 AM is valid business hours', () => {
    assert.strictEqual(isValidBusinessHours('09:00:00'), true);
});

runTest('5:00 PM is valid business hours', () => {
    assert.strictEqual(isValidBusinessHours('17:00:00'), true);
});

runTest('8:00 AM is NOT valid business hours', () => {
    assert.strictEqual(isValidBusinessHours('08:00:00'), false);
});

runTest('6:00 PM is NOT valid business hours', () => {
    assert.strictEqual(isValidBusinessHours('18:00:00'), false);
});

// ========================================
// STATUS TRANSITION TESTS
// ========================================

console.log('\n--- Status Transition Tests ---\n');

// Customer transitions
runTest('Customer CAN cancel pending booking', () => {
    const result = validateStatusTransition('pending', 'cancelled', 'customer');
    assert.strictEqual(result.valid, true);
});

runTest('Customer CANNOT confirm booking', () => {
    const result = validateStatusTransition('pending', 'confirmed', 'customer');
    assert.strictEqual(result.valid, false);
});

runTest('Customer CANNOT complete booking', () => {
    const result = validateStatusTransition('confirmed', 'completed', 'customer');
    assert.strictEqual(result.valid, false);
});

// Agent transitions
runTest('Agent CAN confirm pending booking', () => {
    const result = validateStatusTransition('pending', 'confirmed', 'agent');
    assert.strictEqual(result.valid, true);
});

runTest('Agent CAN complete confirmed booking', () => {
    const result = validateStatusTransition('confirmed', 'completed', 'agent');
    assert.strictEqual(result.valid, true);
});

runTest('Agent CANNOT re-open completed booking', () => {
    const result = validateStatusTransition('completed', 'confirmed', 'agent');
    assert.strictEqual(result.valid, false);
});

// Admin transitions
runTest('Admin CAN re-open completed booking', () => {
    const result = validateStatusTransition('completed', 'confirmed', 'admin');
    assert.strictEqual(result.valid, true);
});

runTest('Admin CAN re-open cancelled booking', () => {
    const result = validateStatusTransition('cancelled', 'pending', 'admin');
    assert.strictEqual(result.valid, true);
});

// ========================================
// BOOKING ELIGIBILITY TESTS
// ========================================

console.log('\n--- Booking Eligibility Tests ---\n');

const verifiedCustomer = { id: 1, isVerified: true, isActive: true };
const unverifiedCustomer = { id: 2, isVerified: false, isActive: true };
const deactivatedCustomer = { id: 3, isVerified: true, isActive: false };
const availableProperty = { id: 1, status: 'available' };
const soldProperty = { id: 2, status: 'sold' };
const pendingProperty = { id: 3, status: 'pending' };

runTest('Verified customer CAN book available property', () => {
    const result = canCustomerBook(verifiedCustomer, availableProperty, []);
    assert.strictEqual(result.canBook, true);
});

runTest('Unverified customer CANNOT book', () => {
    const result = canCustomerBook(unverifiedCustomer, availableProperty, []);
    assert.strictEqual(result.canBook, false);
    assert.ok(result.reason.includes('verify'));
});

runTest('Deactivated customer CANNOT book', () => {
    const result = canCustomerBook(deactivatedCustomer, availableProperty, []);
    assert.strictEqual(result.canBook, false);
    assert.ok(result.reason.includes('deactivated'));
});

runTest('Customer CANNOT book sold property', () => {
    const result = canCustomerBook(verifiedCustomer, soldProperty, []);
    assert.strictEqual(result.canBook, false);
    assert.ok(result.reason.includes('sold'));
});

runTest('Customer CANNOT book pending property', () => {
    const result = canCustomerBook(verifiedCustomer, pendingProperty, []);
    assert.strictEqual(result.canBook, false);
});

runTest('Customer CANNOT book if they have pending booking', () => {
    const existingBookings = [{ status: 'pending' }];
    const result = canCustomerBook(verifiedCustomer, availableProperty, existingBookings);
    assert.strictEqual(result.canBook, false);
    assert.ok(result.reason.includes('pending'));
});

runTest('Customer CAN book if previous booking was cancelled', () => {
    const existingBookings = [{ status: 'cancelled' }];
    const result = canCustomerBook(verifiedCustomer, availableProperty, existingBookings);
    assert.strictEqual(result.canBook, true);
});

runTest('Customer CAN book if previous booking was completed', () => {
    const existingBookings = [{ status: 'completed' }];
    const result = canCustomerBook(verifiedCustomer, availableProperty, existingBookings);
    assert.strictEqual(result.canBook, true);
});

// ========================================
// SUMMARY
// ========================================

console.log('\n========================================');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

if (failed > 0) {
    process.exit(1);
}

console.log('All booking business logic tests passed! ✅\n');
