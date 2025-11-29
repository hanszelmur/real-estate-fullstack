/**
 * Backend Unit Tests - Booking Queue Logic
 * 
 * @file queue.test.js
 * @description Tests for booking queue management and race condition handling.
 *              Uses Node.js built-in assert module - no external test frameworks required.
 * 
 * @usage Run from backend directory:
 *        node tests/queue.test.js
 * 
 * @note These tests run synchronously and test pure logic functions.
 *       They simulate queue operations without database connections.
 */

const assert = require('assert');

console.log('========================================');
console.log('BOOKING QUEUE LOGIC TESTS');
console.log('========================================\n');

/**
 * Simulates the queue data structure for a slot
 * In production, this is stored in the appointments table with status='queued'
 */
class MockBookingQueue {
    constructor() {
        // Structure: { 'propertyId:date:time': [appointments] }
        this.slots = {};
        // Counter for generating unique timestamps in tests
        this._timestampCounter = 0;
    }
    
    /**
     * Get slot key for a booking
     */
    getSlotKey(propertyId, date, time) {
        return `${propertyId}:${date}:${time}`;
    }
    
    /**
     * Check if slot has a confirmed booking
     */
    isSlotTaken(propertyId, date, time) {
        const key = this.getSlotKey(propertyId, date, time);
        const bookings = this.slots[key] || [];
        return bookings.some(b => b.status === 'pending' || b.status === 'confirmed');
    }
    
    /**
     * Get queue length for a slot
     */
    getQueueLength(propertyId, date, time) {
        const key = this.getSlotKey(propertyId, date, time);
        const bookings = this.slots[key] || [];
        return bookings.filter(b => b.status === 'queued').length;
    }
    
    /**
     * Create a booking - returns the result with status
     * Simulates the POST /appointments logic
     */
    createBooking(propertyId, date, time, customerId) {
        const key = this.getSlotKey(propertyId, date, time);
        
        if (!this.slots[key]) {
            this.slots[key] = [];
        }
        
        // Use incremental counter for unique timestamps (more predictable than random)
        // In production, MySQL DATETIME(6) provides microsecond precision
        this._timestampCounter++;
        const timestamp = Date.now() + this._timestampCounter;
        
        // Check if slot is already taken
        if (this.isSlotTaken(propertyId, date, time)) {
            // Add to queue
            const queuePosition = this.getQueueLength(propertyId, date, time) + 1;
            const booking = {
                id: this.slots[key].length + 1,
                propertyId,
                customerId,
                date,
                time,
                status: 'queued',
                queuePosition,
                bookingTimestamp: timestamp
            };
            this.slots[key].push(booking);
            return {
                success: true,
                isQueued: true,
                queuePosition,
                booking
            };
        }
        
        // Slot available - create pending booking
        const booking = {
            id: this.slots[key].length + 1,
            propertyId,
            customerId,
            date,
            time,
            status: 'pending',
            queuePosition: null,
            bookingTimestamp: timestamp
        };
        this.slots[key].push(booking);
        return {
            success: true,
            isQueued: false,
            queuePosition: null,
            booking
        };
    }
    
    /**
     * Cancel a booking and promote next in queue
     * Simulates the PUT /appointments/:id cancel logic
     */
    cancelBooking(propertyId, date, time, bookingId) {
        const key = this.getSlotKey(propertyId, date, time);
        const bookings = this.slots[key] || [];
        
        const bookingIndex = bookings.findIndex(b => b.id === bookingId);
        if (bookingIndex === -1) {
            return { success: false, error: 'Booking not found' };
        }
        
        const booking = bookings[bookingIndex];
        const wasConfirmed = ['pending', 'confirmed'].includes(booking.status);
        
        // Mark as cancelled
        booking.status = 'cancelled';
        
        let promotedBooking = null;
        
        // If it was a confirmed slot, promote next in queue
        if (wasConfirmed) {
            // Find first queued booking
            const queuedBookings = bookings
                .filter(b => b.status === 'queued')
                .sort((a, b) => a.queuePosition - b.queuePosition);
            
            if (queuedBookings.length > 0) {
                // Promote first in queue
                promotedBooking = queuedBookings[0];
                promotedBooking.status = 'confirmed';
                promotedBooking.queuePosition = null;
                
                // Decrement positions for remaining queued
                queuedBookings.slice(1).forEach(b => {
                    b.queuePosition--;
                });
            }
        } else if (booking.status === 'queued') {
            // If queued booking is cancelled, update positions
            const position = booking.queuePosition;
            bookings
                .filter(b => b.status === 'queued' && b.queuePosition > position)
                .forEach(b => {
                    b.queuePosition--;
                });
        }
        
        return {
            success: true,
            promotedBooking,
            cancelledBooking: booking
        };
    }
    
