/**
 * API Helper Functions
 * 
 * Provides utility functions for making API requests to the backend.
 */

const API = {
    /**
     * Make an API request
     * @param {string} endpoint - API endpoint (without base URL)
     * @param {object} options - Fetch options
     * @returns {Promise} - Response data
     */
    async request(endpoint, options = {}) {
        const url = `${CONFIG.API_URL}${endpoint}`;
        
        // Default headers
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        // Add auth token if available
        const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        try {
            const response = await fetch(url, {
                ...options,
                headers
            });
            
            const data = await response.json();
            
            // Handle authentication errors
            if (response.status === 401) {
                // Clear stored credentials
                localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
                localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
                // Optionally redirect to login
            }
            
            return {
                ok: response.ok,
                status: response.status,
                data
            };
        } catch (error) {
            console.error('API request failed:', error);
            return {
                ok: false,
                status: 0,
                data: { success: false, error: 'Network error. Please check your connection.' }
            };
        }
    },
    
    /**
     * GET request
     */
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },
    
    /**
     * POST request
     */
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    /**
     * PUT request
     */
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    
    /**
     * DELETE request
     */
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
};
