/**
 * Appointments Page JavaScript
 * 
 * Handles viewing and managing customer appointments including:
 * - Status tracking (confirmed, queued, promoted, canceled)
 * - Queue position display
 * - Agent rating functionality for completed viewings
 * 
 * Note: Utility functions (escapeHtml, formatTime, capitalizeFirst, etc.)
 * are provided by ../shared/js/utils.js
 */

let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    if (!isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }
    
    loadAppointments();
});

/**
 * Load appointments with current filter
 */
async function loadAppointments() {
    const container = document.getElementById('appointmentsList');
    container.innerHTML = '<div class="loading">Loading appointments...</div>';
    
    let endpoint = '/appointments';
    if (currentFilter !== 'all') {
        endpoint += `?status=${currentFilter}`;
    }
    
    const response = await API.get(endpoint);
    
    if (response.ok && response.data.success) {
        const appointments = response.data.appointments;
        
        if (appointments.length === 0) {
            container.innerHTML = `
                <div class="text-center" style="padding: 40px;">
                    <p>No ${currentFilter === 'all' ? '' : currentFilter} appointments found.</p>
                    <br>
                    <a href="properties.html" class="btn btn-primary">Browse Properties</a>
                </div>
            `;
            return;
        }
        
        // Check rating eligibility for completed appointments
        const appointmentCards = await Promise.all(
            appointments.map(async (appointment) => {
                let canRate = false;
                if (appointment.status === 'completed') {
                    const ratingCheck = await API.get(`/ratings/can-rate/${appointment.id}`);
                    if (ratingCheck.ok && ratingCheck.data.success) {
                        canRate = ratingCheck.data.canRate;
                    }
                }
                return createAppointmentCard(appointment, canRate);
            })
        );
        
        container.innerHTML = appointmentCards.join('');
    } else {
        container.innerHTML = '<p class="text-center">Failed to load appointments. Please try again.</p>';
    }
}

/**
 * Create appointment card HTML
 */
function createAppointmentCard(appointment, canRate = false) {
    const date = new Date(appointment.appointment_date);
    const formattedDate = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    const formattedTime = formatTime(appointment.appointment_time);
    
    // Status display with icons
    let statusDisplay = capitalizeFirst(appointment.status);
    let statusIcon = '';
    switch (appointment.status) {
        case 'confirmed':
            statusIcon = '✅';
            break;
        case 'pending':
            statusIcon = '⏳';
            break;
        case 'queued':
            statusIcon = '📋';
            statusDisplay = `Queued #${appointment.queue_position || '?'}`;
            break;
        case 'completed':
            statusIcon = '✓';
            break;
        case 'cancelled':
            statusIcon = '❌';
            break;
    }
    
    // Queue info banner for queued appointments
    let queueBanner = '';
    if (appointment.status === 'queued') {
        queueBanner = `
            <div class="queue-banner">
                <strong>📋 Queue Position: #${appointment.queue_position || '?'}</strong>
                <p>You'll be notified immediately if this slot becomes available.</p>
            </div>
        `;
    }
    
    // Rating button for completed appointments
    let ratingSection = '';
    if (appointment.status === 'completed' && canRate) {
        ratingSection = `
            <div class="rating-prompt">
                <p>How was your viewing experience?</p>
                <button class="btn btn-secondary btn-sm" onclick="openRatingModal(${appointment.id}, '${escapeQuotes(appointment.property_title)}', '${escapeQuotes(appointment.agent_first_name + ' ' + appointment.agent_last_name)}')">
                    ⭐ Rate Agent
                </button>
            </div>
        `;
    }
    
    return `
        <div class="appointment-card ${appointment.status}">
            ${queueBanner}
            <div class="appointment-info">
                <h3>${escapeHtml(appointment.property_title)}</h3>
                <p>📍 ${escapeHtml(appointment.property_address)}, ${escapeHtml(appointment.property_city)}</p>
                <p>📅 ${formattedDate} at ${formattedTime}</p>
                ${appointment.agent_first_name ? `
                    <p>👤 Agent: ${escapeHtml(appointment.agent_first_name)} ${escapeHtml(appointment.agent_last_name)}</p>
                ` : ''}
                ${appointment.notes ? `<p>📝 Notes: ${escapeHtml(appointment.notes)}</p>` : ''}
            </div>
            <div class="appointment-actions">
                <span class="appointment-status ${appointment.status}">${statusIcon} ${statusDisplay}</span>
                ${['pending', 'confirmed', 'queued'].includes(appointment.status) ? `
                    <br><br>
                    <button class="btn btn-danger" onclick="cancelAppointment(${appointment.id})">Cancel</button>
                ` : ''}
                ${ratingSection}
            </div>
        </div>
    `;
}

/**
 * Escape quotes and backslashes for inline JS
 */
function escapeQuotes(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/\\/g, '\\\\')  // Escape backslashes first
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"');
}

/**
 * Filter appointments by status
 */
function filterAppointments(status) {
    currentFilter = status;
    
    // Update active tab
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    loadAppointments();
}

/**
 * Cancel an appointment
 */
async function cancelAppointment(appointmentId) {
    if (!confirm('Are you sure you want to cancel this appointment?')) {
        return;
    }
    
    const response = await API.put(`/appointments/${appointmentId}`, {
        status: 'cancelled'
    });
    
    if (response.ok && response.data.success) {
        alert('Appointment cancelled successfully.');
        loadAppointments();
    } else {
        alert(response.data.error || 'Failed to cancel appointment. Please try again.');
    }
}

/**
 * Open rating modal
 */
function openRatingModal(appointmentId, propertyTitle, agentName) {
    document.getElementById('ratingAppointmentId').value = appointmentId;
    document.getElementById('ratingPropertyTitle').textContent = propertyTitle;
    document.getElementById('ratingAgentName').textContent = agentName;
    document.getElementById('ratingError').classList.add('hidden');
    document.getElementById('ratingSuccess').classList.add('hidden');
    document.getElementById('ratingForm').reset();
    
    // Reset star selection
    document.querySelectorAll('.star-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    openModal('ratingModal');
}

/**
 * Select star rating
 */
function selectRating(rating) {
    document.getElementById('ratingValue').value = rating;
    
    // Update star display
    document.querySelectorAll('.star-btn').forEach((btn, index) => {
        if (index < rating) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}

/**
 * Submit rating
 */
async function submitRating(event) {
    event.preventDefault();
    
    const errorDiv = document.getElementById('ratingError');
    const successDiv = document.getElementById('ratingSuccess');
    
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    
    const appointmentId = document.getElementById('ratingAppointmentId').value;
    const rating = document.getElementById('ratingValue').value;
    const feedback = document.getElementById('ratingFeedback').value;
    
    if (!rating || rating < 1 || rating > 5) {
        errorDiv.textContent = 'Please select a star rating.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    const response = await API.post('/ratings', {
        appointmentId: parseInt(appointmentId),
        rating: parseInt(rating),
        feedback
    });
    
    if (response.ok && response.data.success) {
        successDiv.textContent = 'Thank you for your feedback!';
        successDiv.classList.remove('hidden');
        
        setTimeout(() => {
            closeModal('ratingModal');
            loadAppointments();
        }, 1500);
    } else {
        errorDiv.textContent = response.data.error || 'Failed to submit rating. Please try again.';
        errorDiv.classList.remove('hidden');
    }
}
