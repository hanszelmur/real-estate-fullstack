/**
 * Authentication Functions
 * 
 * Handles user login, registration, verification, and session management.
 */

// Check if user is logged in on page load
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
    setupAuthListeners();
});

/**
 * Update UI based on authentication state
 */
function updateAuthUI() {
    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    const userData = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);
    
    const loginLink = document.getElementById('loginLink');
    const registerLink = document.getElementById('registerLink');
    const logoutLink = document.getElementById('logoutLink');
    const appointmentsLink = document.getElementById('appointmentsLink');
    const messagesLink = document.getElementById('messagesLink');
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    
    if (token && userData) {
        const user = JSON.parse(userData);
        
        // Show logged-in state
        if (loginLink) loginLink.classList.add('hidden');
        if (registerLink) registerLink.classList.add('hidden');
        if (logoutLink) logoutLink.classList.remove('hidden');
        if (appointmentsLink) appointmentsLink.classList.remove('hidden');
        if (messagesLink) messagesLink.classList.remove('hidden');
        if (userInfo) userInfo.classList.remove('hidden');
        if (userName) userName.textContent = `${user.firstName} ${user.lastName}`;
        
        // Load unread message count
        loadUnreadMessageCount();
    } else {
        // Show logged-out state
        if (loginLink) loginLink.classList.remove('hidden');
        if (registerLink) registerLink.classList.remove('hidden');
        if (logoutLink) logoutLink.classList.add('hidden');
        if (appointmentsLink) appointmentsLink.classList.add('hidden');
        if (messagesLink) messagesLink.classList.add('hidden');
        if (userInfo) userInfo.classList.add('hidden');
    }
}

/**
 * Load unread message count for badge
 */
async function loadUnreadMessageCount() {
    if (typeof API === 'undefined') return;
    
    try {
        const response = await API.get('/messages/inbox?unread=true&limit=1');
        if (response.ok && response.data.success) {
            const unreadCount = response.data.unreadCount || 0;
            const badge = document.getElementById('unreadBadge');
            if (badge) {
                if (unreadCount > 0) {
                    badge.textContent = unreadCount;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            }
        }
    } catch (error) {
        // Silently fail - badge just won't show
    }
}

/**
 * Setup event listeners for auth-related elements
 */
function setupAuthListeners() {
    const loginLink = document.getElementById('loginLink');
    const registerLink = document.getElementById('registerLink');
    const logoutLink = document.getElementById('logoutLink');
    
    if (loginLink) {
        loginLink.addEventListener('click', (e) => {
            e.preventDefault();
            openModal('loginModal');
        });
    }
    
    if (registerLink) {
        registerLink.addEventListener('click', (e) => {
            e.preventDefault();
            openModal('registerModal');
        });
    }
    
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }
}

/**
 * Handle login form submission
 */
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    // Clear previous errors
    errorDiv.classList.add('hidden');
    
    const response = await API.post('/auth/login', { email, password });
    
    if (response.ok && response.data.success) {
        // Store token and user data
        localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, response.data.token);
        localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(response.data.user));
        
        // Close modal and update UI
        closeModal('loginModal');
        updateAuthUI();
        
        // Reload page to refresh content
        window.location.reload();
    } else if (response.data.requiresVerification) {
        // Phone verification required
        localStorage.setItem(CONFIG.STORAGE_KEYS.PENDING_PHONE, response.data.phone);
        closeModal('loginModal');
        document.getElementById('verifyPhone').textContent = response.data.phone;
        openModal('verifyModal');
    } else {
        // Show error
        errorDiv.textContent = response.data.error || 'Login failed. Please try again.';
        errorDiv.classList.remove('hidden');
    }
}

/**
 * Handle registration form submission
 */
async function handleRegister(event) {
    event.preventDefault();
    
    const firstName = document.getElementById('registerFirstName').value;
    const lastName = document.getElementById('registerLastName').value;
    const email = document.getElementById('registerEmail').value;
    const phone = document.getElementById('registerPhone').value;
    const password = document.getElementById('registerPassword').value;
    const errorDiv = document.getElementById('registerError');
    
    // Clear previous errors
    errorDiv.classList.add('hidden');
    
    const response = await API.post('/auth/register', {
        firstName,
        lastName,
        email,
        phone,
        password
    });
    
    if (response.ok && response.data.success) {
        // Store phone for verification
        localStorage.setItem(CONFIG.STORAGE_KEYS.PENDING_PHONE, phone);
        
        // Close register modal and open verification modal
        closeModal('registerModal');
        document.getElementById('verifyPhone').textContent = phone;
        openModal('verifyModal');
    } else {
        // Show error
        errorDiv.textContent = response.data.error || 'Registration failed. Please try again.';
        errorDiv.classList.remove('hidden');
    }
}

/**
 * Handle verification form submission
 */
async function handleVerify(event) {
    event.preventDefault();
    
    const phone = localStorage.getItem(CONFIG.STORAGE_KEYS.PENDING_PHONE);
    const code = document.getElementById('verifyCode').value;
    const errorDiv = document.getElementById('verifyError');
    
    // Clear previous errors
    errorDiv.classList.add('hidden');
    
    const response = await API.post('/auth/verify', { phone, code });
    
    if (response.ok && response.data.success) {
        // Store token and user data
        localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, response.data.token);
        localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(response.data.user));
        localStorage.removeItem(CONFIG.STORAGE_KEYS.PENDING_PHONE);
        
        // Close modal and update UI
        closeModal('verifyModal');
        updateAuthUI();
        
        // Show success message
        alert('Your phone has been verified successfully! You are now logged in.');
        
        // Reload page
        window.location.reload();
    } else {
        // Show error
        errorDiv.textContent = response.data.error || 'Verification failed. Please try again.';
        errorDiv.classList.remove('hidden');
    }
}

/**
 * Resend verification code
 */
async function resendCode() {
    const phone = localStorage.getItem(CONFIG.STORAGE_KEYS.PENDING_PHONE);
    
    if (!phone) {
        alert('No phone number found. Please register again.');
        return;
    }
    
    const response = await API.post('/auth/resend-code', { phone });
    
    if (response.ok && response.data.success) {
        alert('A new verification code has been sent.');
    } else {
        alert(response.data.error || 'Failed to resend code. Please try again.');
    }
}

/**
 * Handle logout
 */
function handleLogout() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.PENDING_PHONE);
    
    updateAuthUI();
    
    // Redirect to home page
    window.location.href = 'index.html';
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
    return !!localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
}

/**
 * Get current user data
 */
function getCurrentUser() {
    const userData = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);
    return userData ? JSON.parse(userData) : null;
}

/**
 * Modal helper functions
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        // Clear form inputs
        const forms = modal.querySelectorAll('form');
        forms.forEach(form => form.reset());
        // Hide error messages
        const errors = modal.querySelectorAll('.error-message');
        errors.forEach(error => error.classList.add('hidden'));
    }
}

/**
 * Switch between login and register modals
 */
function switchToRegister() {
    closeModal('loginModal');
    openModal('registerModal');
}

function switchToLogin() {
    closeModal('registerModal');
    openModal('loginModal');
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});
