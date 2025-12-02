/**
 * Admin Dashboard Main Application
 * 
 * Note: Utility functions (escapeHtml, formatPrice, formatNumber, formatDate, formatTime, capitalize, getStatusBadgeColor, etc.)
 * are provided by ../shared/js/utils.js
 */

let usersData = [];
let propertiesData = [];
let appointmentsData = [];
let agentsData = [];

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupNavigation();
    setupImagePreview();
});

/**
 * Check authentication
 */
function checkAuth() {
    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    const userData = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);
    
    if (token && userData) {
        const user = JSON.parse(userData);
        
        if (user.role !== 'admin') {
            alert('Access denied. Admin access only.');
            handleLogout();
            return;
        }
        
        showDashboard(user);
    } else {
        showLoginScreen();
    }
}

function showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
}

function showDashboard(user) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('adminName').textContent = `${user.firstName} ${user.lastName}`;
    
    loadDashboardData();
    loadAgentsList();
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
        
        if (user.role !== 'admin') {
            errorDiv.textContent = 'Access denied. Admin access only.';
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

function handleLogout() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
    showLoginScreen();
}

/**
 * Navigation
 */
function setupNavigation() {
    document.querySelectorAll('.nav-item[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(e.target.dataset.page);
        });
    });
}

function navigateTo(pageName) {
    document.querySelectorAll('.nav-item').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === pageName) link.classList.add('active');
    });
    
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(`${pageName}Page`).classList.add('active');
    
    switch (pageName) {
        case 'dashboard': loadDashboardData(); break;
        case 'users': loadUsers(); break;
        case 'properties': loadProperties(); break;
        case 'sales': loadSalesReport(); break;
        case 'archived': loadArchivedProperties(); break;
        case 'appointments': loadAppointments(); break;
    }
}

/**
 * Load dashboard data
 */
async function loadDashboardData() {
    // Load users count
    const usersResponse = await API.get('/users?limit=100');
    if (usersResponse.ok) {
        const users = usersResponse.data.users;
        document.getElementById('totalUsers').textContent = usersResponse.data.pagination.total;
        document.getElementById('totalAgents').textContent = users.filter(u => u.role === 'agent' && u.is_active).length;
        
        // Recent users
        const recentUsers = users.slice(0, 5);
        document.getElementById('recentUsers').innerHTML = recentUsers.map(u => `
            <div class="list-item">
                <strong>${u.first_name} ${u.last_name}</strong>
                <p>${u.email} - ${capitalize(u.role)}</p>
            </div>
        `).join('') || '<p>No users found</p>';
    }
    
    // Load properties count
    const propertiesResponse = await API.get('/properties?limit=1');
    if (propertiesResponse.ok) {
        document.getElementById('totalProperties').textContent = propertiesResponse.data.pagination.total;
    }
    
    // Load appointments
    const appointmentsResponse = await API.get('/appointments?limit=5');
    if (appointmentsResponse.ok) {
        const appointments = appointmentsResponse.data.appointments;
        document.getElementById('totalAppointments').textContent = appointmentsResponse.data.pagination.total;
        
        document.getElementById('recentAppointments').innerHTML = appointments.map(a => `
            <div class="list-item">
                <strong>${a.property_title}</strong>
                <p>${a.customer_first_name} ${a.customer_last_name} - ${formatDate(a.appointment_date)}</p>
            </div>
        `).join('') || '<p>No appointments found</p>';
    }
}

/**
 * Load agents list for dropdowns
 */
async function loadAgentsList() {
    const response = await API.get('/users/agents');
    if (response.ok) {
        agentsData = response.data.agents;
        updateAgentDropdowns();
    }
}

function updateAgentDropdowns() {
    const agentSelect = document.getElementById('propertyAgent');
    if (agentSelect) {
        agentSelect.innerHTML = '<option value="">-- Select Agent --</option>' +
            agentsData.map(a => `<option value="${a.id}">${a.first_name} ${a.last_name}</option>`).join('');
    }
}

/**
 * Users Management
 */
