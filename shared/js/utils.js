/**
 * Shared Utility Functions
 * 
 * @file utils.js
 * @description Common utility functions shared across all frontends.
 *              Includes formatting, escaping, and helper functions.
 * 
 * @usage Include this file in your HTML:
 *        <script src="../shared/js/utils.js"></script>
 */

/**
 * Escape HTML special characters to prevent XSS attacks
 * 
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for HTML insertion
 * 
 * @example
 * const safeText = escapeHtml('<script>alert("xss")</script>');
 * // Returns: '&lt;script&gt;alert("xss")&lt;/script&gt;'
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Format a number as a price with commas (no decimals)
 * 
 * @param {number|string} price - Price value to format
 * @returns {string} Formatted price string with commas
 * 
 * @example
 * formatPrice(1234567); // Returns: '1,234,567'
 */
function formatPrice(price) {
    return Number(price).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/**
 * Format a number with commas for display
 * 
 * @param {number|string} num - Number to format
 * @returns {string} Formatted number string with commas
 * 
 * @example
 * formatNumber(1500); // Returns: '1,500'
 */
function formatNumber(num) {
    return Number(num).toLocaleString('en-US');
}

/**
 * Format a date string for display
 * 
 * @param {string} dateStr - ISO date string or Date object
 * @returns {string} Formatted date string (e.g., 'Jan 15, 2024')
 * 
 * @example
 * formatDate('2024-01-15'); // Returns: 'Jan 15, 2024'
 */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Format a time string for display
 * 
 * @param {string} timeStr - Time string in HH:MM:SS format
 * @returns {string} Formatted time string (e.g., '9:00 AM')
 * 
 * @example
 * formatTime('09:00:00'); // Returns: '9:00 AM'
 * formatTime('14:30:00'); // Returns: '2:30 PM'
 */
function formatTime(timeStr) {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

/**
 * Format a datetime string for display
 * 
 * @param {string} dateTimeStr - ISO datetime string
 * @returns {string} Formatted datetime string
 * 
 * @example
 * formatDateTime('2024-01-15T14:30:00'); // Returns: 'Jan 15, 2024 2:30 PM'
 */
function formatDateTime(dateTimeStr) {
    const date = new Date(dateTimeStr);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

/**
 * Validate email format
 * 
 * @param {string} email - Email address to validate
 * @returns {boolean} True if email format is valid
 * 
 * @example
 * validateEmail('user@example.com'); // Returns: true
 * validateEmail('invalid-email'); // Returns: false
 */
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate phone number format (basic validation)
 * 
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if phone format is valid
 * 
 * @example
 * validatePhone('+1-555-123-4567'); // Returns: true
 */
function validatePhone(phone) {
    const phoneRegex = /^[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/;
    return phoneRegex.test(phone);
}

/**
 * Debounce a function call
 * 
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 * 
 * @example
 * const debouncedSearch = debounce(searchProperties, 300);
 * searchInput.addEventListener('input', debouncedSearch);
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Get query parameter from URL
 * 
 * @param {string} name - Parameter name
 * @returns {string|null} Parameter value or null if not found
 * 
 * @example
 * // URL: http://example.com/property.html?id=123
 * getQueryParam('id'); // Returns: '123'
 */
function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

/**
 * Create a status badge HTML element
 * 
 * @param {string} status - Status value (e.g., 'confirmed', 'pending', 'cancelled')
 * @returns {string} HTML string for status badge
 * 
 * @example
 * createStatusBadge('confirmed'); // Returns: '<span class="status-badge confirmed">Confirmed</span>'
 */
function createStatusBadge(status) {
    const statusClass = status ? status.toLowerCase().replace(/\s+/g, '-') : '';
    const displayText = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
    return `<span class="status-badge ${escapeHtml(statusClass)}">${escapeHtml(displayText)}</span>`;
}

/**
 * Show a toast notification (if toast container exists)
 * 
 * @param {string} message - Message to display
 * @param {string} type - Notification type ('success', 'error', 'warning', 'info')
 * @param {number} duration - Display duration in milliseconds (default: 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
    // Create toast container if it doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999;';
        document.body.appendChild(container);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        padding: 12px 24px;
        margin-bottom: 10px;
        border-radius: 4px;
        color: white;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease;
    `;
    
    // Set background color based on type
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };
    toast.style.backgroundColor = colors[type] || colors.info;
    
    toast.textContent = message;
    container.appendChild(toast);
    
    // Remove toast after duration
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Export for use in Node.js test environment (if needed)
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        escapeHtml,
        formatPrice,
        formatNumber,
        formatDate,
        formatTime,
        formatDateTime,
        validateEmail,
        validatePhone,
        debounce,
        getQueryParam,
        createStatusBadge,
        showToast
    };
}
