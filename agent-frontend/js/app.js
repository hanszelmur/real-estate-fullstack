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
        case 'sales':
            loadMySales();
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
 * Get the primary image URL for a property
 * Prioritizes uploaded photos over legacy image_url
 */
function getPropertyImageUrl(property) {
    // Check for uploaded photos first (photos array from API)
    if (property.photos && property.photos.length > 0) {
        const primaryPhoto = property.photos.find(p => p.is_primary) || property.photos[0];
        return `${CONFIG.API_URL.replace('/api', '')}/uploads/images/${primaryPhoto.filename}`;
    }
    // Fall back to legacy image_url
    if (isValidImageUrl(property.image_url)) {
        return property.image_url;
    }
    return null;
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
        
        // Fetch photos for each property to display in cards
        const propertiesWithPhotos = await Promise.all(propertiesData.map(async (property) => {
            const photosResponse = await API.get(`/properties/${property.id}/photos`);
            if (photosResponse.ok && photosResponse.data.success) {
                property.photos = photosResponse.data.photos;
            }
            return property;
        }));
        
        container.innerHTML = `
            <div class="property-actions-bar">
                <button class="btn btn-primary" onclick="showAddPropertyModal()">+ Add Property</button>
            </div>
            <div class="property-grid">
                ${propertiesWithPhotos.map(property => {
                    const imageUrl = getPropertyImageUrl(property);
                    const showSaleButtons = ['available', 'pending'].includes(property.status);
                    const showArchiveButton = ['sold', 'rented'].includes(property.status) && !property.is_archived;
                    const isForRent = property.listing_type === 'rent';
                    return `
                    <div class="property-card">
                        <div class="property-image">
                            ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(property.title)}">` : '🏠'}
                            ${property.status === 'sold' ? '<span class="status-badge sold">SOLD</span>' : ''}
                            ${property.status === 'rented' ? '<span class="status-badge rented">RENTED</span>' : ''}
                        </div>
                        <div class="property-info">
                            <h3 class="property-title">${escapeHtml(property.title)}</h3>
                            <p class="property-address">${escapeHtml(property.address)}, ${escapeHtml(property.city)}</p>
                            <div class="property-price">$${formatPrice(property.price)}${property.listing_type === 'rent' ? '/mo' : ''}</div>
                            <span class="property-status ${property.status}">${capitalize(property.status)}</span>
                            <div class="property-card-actions">
                                <button class="btn btn-secondary btn-sm" onclick="editProperty(${property.id})">Edit</button>
                                ${showSaleButtons ? `
                                    <button class="btn btn-success btn-sm" onclick="showMarkSoldModal(${property.id}, '${escapeHtml(property.title)}', '${isForRent ? 'rented' : 'sold'}')">
                                        ${isForRent ? '🔑 Mark Rented' : '✓ Mark Sold'}
                                    </button>
                                ` : ''}
                                ${showArchiveButton ? `
                                    <button class="btn btn-secondary btn-sm" onclick="archiveProperty(${property.id})">📦 Archive</button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `}).join('')}
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
    clearImagePreview();
    clearExistingPhotos();
    openModal('propertyModal');
}

/**
 * Edit property
 */
async function editProperty(propertyId) {
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
    clearImagePreview();
    
    // Load existing photos
    await loadExistingPhotos(propertyId);
    
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
        const propertyId = id || response.data.property.id;
        
        // Upload images if any were selected
        const imageInput = document.getElementById('propertyImages');
        if (imageInput.files && imageInput.files.length > 0) {
            await uploadPropertyImages(propertyId, imageInput.files);
        }
        
        closeModal('propertyModal');
        loadProperties();
        alert(id ? 'Property updated successfully' : 'Property created successfully');
    } else {
        errorDiv.textContent = response.data.error || 'Failed to save property';
        errorDiv.classList.remove('hidden');
    }
}

/**
 * Upload property images
 */
