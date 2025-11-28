/**
 * Admin Dashboard Main Application
 */

let usersData = [];
let propertiesData = [];
let appointmentsData = [];
let agentsData = [];

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupNavigation();
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
        
        tbody.innerHTML = propertiesData.map(p => `
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
                    <button class="btn btn-sm btn-danger" onclick="deleteProperty(${p.id})">Delete</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="8">No properties found</td></tr>';
    }
}

function showAddPropertyModal() {
    document.getElementById('propertyForm').reset();
    document.getElementById('propertyId').value = '';
    document.getElementById('propertyModalTitle').textContent = 'Add Property';
    updateAgentDropdowns();
    openModal('propertyModal');
}

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
    document.getElementById('propertyFeatured').checked = property.featured;
    
    updateAgentDropdowns();
    document.getElementById('propertyAgent').value = property.assigned_agent_id || '';
    
    document.getElementById('propertyModalTitle').textContent = 'Edit Property';
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
        closeModal('propertyModal');
        loadProperties();
        alert(id ? 'Property updated successfully' : 'Property created successfully');
    } else {
        errorDiv.textContent = response.data.error || 'Failed to save property';
        errorDiv.classList.remove('hidden');
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
 * Utilities
 */
function formatPrice(price) {
    return Number(price).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
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

function getStatusBadge(status) {
    switch (status) {
        case 'available': case 'confirmed': case 'completed': return 'badge-success';
        case 'pending': return 'badge-warning';
        case 'sold': case 'rented': return 'badge-info';
        case 'cancelled': return 'badge-danger';
        default: return 'badge-secondary';
    }
}

// Close modal on outside click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});