async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '<tr><td colspan="8" class="loading">Loading...</td></tr>';
    
    const role = document.getElementById('userRoleFilter').value;
    const isActive = document.getElementById('userStatusFilter').value;
    
    let endpoint = '/users?limit=100';
    if (role) endpoint += `&role=${role}`;
    if (isActive) endpoint += `&isActive=${isActive}`;
    
    const response = await API.get(endpoint);
    
    if (response.ok) {
        usersData = response.data.users;
        
        tbody.innerHTML = usersData.map(user => `
            <tr>
                <td>${user.id}</td>
                <td>${user.first_name} ${user.last_name}</td>
                <td>${user.email}</td>
                <td>${user.phone}</td>
                <td><span class="badge badge-info">${capitalize(user.role)}</span></td>
                <td>${user.is_verified ? '✓' : '✗'}</td>
                <td><span class="badge ${user.is_active ? 'badge-success' : 'badge-danger'}">${user.is_active ? 'Active' : 'Inactive'}</span></td>
                <td><button class="btn btn-sm btn-primary" onclick="editUser(${user.id})">Edit</button></td>
            </tr>
        `).join('') || '<tr><td colspan="8">No users found</td></tr>';
    }
}

function editUser(userId) {
    const user = usersData.find(u => u.id === userId);
    if (!user) return;
    
    document.getElementById('userId').value = user.id;
    document.getElementById('userFirstName').value = user.first_name;
    document.getElementById('userLastName').value = user.last_name;
    document.getElementById('userPhone').value = user.phone;
    document.getElementById('userRole').value = user.role;
    document.getElementById('userVerified').checked = user.is_verified;
    document.getElementById('userActive').checked = user.is_active;
    document.getElementById('userPassword').value = '';
    document.getElementById('userModalTitle').textContent = 'Edit User';
    
    openModal('userModal');
}

async function saveUser(event) {
    event.preventDefault();
    
    const id = document.getElementById('userId').value;
    const errorDiv = document.getElementById('userError');
    errorDiv.classList.add('hidden');
    
    const data = {
        firstName: document.getElementById('userFirstName').value,
        lastName: document.getElementById('userLastName').value,
        phone: document.getElementById('userPhone').value,
        role: document.getElementById('userRole').value,
        isVerified: document.getElementById('userVerified').checked,
        isActive: document.getElementById('userActive').checked
    };
    
    const password = document.getElementById('userPassword').value;
    if (password) data.password = password;
    
    const response = await API.put(`/users/${id}`, data);
    
    if (response.ok) {
        closeModal('userModal');
        loadUsers();
        alert('User updated successfully');
    } else {
        errorDiv.textContent = response.data.error || 'Failed to update user';
        errorDiv.classList.remove('hidden');
    }
}

/**
 * Properties Management
 */
async function loadProperties() {
    const tbody = document.getElementById('propertiesTableBody');
    tbody.innerHTML = '<tr><td colspan="8" class="loading">Loading...</td></tr>';
    
    const status = document.getElementById('propertyStatusFilter').value;
    const type = document.getElementById('propertyTypeFilter').value;
    
    let endpoint = '/properties?limit=100';
    if (status) endpoint += `&status=${status}`;
    if (type) endpoint += `&propertyType=${type}`;
    
    const response = await API.get(endpoint);
    
    if (response.ok) {
        propertiesData = response.data.properties;
        
        tbody.innerHTML = propertiesData.map(p => {
            const showSaleButtons = ['available', 'pending'].includes(p.status);
            const showArchiveButton = ['sold', 'rented'].includes(p.status) && !p.is_archived;
            const isForRent = p.listing_type === 'rent';
            return `
            <tr>
                <td>${p.id}</td>
                <td>${p.title}</td>
                <td>${p.city}, ${p.state}</td>
                <td>$${formatPrice(p.price)}${p.listing_type === 'rent' ? '/mo' : ''}</td>
                <td>${capitalize(p.property_type)}</td>
                <td><span class="badge ${getStatusBadge(p.status)}">${capitalize(p.status)}</span></td>
                <td>${p.agent_first_name ? `${p.agent_first_name} ${p.agent_last_name}` : '-'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editProperty(${p.id})">Edit</button>
                    ${showSaleButtons ? `<button class="btn btn-sm btn-success" onclick="showMarkSoldModal(${p.id}, '${escapeHtml(p.title)}', '${isForRent ? 'rented' : 'sold'}')">${isForRent ? 'Rented' : 'Sold'}</button>` : ''}
                    ${showArchiveButton ? `<button class="btn btn-sm btn-secondary" onclick="archiveProperty(${p.id})">Archive</button>` : ''}
                    <button class="btn btn-sm btn-danger" onclick="deleteProperty(${p.id})">Delete</button>
                </td>
            </tr>
        `}).join('') || '<tr><td colspan="8">No properties found</td></tr>';
    }
}

