/**
 * @deprecated This file is deprecated. Use the shared API module instead:
 * <script src="../shared/js/api.js"></script>
 * 
 * This file is kept for backward compatibility only.
 * All new development should use the shared API module.
 * 
 * API Helper Functions for Admin Portal
 */
const API = {
    async request(endpoint, options = {}) {
        const url = `${CONFIG.API_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        try {
            const response = await fetch(url, { ...options, headers });
            const data = await response.json();
            
            if (response.status === 401) {
                localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
                localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
                window.location.reload();
            }
            
            return { ok: response.ok, status: response.status, data };
        } catch (error) {
            console.error('API request failed:', error);
            return { ok: false, status: 0, data: { success: false, error: 'Network error' } };
        }
    },
    
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },
    
    async post(endpoint, data) {
        return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) });
    },
    
    async put(endpoint, data) {
        return this.request(endpoint, { method: 'PUT', body: JSON.stringify(data) });
    },
    
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
};