async function uploadPropertyImages(propertyId, files) {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
    }
    
    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    
    try {
        const response = await fetch(`${CONFIG.API_URL}/properties/${propertyId}/photos`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        if (!data.success) {
            console.error('Failed to upload images:', data.error);
            alert('Property saved, but some images failed to upload: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Image upload error:', error);
        alert('Property saved, but image upload failed.');
    }
}

/**
 * Load existing photos for a property
 */
async function loadExistingPhotos(propertyId) {
    const container = document.getElementById('existingPhotos');
    container.innerHTML = '';
    
    const response = await API.get(`/properties/${propertyId}/photos`);
    
    if (response.ok && response.data.success && response.data.photos.length > 0) {
        container.innerHTML = `
            <h4>Existing Photos</h4>
            <div class="existing-photos-grid">
                ${response.data.photos.map(photo => `
                    <div class="existing-photo-item ${photo.is_primary ? 'primary' : ''}" data-photo-id="${photo.id}">
                        ${photo.is_primary ? '<span class="primary-badge">Primary</span>' : ''}
                        <img src="${CONFIG.API_URL.replace('/api', '')}/uploads/images/${photo.filename}" alt="${escapeHtml(photo.original_filename || 'Property photo')}">
                        <div class="photo-actions">
                            ${!photo.is_primary ? `<button type="button" onclick="setAsPrimary(${propertyId}, ${photo.id})" title="Set as primary">★</button>` : ''}
                            <button type="button" onclick="deletePhoto(${propertyId}, ${photo.id})" title="Delete">🗑</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

/**
 * Clear existing photos display
 */
function clearExistingPhotos() {
    const container = document.getElementById('existingPhotos');
    if (container) container.innerHTML = '';
}

/**
 * Set photo as primary
 */
async function setAsPrimary(propertyId, photoId) {
    const response = await API.put(`/properties/${propertyId}/photos/${photoId}/primary`, {});
    
    if (response.ok && response.data.success) {
        await loadExistingPhotos(propertyId);
    } else {
        alert('Failed to set primary photo: ' + (response.data.error || 'Unknown error'));
    }
}

/**
 * Delete a photo
 */
async function deletePhoto(propertyId, photoId) {
    if (!confirm('Are you sure you want to delete this photo?')) return;
    
    const response = await API.delete(`/properties/${propertyId}/photos/${photoId}`);
    
    if (response.ok && response.data.success) {
        await loadExistingPhotos(propertyId);
    } else {
        alert('Failed to delete photo: ' + (response.data.error || 'Unknown error'));
    }
}

/**
 * Clear image preview
 */
function clearImagePreview() {
    const container = document.getElementById('imagePreview');
    if (container) container.innerHTML = '';
    const input = document.getElementById('propertyImages');
    if (input) input.value = '';
}

/**
 * Setup image preview on file input change
 */
function setupImagePreview() {
    const input = document.getElementById('propertyImages');
    if (input) {
        input.addEventListener('change', function() {
            const container = document.getElementById('imagePreview');
            container.innerHTML = '';
            
            if (this.files && this.files.length > 0) {
                Array.from(this.files).forEach((file, index) => {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const div = document.createElement('div');
                        div.className = 'image-preview-item';
                        div.innerHTML = `
                            <img src="${e.target.result}" alt="Preview ${index + 1}">
                        `;
                        container.appendChild(div);
                    };
                    reader.readAsDataURL(file);
                });
            }
        });
    }
}

// Initialize image preview setup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupNavigation();
    setupImagePreview();
});

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

// ============================================================================
// SALES TRACKING FUNCTIONS
// ============================================================================

/**
 * Load agent's sales (sold/rented properties)
 */
async function loadMySales() {
    const container = document.getElementById('salesList');
    container.innerHTML = '<div class="loading">Loading sales...</div>';
    
    const response = await API.get('/properties/sold');
    
    if (response.ok && response.data.success) {
        const { properties, summary } = response.data;
        
        // Update summary stats
        document.getElementById('totalSalesCount').textContent = summary.totalSales;
        document.getElementById('totalSalesValue').textContent = '$' + formatPrice(summary.totalValue);
        
        if (properties.length === 0) {
            container.innerHTML = `
                <p class="text-center">No sales recorded yet.</p>
                <p class="text-center text-muted">When you mark properties as sold or rented, they will appear here.</p>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="sales-table">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Property</th>
                            <th>Address</th>
                            <th>Price</th>
                            <th>Status</th>
                            <th>Sold Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${properties.map(p => `
                            <tr>
                                <td>${escapeHtml(p.title)}</td>
                                <td>${escapeHtml(p.address)}, ${escapeHtml(p.city)}</td>
                                <td>$${formatPrice(p.price)}</td>
                                <td><span class="property-status ${p.status}">${capitalize(p.status)}</span></td>
                                <td>${p.sold_date ? formatDate(p.sold_date) : '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } else {
        container.innerHTML = '<p class="text-center">Failed to load sales data.</p>';
    }
}

/**
 * Show the mark as sold/rented confirmation modal
 */
function showMarkSoldModal(propertyId, propertyTitle, action) {
    document.getElementById('markSoldPropertyId').value = propertyId;
    document.getElementById('markSoldAction').value = action;
    document.getElementById('markSoldPropertyName').textContent = propertyTitle;
    document.getElementById('markSoldModalTitle').textContent = 
        action === 'rented' ? 'Mark Property as Rented' : 'Mark Property as Sold';
    openModal('markSoldModal');
}

/**
 * Confirm and execute the mark sold/rented action
 */
async function confirmMarkSold() {
    const propertyId = document.getElementById('markSoldPropertyId').value;
    const action = document.getElementById('markSoldAction').value;
    
    const endpoint = action === 'rented' 
        ? `/properties/${propertyId}/mark-rented`
        : `/properties/${propertyId}/mark-sold`;
    
    const response = await API.put(endpoint, {});
    
    if (response.ok && response.data.success) {
        closeModal('markSoldModal');
        loadProperties();
        
        const cancelledCount = response.data.cancelledAppointments || 0;
        let message = response.data.message || `Property marked as ${action} successfully.`;
        if (cancelledCount > 0) {
            message += ` ${cancelledCount} appointment(s) were cancelled and customers were notified.`;
        }
        alert(message);
    } else {
        alert(response.data.error || 'Failed to update property status.');
    }
}

/**
 * Archive a sold/rented property
 */
async function archiveProperty(propertyId) {
    if (!confirm('Are you sure you want to archive this property? It will be hidden from active listings.')) {
        return;
    }
    
    const response = await API.put(`/properties/${propertyId}/archive`, {});
    
    if (response.ok && response.data.success) {
        loadProperties();
        alert('Property archived successfully.');
    } else {
        alert(response.data.error || 'Failed to archive property.');
    }
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});
