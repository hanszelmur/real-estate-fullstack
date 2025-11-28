/**
 * Agent Portal Main Application
 */

let currentAppointmentFilter = 'pending';
let appointmentsData = [];

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupNavigation();
});

/**
 * Check authentication state and show appropriate screen
 */
function checkAuth() {
    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    const userData = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);
    
    if (token && userData) {
        const user = JSON.parse(userData);
        
        // Verify user is an agent
        if (user.role !== 'agent') {
            alert('Access denied. This portal is for agents only.');
            handleLogout();
            return;
        }
        
        showDashboard(user);
    } else {
        showLoginScreen();
    }
}

/**
 * Show login screen
 */
function showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
}

/**
 * Show dashboard
 */
function showDashboard(user) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('userName').textContent = `${user.firstName} ${user.lastName}`;
    
    // Load initial data
    loadDashboardData();
}

/**
 * Handle login
 */
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    errorDiv.classList.add('hidden');
    
    const response = await API.post('/auth/login', { email, password });
    
    if (response.ok && response.data.success) {
        const user = response.data.user;
        
        // Verify user is an agent
        if (user.role !== 'agent') {
            errorDiv.textContent = 'Access denied. This portal is for agents only.';
            errorDiv.classList.remove('hidden');
            return;
        }
        
        localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, response.data.token);
        localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(user));
        
        showDashboard(user);
    } else {
        errorDiv.textContent = response.data.error || 'Login failed';
        errorDiv.classList.remove('hidden');
    }
}

/**
 * Handle logout
 */
function handleLogout() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
    showLoginScreen();
}

/**
 * Setup page navigation
 */
function setupNavigation() {
    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.target.dataset.page;
            navigateTo(page);
        });
    });
}

/**
 * Navigate to a page
 */
function navigateTo(pageName) {
    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === pageName) {
            link.classList.add('active');
        }
    });
    
    // Show page
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(`${pageName}Page`).classList.add('active');
    
    // Load page data
    switch (pageName) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'properties':
            loadProperties();
            break;
        case 'appointments':
            loadAppointments();
            break;
    }
}

/**
 * Load dashboard data
 */
async function loadDashboardData() {
    // Load properties count
    const propertiesResponse = await API.get('/properties?limit=100');
    if (propertiesResponse.ok) {
        // Filter to only agent's properties (assigned to them)
        const userData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USER));
        const myProperties = propertiesResponse.data.properties.filter(p => p.assigned_agent_id === userData.id);
        document.getElementById('statProperties').textContent = myProperties.length;
    }
    
    // Load appointments
    const appointmentsResponse = await API.get('/appointments');
    if (appointmentsResponse.ok) {
        const appointments = appointmentsResponse.data.appointments;
        
        // Calculate stats
        const pending = appointments.filter(a => a.status === 'pending').length;
        const today = new Date().toISOString().split('T')[0];
        const confirmedToday = appointments.filter(a => 
            a.status === 'confirmed' && a.appointment_date.split('T')[0] === today
        ).length;
        
        const thisMonth = new Date().toISOString().slice(0, 7);
        const completedThisMonth = appointments.filter(a => 
            a.status === 'completed' && a.appointment_date.slice(0, 7) === thisMonth
        ).length;
        
        document.getElementById('statPending').textContent = pending;
        document.getElementById('statConfirmed').textContent = confirmedToday;
        document.getElementById('statCompleted').textContent = completedThisMonth;
        
        // Show upcoming appointments
        const upcoming = appointments
            .filter(a => ['pending', 'confirmed'].includes(a.status))
            .slice(0, 5);
        
        renderUpcomingAppointments(upcoming);
    }
    
    // Load notifications
    const notificationsResponse = await API.get('/notifications?unreadOnly=true');
    if (notificationsResponse.ok) {
        renderNotifications(notificationsResponse.data.notifications.slice(0, 5));
    }
}

/**
 * Render upcoming appointments in dashboard
 */
function renderUpcomingAppointments(appointments) {
    const container = document.getElementById('upcomingAppointments');
    
    if (appointments.length === 0) {
        container.innerHTML = '<p class="text-center">No upcoming appointments</p>';
        return;
    }
    
    container.innerHTML = appointments.map(apt => `
        <div class="appointment-item ${apt.status}">
            <strong>${apt.property_title}</strong>
            <p>${apt.customer_first_name} ${apt.customer_last_name}</p>
            <p>${formatDate(apt.appointment_date)} at ${formatTime(apt.appointment_time)}</p>
        </div>
    `).join('');
}

/**
 * Render notifications
 */
function renderNotifications(notifications) {
    const container = document.getElementById('recentNotifications');
    
    if (notifications.length === 0) {
        container.innerHTML = '<p class="text-center">No new notifications</p>';
        return;
    }
    
    container.innerHTML = notifications.map(notif => `
        <div class="notification-item ${notif.is_read ? '' : 'unread'}">
            <strong>${notif.title}</strong>
            <p>${notif.message}</p>
        </div>
    `).join('');
}