function showAddPropertyModal() {
    document.getElementById('propertyForm').reset();
    document.getElementById('propertyId').value = '';
    document.getElementById('propertyModalTitle').textContent = 'Add Property';
    updateAgentDropdowns();
    clearImagePreview();
    clearExistingPhotos();
    openModal('propertyModal');
}

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
    document.getElementById('propertyFeatured').checked = property.featured;
    
    updateAgentDropdowns();
    document.getElementById('propertyAgent').value = property.assigned_agent_id || '';
    
    document.getElementById('propertyModalTitle').textContent = 'Edit Property';
    clearImagePreview();
    
    // Load existing photos
    await loadExistingPhotos(propertyId);
    
    openModal('propertyModal');
}

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
        featured: document.getElementById('propertyFeatured').checked,
        assignedAgentId: document.getElementById('propertyAgent').value || null
    };
    
    const response = id 
        ? await API.put(`/properties/${id}`, data)
        : await API.post('/properties', data);
    
    if (response.ok) {
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
                        div.innerHTML = `<img src="${e.target.result}" alt="Preview ${index + 1}">`;
                        container.appendChild(div);
                    };
                    reader.readAsDataURL(file);
                });
            }
        });
    }
}

async function deleteProperty(propertyId) {
    if (!confirm('Are you sure you want to delete this property? This action cannot be undone.')) {
        return;
    }
    
    const response = await API.delete(`/properties/${propertyId}`);
    
    if (response.ok) {
        loadProperties();
        alert('Property deleted successfully');
    } else {
        alert(response.data.error || 'Failed to delete property');
    }
}

/**
 * Appointments Management
 */
