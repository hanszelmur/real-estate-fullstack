/**
 * Agent Portal Main Application
 * 
 * Features:
 * - Dashboard with stats and upcoming appointments
 * - Property management (view, add, edit assigned properties)
 * - Appointment management with status updates
 * - Agent ratings display
 */

let currentAppointmentFilter = 'pending';
let appointmentsData = [];
let propertiesData = [];

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
    loadAgentRatingSummary();
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
 * Load agent rating summary
 */
async function loadAgentRatingSummary() {
    const userData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USER));
    const response = await API.get(`/ratings/agent/${userData.id}/summary`);
    
    if (response.ok && response.data.success) {
        const summary = response.data.summary;
        const ratingDisplay = document.getElementById('agentRating');
        if (ratingDisplay) {
            if (summary.totalRatings > 0) {
                ratingDisplay.innerHTML = `
                    <span class="rating-stars">${renderStars(parseFloat(summary.averageRating))}</span>
                    <span class="rating-value">${summary.averageRating}</span>
                    <span class="rating-count">(${summary.totalRatings} reviews)</span>
                `;
            } else {
                ratingDisplay.innerHTML = '<span class="no-ratings">No ratings yet</span>';
            }
        }
    }
}

/**
 * Render star rating
 */
function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating - fullStars >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let stars = '';
    for (let i = 0; i < fullStars; i++) stars += '★';
    if (hasHalfStar) stars += '½';
    for (let i = 0; i < emptyStars; i++) stars += '☆';
    
    return stars;
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
            <strong>${escapeHtml(apt.property_title)}</strong>
            <p>${escapeHtml(apt.customer_first_name)} ${escapeHtml(apt.customer_last_name)}</p>
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
            <strong>${escapeHtml(notif.title)}</strong>
            <p>${escapeHtml(notif.message)}</p>
        </div>
    `).join('');
}

/**
 * Validate URL is a safe image URL
 * Allows only http/https URLs with valid format
 */
function isValidImageUrl(url) {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        // Only allow http and https protocols
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return false;
        }
        // Basic check for valid hostname
        if (!parsed.hostname || parsed.hostname.length < 3) {
            return false;
        }
        return true;
    } catch {
        return false;
    }
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
        propertiesData = response.data.properties.filter(p => p.assigned_agent_id === userData.id);
        
        if (propertiesData.length === 0) {
            container.innerHTML = `
                <p class="text-center">No properties assigned to you yet.</p>
                <div class="text-center" style="margin-top: 20px;">
                    <button class="btn btn-primary" onclick="showAddPropertyModal()">+ Add Property</button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="property-actions-bar">
                <button class="btn btn-primary" onclick="showAddPropertyModal()">+ Add Property</button>
            </div>
            <div class="property-grid">
                ${propertiesData.map(property => `
                    <div class="property-card">
                        <div class="property-image">
                            ${isValidImageUrl(property.image_url) ? `<img src="${property.image_url}" alt="${escapeHtml(property.title)}">` : '🏠'}
                        </div>
                        <div class="property-info">
                            <h3 class="property-title">${escapeHtml(property.title)}</h3>
                            <p class="property-address">${escapeHtml(property.address)}, ${escapeHtml(property.city)}</p>
                            <div class="property-price">$${formatPrice(property.price)}${property.listing_type === 'rent' ? '/mo' : ''}</div>
                            <span class="property-status ${property.status}">${capitalize(property.status)}</span>
                            <div class="property-card-actions">
                                <button class="btn btn-secondary btn-sm" onclick="editProperty(${property.id})">Edit</button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        container.innerHTML = '<p class="text-center">Failed to load properties</p>';
    }
}

/**
 * Show add property modal
 */
function showAddPropertyModal() {
    document.getElementById('propertyForm').reset();
    document.getElementById('propertyId').value = '';
    document.getElementById('propertyModalTitle').textContent = 'Add New Property';
    document.getElementById('propertyError').classList.add('hidden');
    openModal('propertyModal');
}

/**
 * Edit property
 */
function editProperty(propertyId) {
    const property = propertiesData.find(p => p.id === propertyId);
    if (!property) return;
    
    document.getElementById('propertyId').value = property.id;
    document.getElementById('propertyTitle').value = property.title;
    document.getElementById('propertyDescription').value = property.description || '';
    document.getElementById('propertyAddress').value = property.address;
    document.getElementById('propertyCity').value = property.city;
    document.getElementById('propertyState').value = property.state;
    document.getElementById('propertyZip').value = property.zip_code;
    document.getElementById('propertyPrice').value = property.price;
    document.getElementById('propertyType').value = property.property_type;
    document.getElementById('propertyListingType').value = property.listing_type;
    document.getElementById('propertyBedrooms').value = property.bedrooms;
    document.getElementById('propertyBathrooms').value = property.bathrooms;
    document.getElementById('propertySqFt').value = property.square_feet;
    document.getElementById('propertyStatus').value = property.status;
    document.getElementById('propertyImageUrl').value = property.image_url || '';
    
    document.getElementById('propertyModalTitle').textContent = 'Edit Property';
    document.getElementById('propertyError').classList.add('hidden');
    openModal('propertyModal');
}

/**
 * Save property (add or update)
 */
async function saveProperty(event) {
    event.preventDefault();
    
    const id = document.getElementById('propertyId').value;
    const errorDiv = document.getElementById('propertyError');
    errorDiv.classList.add('hidden');
    
    const data = {
        title: document.getElementById('propertyTitle').value,
        description: document.getElementById('propertyDescription').value,
        address: document.getElementById('propertyAddress').value,
        city: document.getElementById('propertyCity').value,
        state: document.getElementById('propertyState').value,
        zipCode: document.getElementById('propertyZip').value,
        price: parseFloat(document.getElementById('propertyPrice').value),
        propertyType: document.getElementById('propertyType').value,
        listingType: document.getElementById('propertyListingType').value,
        bedrooms: parseInt(document.getElementById('propertyBedrooms').value) || 0,
        bathrooms: parseFloat(document.getElementById('propertyBathrooms').value) || 0,
        squareFeet: parseInt(document.getElementById('propertySqFt').value) || 0,
        status: document.getElementById('propertyStatus').value,
        imageUrl: document.getElementById('propertyImageUrl').value || null
    };
    
    const response = id 
        ? await API.put(`/properties/${id}`, data)
        : await API.post('/properties', data);
    
    if (response.ok && response.data.success) {
        closeModal('propertyModal');
        loadProperties();
        alert(id ? 'Property updated successfully' : 'Property created successfully');
    } else {
        errorDiv.textContent = response.data.error || 'Failed to save property';
        errorDiv.classList.remove('hidden');
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
            <div class="appointment-card ${apt.status}">
                <div class="appointment-info">
                    <h4>${escapeHtml(apt.property_title)}</h4>
                    <p>👤 ${escapeHtml(apt.customer_first_name)} ${escapeHtml(apt.customer_last_name)}</p>
                    <p>📧 ${escapeHtml(apt.customer_email)} | 📞 ${escapeHtml(apt.customer_phone)}</p>
                    <p>📅 ${formatDate(apt.appointment_date)} at ${formatTime(apt.appointment_time)}</p>
                    ${apt.queue_position ? `<p>📋 Queue Position: #${apt.queue_position}</p>` : ''}
                    ${apt.notes ? `<p>📝 ${escapeHtml(apt.notes)}</p>` : ''}
                </div>
                <div class="appointment-actions">
                    <span class="appointment-status ${apt.status}">${getStatusDisplay(apt)}</span>
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
 * Get status display with icon
 */
function getStatusDisplay(appointment) {
    const status = appointment.status;
    let icon = '';
    let label = capitalize(status);
    
    switch (status) {
        case 'confirmed': icon = '✅'; break;
        case 'pending': icon = '⏳'; break;
        case 'queued': icon = '📋'; label = `Queued #${appointment.queue_position || '?'}`; break;
        case 'completed': icon = '✓'; break;
        case 'cancelled': icon = '❌'; break;
    }
    
    return `${icon} ${label}`;
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
    document.getElementById('appointmentError').classList.add('hidden');
    
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
        loadDashboardData(); // Refresh dashboard stats
        
        let message = 'Appointment updated successfully';
        if (response.data.promotedCustomer) {
            message += '. Note: Next customer in queue has been promoted to this slot.';
        }
        alert(message);
    } else {
        errorDiv.textContent = response.data.error || 'Failed to update appointment';
        errorDiv.classList.remove('hidden');
    }
}

/**
 * Escape HTML
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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