/**
 * Load properties assigned to agent
 */
async function loadProperties() {
    const container = document.getElementById('propertyList');
    container.innerHTML = '<div class="loading">Loading properties...</div>';
    
    const response = await API.get('/properties?limit=100');
    
    if (response.ok && response.data.success) {
        const userData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USER));
        const myProperties = response.data.properties.filter(p => p.assigned_agent_id === userData.id);
        
        if (myProperties.length === 0) {
            container.innerHTML = '<p class="text-center">No properties assigned to you yet.</p>';
            return;
        }
        
        container.innerHTML = myProperties.map(property => `
            <div class="property-card">
                <div class="property-image">
                    ${property.image_url ? `<img src="${property.image_url}" alt="${property.title}">` : '🏠'}
                </div>
                <div class="property-info">
                    <h3 class="property-title">${property.title}</h3>
                    <p class="property-address">${property.address}, ${property.city}</p>
                    <div class="property-price">$${formatPrice(property.price)}${property.listing_type === 'rent' ? '/mo' : ''}</div>
                    <span class="property-status ${property.status}">${capitalize(property.status)}</span>
                </div>
            </div>
        `).join('');
    } else {
        container.innerHTML = '<p class="text-center">Failed to load properties</p>';
    }
}

/**
 * Load appointments
 */
async function loadAppointments() {
    const container = document.getElementById('appointmentsList');
    container.innerHTML = '<div class="loading">Loading appointments...</div>';
    
    let endpoint = '/appointments';
    if (currentAppointmentFilter) {
        endpoint += `?status=${currentAppointmentFilter}`;
    }
    
    const response = await API.get(endpoint);
    
    if (response.ok && response.data.success) {
        appointmentsData = response.data.appointments;
        
        if (appointmentsData.length === 0) {
            container.innerHTML = '<p class="text-center">No appointments found</p>';
            return;
        }
        
        container.innerHTML = appointmentsData.map(apt => `
            <div class="appointment-card">
                <div class="appointment-info">
                    <h4>${apt.property_title}</h4>
                    <p>👤 ${apt.customer_first_name} ${apt.customer_last_name}</p>
                    <p>📧 ${apt.customer_email} | 📞 ${apt.customer_phone}</p>
                    <p>📅 ${formatDate(apt.appointment_date)} at ${formatTime(apt.appointment_time)}</p>
                    ${apt.notes ? `<p>📝 ${apt.notes}</p>` : ''}
                </div>
                <div>
                    <span class="appointment-status ${apt.status}">${capitalize(apt.status)}</span>
                    <br><br>
                    <button class="btn btn-primary btn-sm" onclick="editAppointment(${apt.id})">Update</button>
                </div>
            </div>
        `).join('');
    } else {
        container.innerHTML = '<p class="text-center">Failed to load appointments</p>';
    }
}

/**
 * Filter appointments
 */
function filterAppointments(status) {
    currentAppointmentFilter = status;
    
    document.querySelectorAll('.tabs .tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    loadAppointments();
}

/**
 * Edit appointment
 */
function editAppointment(appointmentId) {
    const apt = appointmentsData.find(a => a.id === appointmentId);
    if (!apt) return;
    
    document.getElementById('appointmentId').value = apt.id;
    document.getElementById('modalPropertyTitle').textContent = apt.property_title;
    document.getElementById('modalCustomerName').textContent = `${apt.customer_first_name} ${apt.customer_last_name}`;
    document.getElementById('modalCustomerContact').textContent = `${apt.customer_email} | ${apt.customer_phone}`;
    document.getElementById('appointmentStatus').value = apt.status;
    document.getElementById('appointmentDate').value = apt.appointment_date.split('T')[0];
    document.getElementById('appointmentTime').value = apt.appointment_time;
    document.getElementById('appointmentNotes').value = apt.notes || '';
    
    openModal('appointmentModal');
}

/**
 * Update appointment
 */
async function updateAppointment(event) {
    event.preventDefault();
    
    const id = document.getElementById('appointmentId').value;
    const status = document.getElementById('appointmentStatus').value;
    const appointmentDate = document.getElementById('appointmentDate').value;
    const appointmentTime = document.getElementById('appointmentTime').value;
    const notes = document.getElementById('appointmentNotes').value;
    const errorDiv = document.getElementById('appointmentError');
    
    errorDiv.classList.add('hidden');
    
    const response = await API.put(`/appointments/${id}`, {
        status,
        appointmentDate,
        appointmentTime,
        notes
    });
    
    if (response.ok && response.data.success) {
        closeModal('appointmentModal');
        loadAppointments();
        alert('Appointment updated successfully');
    } else {
        errorDiv.textContent = response.data.error || 'Failed to update appointment';
        errorDiv.classList.remove('hidden');
    }
}

/**
 * Modal helpers
 */
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

/**
 * Utility functions
 */
function formatPrice(price) {
    return Number(price).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatTime(timeStr) {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});
