/**
 * Shared API Helper Functions
 * 
 * @file api.js
 * @description Provides utility functions for making API requests to the backend.
 *              This file is shared across all frontends (customer, agent, admin).
 * 
 * @usage Include this file AFTER config.js in your HTML:
 *        <script src="../shared/js/api.js"></script>
 * 
 * @requires CONFIG object to be defined (from config.js) with:
 *   - CONFIG.API_URL: Base URL for the API (e.g., 'http://localhost:3000/api')
 *   - CONFIG.STORAGE_KEYS.TOKEN: localStorage key for auth token
 *   - CONFIG.STORAGE_KEYS.USER: localStorage key for user data
 * 
 * @example
 * // Make a GET request
 * const response = await API.get('/properties');
 * 
 * // Make a POST request with data
 * const response = await API.post('/auth/login', { email, password });
 * 
 * // Check response
 * if (response.ok && response.data.success) {
 *     console.log('Success:', response.data);
 * }
 */

const API = {
    /**
     * Make an API request
     * 
     * @param {string} endpoint - API endpoint (without base URL, e.g., '/properties')
     * @param {Object} options - Fetch options (method, headers, body, etc.)
     * @returns {Promise<Object>} Response object with:
     *   - ok {boolean}: true if HTTP status is 2xx
     *   - status {number}: HTTP status code
     *   - data {Object}: Parsed JSON response body
     * 
     * @example
     * const result = await API.request('/users', { method: 'GET' });
     */
    async request(endpoint, options = {}) {
        // Build full URL from config
        const url = `${CONFIG.API_URL}${endpoint}`;
        
        // Default headers for JSON communication
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        // Add authentication token if available
        // Token is stored in localStorage after successful login
        const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        try {
            // Make the fetch request
            const response = await fetch(url, {
                ...options,
                headers
            });
            
            // Parse JSON response
            const data = await response.json();
            
            // Handle authentication errors (401 Unauthorized)
            // Clears stored credentials and optionally redirects to login
            if (response.status === 401) {
                // Clear stored credentials
                localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
                localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
                // Note: Individual frontends can handle redirect differently
                // by checking response.status === 401 in their own code
            }
            
            return {
                ok: response.ok,
                status: response.status,
                data
            };
        } catch (error) {
            // Handle network errors (no connection, timeout, etc.)
            console.error('API request failed:', error);
            return {
                ok: false,
                status: 0,
                data: { 
                    success: false, 
                    error: 'Network error. Please check your connection.' 
                }
            };
        }
    },
    
    /**
     * Make a GET request
     * 
     * @param {string} endpoint - API endpoint
     * @returns {Promise<Object>} Response object
     * 
     * @example
     * const response = await API.get('/properties/featured');
     * if (response.data.success) {
     *     console.log(response.data.properties);
     * }
     */
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },
    
    /**
     * Make a POST request
     * 
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request body data (will be JSON stringified)
     * @returns {Promise<Object>} Response object
     * 
     * @example
     * const response = await API.post('/auth/register', {
     *     email: 'user@example.com',
     *     password: 'securepass123',
     *     firstName: 'John',
     *     lastName: 'Doe',
     *     phone: '+1-555-123-4567'
     * });
     */
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    /**
     * Make a PUT request
     * 
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request body data (will be JSON stringified)
     * @returns {Promise<Object>} Response object
     * 
     * @example
     * const response = await API.put('/properties/123', {
     *     title: 'Updated Property Title',
     *     price: 450000
     * });
     */
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    
    /**
     * Make a DELETE request
     * 
     * @param {string} endpoint - API endpoint
     * @returns {Promise<Object>} Response object
     * 
     * @example
     * const response = await API.delete('/appointments/456');
     */
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
};

/**
 * Export for use in Node.js test environment (if needed)
 * This allows the API object to be imported in test files
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}