    /**
     * Get all bookings for a slot
     */
    getSlotBookings(propertyId, date, time) {
        const key = this.getSlotKey(propertyId, date, time);
        return this.slots[key] || [];
    }
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
// BASIC QUEUE TESTS
// ========================================

console.log('\n--- Basic Queue Tests ---\n');

runTest('First booking gets pending status', () => {
    const queue = new MockBookingQueue();
    const result = queue.createBooking(1, '2024-01-15', '10:00:00', 100);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isQueued, false);
    assert.strictEqual(result.booking.status, 'pending');
});

runTest('Second booking for same slot gets queued', () => {
    const queue = new MockBookingQueue();
    
    // First booking - gets the slot
    queue.createBooking(1, '2024-01-15', '10:00:00', 100);
    
    // Second booking - goes to queue
    const result = queue.createBooking(1, '2024-01-15', '10:00:00', 101);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isQueued, true);
    assert.strictEqual(result.queuePosition, 1);
    assert.strictEqual(result.booking.status, 'queued');
});

runTest('Third booking gets queue position 2', () => {
    const queue = new MockBookingQueue();
    
    queue.createBooking(1, '2024-01-15', '10:00:00', 100);
    queue.createBooking(1, '2024-01-15', '10:00:00', 101);
    const result = queue.createBooking(1, '2024-01-15', '10:00:00', 102);
    
    assert.strictEqual(result.queuePosition, 2);
});

runTest('Different time slots are independent', () => {
    const queue = new MockBookingQueue();
    
    // 10:00 slot
    const result1 = queue.createBooking(1, '2024-01-15', '10:00:00', 100);
    
    // 11:00 slot (different slot)
    const result2 = queue.createBooking(1, '2024-01-15', '11:00:00', 101);
    
    // Both should be pending (not queued)
    assert.strictEqual(result1.isQueued, false);
    assert.strictEqual(result2.isQueued, false);
});

runTest('Different dates are independent', () => {
    const queue = new MockBookingQueue();
    
    // Jan 15
    const result1 = queue.createBooking(1, '2024-01-15', '10:00:00', 100);
    
    // Jan 16 (different date)
    const result2 = queue.createBooking(1, '2024-01-16', '10:00:00', 101);
    
    assert.strictEqual(result1.isQueued, false);
    assert.strictEqual(result2.isQueued, false);
});

// ========================================
// QUEUE PROMOTION TESTS
// ========================================

console.log('\n--- Queue Promotion Tests ---\n');

runTest('Cancelling confirmed booking promotes first in queue', () => {
    const queue = new MockBookingQueue();
    
    // Create bookings
    const booking1 = queue.createBooking(1, '2024-01-15', '10:00:00', 100);
    const booking2 = queue.createBooking(1, '2024-01-15', '10:00:00', 101);
    const booking3 = queue.createBooking(1, '2024-01-15', '10:00:00', 102);
    
    // Cancel first booking
    const result = queue.cancelBooking(1, '2024-01-15', '10:00:00', booking1.booking.id);
    
    // Check promotion
    assert.strictEqual(result.success, true);
    assert.notStrictEqual(result.promotedBooking, null);
    assert.strictEqual(result.promotedBooking.customerId, 101);
    assert.strictEqual(result.promotedBooking.status, 'confirmed');
});

runTest('Queue positions update after promotion', () => {
    const queue = new MockBookingQueue();
    
    // Create bookings
    const booking1 = queue.createBooking(1, '2024-01-15', '10:00:00', 100);
    queue.createBooking(1, '2024-01-15', '10:00:00', 101); // position 1
    queue.createBooking(1, '2024-01-15', '10:00:00', 102); // position 2
    queue.createBooking(1, '2024-01-15', '10:00:00', 103); // position 3
    
    // Cancel first booking (promotes position 1)
    queue.cancelBooking(1, '2024-01-15', '10:00:00', booking1.booking.id);
    
    // Check remaining queue positions
    const bookings = queue.getSlotBookings(1, '2024-01-15', '10:00:00');
    const queuedBookings = bookings.filter(b => b.status === 'queued');
    
    assert.strictEqual(queuedBookings.length, 2);
    assert.strictEqual(queuedBookings.find(b => b.customerId === 102).queuePosition, 1);
    assert.strictEqual(queuedBookings.find(b => b.customerId === 103).queuePosition, 2);
});