async function loadAppointments() {
    const tbody = document.getElementById('appointmentsTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Loading...</td></tr>';
    
    const status = document.getElementById('appointmentStatusFilter').value;
    
    let endpoint = '/appointments?limit=100';
    if (status) endpoint += `&status=${status}`;
    
    const response = await API.get(endpoint);
    
    if (response.ok) {
        appointmentsData = response.data.appointments;
        
        tbody.innerHTML = appointmentsData.map(a => `
            <tr>
                <td>${a.id}</td>
                <td>${a.property_title}</td>
                <td>${a.customer_first_name} ${a.customer_last_name}</td>
                <td>${a.agent_first_name ? `${a.agent_first_name} ${a.agent_last_name}` : '-'}</td>
                <td>${formatDate(a.appointment_date)} ${formatTime(a.appointment_time)}</td>
                <td><span class="badge ${getStatusBadge(a.status)}">${capitalize(a.status)}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editAppointment(${a.id})">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteAppointment(${a.id})">Delete</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="7">No appointments found</td></tr>';
    }
}

function editAppointment(appointmentId) {
    const apt = appointmentsData.find(a => a.id === appointmentId);
    if (!apt) return;
    
    document.getElementById('appointmentId').value = apt.id;
    document.getElementById('appointmentProperty').textContent = apt.property_title;
    document.getElementById('appointmentCustomer').textContent = `${apt.customer_first_name} ${apt.customer_last_name}`;
    document.getElementById('appointmentStatus').value = apt.status;
    document.getElementById('appointmentDate').value = apt.appointment_date.split('T')[0];
    document.getElementById('appointmentTime').value = apt.appointment_time;
    document.getElementById('appointmentNotes').value = apt.notes || '';
    
    openModal('appointmentModal');
}

async function saveAppointment(event) {
    event.preventDefault();
    
    const id = document.getElementById('appointmentId').value;
    const errorDiv = document.getElementById('appointmentError');
    errorDiv.classList.add('hidden');
    
    const data = {
        status: document.getElementById('appointmentStatus').value,
        appointmentDate: document.getElementById('appointmentDate').value,
        appointmentTime: document.getElementById('appointmentTime').value,
        notes: document.getElementById('appointmentNotes').value
    };
    
    const response = await API.put(`/appointments/${id}`, data);
    
    if (response.ok) {
        closeModal('appointmentModal');
        loadAppointments();
        alert('Appointment updated successfully');
    } else {
        errorDiv.textContent = response.data.error || 'Failed to update appointment';
        errorDiv.classList.remove('hidden');
    }
}

async function deleteAppointment(appointmentId) {
    if (!confirm('Are you sure you want to delete this appointment?')) {
        return;
    }
    
    const response = await API.delete(`/appointments/${appointmentId}`);
    
    if (response.ok) {
        loadAppointments();
        alert('Appointment deleted successfully');
    } else {
        alert(response.data.error || 'Failed to delete appointment');
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
 * Status badge helper - uses shared getStatusBadgeColor for consistency
 */
function getStatusBadge(status) {
    return getStatusBadgeColor(status);
}

// ============================================================================
// SALES TRACKING FUNCTIONS
// ============================================================================

/**
 * Load sales report
 */
async function loadSalesReport() {
    const tbody = document.getElementById('salesTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Loading...</td></tr>';
    
    // Update agents dropdown for filter
    updateSalesAgentDropdown();
    
    const agentId = document.getElementById('salesAgentFilter')?.value || '';
    const startDate = document.getElementById('salesStartDate')?.value || '';
    const endDate = document.getElementById('salesEndDate')?.value || '';
    
    let endpoint = '/properties/sold?limit=100';
    if (agentId) endpoint += `&agentId=${agentId}`;
    if (startDate) endpoint += `&startDate=${startDate}`;
    if (endDate) endpoint += `&endDate=${endDate}`;
    
    const response = await API.get(endpoint);
    
    if (response.ok && response.data.success) {
        const { properties, summary } = response.data;
        
        // Update summary stats
        document.getElementById('adminTotalSales').textContent = summary.totalSales;
        document.getElementById('adminTotalValue').textContent = '$' + formatPrice(summary.totalValue);
        
        if (properties.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No sales found</td></tr>';
            return;
        }
        
        tbody.innerHTML = properties.map(p => `
            <tr>
                <td>${escapeHtml(p.title)}</td>
                <td>${escapeHtml(p.address)}, ${escapeHtml(p.city)}</td>
                <td>$${formatPrice(p.price)}</td>
                <td>${p.agent_first_name ? `${p.agent_first_name} ${p.agent_last_name}` : '-'}</td>
                <td>${p.sold_by_first_name ? `${p.sold_by_first_name} ${p.sold_by_last_name}` : '-'}</td>
                <td><span class="badge ${getStatusBadge(p.status)}">${capitalize(p.status)}</span></td>
                <td>${p.sold_date ? formatDate(p.sold_date) : '-'}</td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Failed to load sales data</td></tr>';
    }
}

/**
 * Update sales agent filter dropdown
 */
function updateSalesAgentDropdown() {
    const select = document.getElementById('salesAgentFilter');
    if (select && agentsData.length > 0) {
        const currentValue = select.value;
        select.innerHTML = '<option value="">All Agents</option>' +
            agentsData.map(a => `<option value="${a.id}">${a.first_name} ${a.last_name}</option>`).join('');
        select.value = currentValue;
    }
}

/**
 * Clear sales filters
 */
function clearSalesFilters() {
    document.getElementById('salesAgentFilter').value = '';
    document.getElementById('salesStartDate').value = '';
    document.getElementById('salesEndDate').value = '';
    loadSalesReport();
}

/**
 * Export sales to CSV
 */
function exportSalesCSV() {
    const rows = [];
    const table = document.getElementById('salesTable');
    const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent);
    rows.push(headers.join(','));
    
    const dataRows = table.querySelectorAll('tbody tr');
    dataRows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td')).map(td => {
            let text = td.textContent.trim();
            // Escape quotes and wrap in quotes if contains comma
            if (text.includes(',') || text.includes('"')) {
                text = '"' + text.replace(/"/g, '""') + '"';
            }
            return text;
        });
        if (cells.length > 1) { // Skip loading rows
            rows.push(cells.join(','));
        }
    });
    
    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Load archived properties
 */
