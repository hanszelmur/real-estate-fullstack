/**
 * Appointments Page JavaScript
 * 
 * Handles viewing and managing customer appointments.
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
        
        container.innerHTML = appointments.map(appointment => createAppointmentCard(appointment)).join('');
    } else {
        container.innerHTML = '<p class="text-center">Failed to load appointments. Please try again.</p>';
    }
}

/**
 * Create appointment card HTML
 */
function createAppointmentCard(appointment) {
    const date = new Date(appointment.appointment_date);
    const formattedDate = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    const formattedTime = formatTime(appointment.appointment_time);
    
    return `
        <div class="appointment-card">
            <div class="appointment-info">
                <h3>${appointment.property_title}</h3>
                <p>📍 ${appointment.property_address}, ${appointment.property_city}</p>
                <p>📅 ${formattedDate} at ${formattedTime}</p>
                ${appointment.agent_first_name ? `
                    <p>👤 Agent: ${appointment.agent_first_name} ${appointment.agent_last_name}</p>
                ` : ''}
                ${appointment.notes ? `<p>📝 Notes: ${appointment.notes}</p>` : ''}
            </div>
            <div>
                <span class="appointment-status ${appointment.status}">${capitalizeFirst(appointment.status)}</span>
                ${appointment.status === 'pending' ? `
                    <br><br>
                    <button class="btn btn-danger" onclick="cancelAppointment(${appointment.id})">Cancel</button>
                ` : ''}
            </div>
        </div>
    `;
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
 * Format time string to 12-hour format
 */
function formatTime(timeStr) {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