runTest('No promotion when queue is empty', () => {
    const queue = new MockBookingQueue();
    
    // Create single booking
    const booking1 = queue.createBooking(1, '2024-01-15', '10:00:00', 100);
    
    // Cancel it
    const result = queue.cancelBooking(1, '2024-01-15', '10:00:00', booking1.booking.id);
    
    assert.strictEqual(result.promotedBooking, null);
});

runTest('Cancelling queued booking does not trigger promotion', () => {
    const queue = new MockBookingQueue();
    
    // Create bookings
    queue.createBooking(1, '2024-01-15', '10:00:00', 100);
    const booking2 = queue.createBooking(1, '2024-01-15', '10:00:00', 101);
    
    // Cancel the queued booking
    const result = queue.cancelBooking(1, '2024-01-15', '10:00:00', booking2.booking.id);
    
    // No promotion should occur
    assert.strictEqual(result.promotedBooking, null);
});

// ========================================
// RACE CONDITION SIMULATION TESTS
// ========================================

console.log('\n--- Race Condition Tests ---\n');

runTest('Simultaneous bookings handled correctly', () => {
    const queue = new MockBookingQueue();
    
    // Simulate "simultaneous" bookings
    // In reality, the database handles this with row-level locking
    // and microsecond-precision timestamps
    const results = [];
    
    for (let i = 0; i < 5; i++) {
        results.push(queue.createBooking(1, '2024-01-15', '10:00:00', 100 + i));
    }
    
    // First should be pending
    assert.strictEqual(results[0].isQueued, false);
    
    // Rest should be queued with incrementing positions
    assert.strictEqual(results[1].isQueued, true);
    assert.strictEqual(results[1].queuePosition, 1);
    
    assert.strictEqual(results[2].queuePosition, 2);
    assert.strictEqual(results[3].queuePosition, 3);
    assert.strictEqual(results[4].queuePosition, 4);
});

runTest('Booking timestamps are unique', () => {
    const queue = new MockBookingQueue();
    
    // Create multiple bookings
    const results = [];
    for (let i = 0; i < 3; i++) {
        results.push(queue.createBooking(1, '2024-01-15', '10:00:00', 100 + i));
    }
    
    // All timestamps should be unique
    const timestamps = results.map(r => r.booking.bookingTimestamp);
    const uniqueTimestamps = new Set(timestamps);
    
    assert.strictEqual(uniqueTimestamps.size, timestamps.length);
});

// ========================================
// EDGE CASES
// ========================================

console.log('\n--- Edge Cases ---\n');

runTest('Queue works with many customers', () => {
    const queue = new MockBookingQueue();
    
    // Create 100 bookings for same slot
    for (let i = 0; i < 100; i++) {
        queue.createBooking(1, '2024-01-15', '10:00:00', 100 + i);
    }
    
    const queueLength = queue.getQueueLength(1, '2024-01-15', '10:00:00');
    assert.strictEqual(queueLength, 99); // First is pending, 99 are queued
});

runTest('Multiple promotions work correctly', () => {
    const queue = new MockBookingQueue();
    
    // Create 5 bookings
    const bookings = [];
    for (let i = 0; i < 5; i++) {
        bookings.push(queue.createBooking(1, '2024-01-15', '10:00:00', 100 + i));
    }
    
    // Cancel and promote 3 times
    for (let i = 0; i < 3; i++) {
        const activeBooking = queue.getSlotBookings(1, '2024-01-15', '10:00:00')
            .find(b => b.status === 'confirmed' || b.status === 'pending');
        queue.cancelBooking(1, '2024-01-15', '10:00:00', activeBooking.id);
    }
    
    // Check final state
    const remainingBookings = queue.getSlotBookings(1, '2024-01-15', '10:00:00');
    const confirmed = remainingBookings.find(b => b.status === 'confirmed');
    const queued = remainingBookings.filter(b => b.status === 'queued');
    
    assert.strictEqual(confirmed.customerId, 103); // 4th customer promoted
    assert.strictEqual(queued.length, 1);
    assert.strictEqual(queued[0].customerId, 104);
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

console.log('All booking queue tests passed! ✅\n');