async function loadArchivedProperties() {
    const tbody = document.getElementById('archivedTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Loading...</td></tr>';
    
    const response = await API.get('/properties/archived?limit=100');
    
    if (response.ok && response.data.success) {
        const { properties } = response.data;
        
        if (properties.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No archived properties</td></tr>';
            return;
        }
        
        tbody.innerHTML = properties.map(p => `
            <tr>
                <td>${escapeHtml(p.title)}</td>
                <td>${escapeHtml(p.address)}, ${escapeHtml(p.city)}</td>
                <td>$${formatPrice(p.price)}</td>
                <td><span class="badge ${getStatusBadge(p.status)}">${capitalize(p.status)}</span></td>
                <td>${p.sold_date ? formatDate(p.sold_date) : '-'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="unarchiveProperty(${p.id})">Unarchive</button>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Failed to load archived properties</td></tr>';
    }
}

/**
 * Show mark as sold modal (Admin)
 */
function showMarkSoldModal(propertyId, propertyTitle, action) {
    document.getElementById('markSoldPropertyId').value = propertyId;
    document.getElementById('markSoldAction').value = action;
    document.getElementById('markSoldPropertyName').textContent = propertyTitle;
    document.getElementById('markSoldModalTitle').textContent = 
        action === 'rented' ? 'Mark Property as Rented' : 'Mark Property as Sold';
    
    // Update agent dropdown
    const select = document.getElementById('soldByAgentId');
    select.innerHTML = '<option value="">-- Select Agent --</option>' +
        agentsData.map(a => `<option value="${a.id}">${a.first_name} ${a.last_name}</option>`).join('');
    
    openModal('markSoldModal');
}

/**
 * Confirm mark sold (Admin)
 */
async function confirmMarkSold(event) {
    event.preventDefault();
    
    const propertyId = document.getElementById('markSoldPropertyId').value;
    const action = document.getElementById('markSoldAction').value;
    const soldByAgentId = document.getElementById('soldByAgentId').value;
    
    const endpoint = action === 'rented' 
        ? `/properties/${propertyId}/mark-rented`
        : `/properties/${propertyId}/mark-sold`;
    
    const body = soldByAgentId ? { soldByAgentId: parseInt(soldByAgentId) } : {};
    
    const response = await API.put(endpoint, body);
    
    if (response.ok && response.data.success) {
        closeModal('markSoldModal');
        loadProperties();
        
        const cancelledCount = response.data.cancelledAppointments || 0;
        alert(`Property marked as ${action}. ${cancelledCount} appointment(s) cancelled.`);
    } else {
        alert(response.data.error || 'Failed to update property status.');
    }
}

/**
 * Archive a property (Admin)
 */
async function archiveProperty(propertyId) {
    if (!confirm('Are you sure you want to archive this property?')) {
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

/**
 * Unarchive a property (Admin only)
 */
async function unarchiveProperty(propertyId) {
    if (!confirm('Are you sure you want to unarchive this property?')) {
        return;
    }
    
    const response = await API.put(`/properties/${propertyId}/unarchive`, {});
    
    if (response.ok && response.data.success) {
        loadArchivedProperties();
        alert('Property unarchived successfully.');
    } else {
        alert(response.data.error || 'Failed to unarchive property.');
    }
}

// Close modal on outside click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});
