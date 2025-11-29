/**
 * Agent Frontend Configuration
 * 
 * @file config.js
 * @description Contains API endpoint and other configuration settings for the agent portal.
 * 
 * API URL Override:
 * You can override the default API URL by setting window.API_URL_OVERRIDE before loading this script.
 * This allows switching between different backend servers without modifying this file.
 * 
 * @example Override via inline script (place before config.js):
 *   <script>window.API_URL_OVERRIDE = 'https://api.production.example.com/api';</script>
 *   <script src="js/config.js"></script>
 * 
 * @example Override via query parameter:
 *   Open the app with ?api=http://localhost:4000/api
 *   The config will automatically use this URL.
 */

// Check for API URL override from query parameter
(function() {
    const urlParams = new URLSearchParams(window.location.search);
    const apiOverride = urlParams.get('api');
    if (apiOverride) {
        window.API_URL_OVERRIDE = apiOverride;
        console.log('[CONFIG] API URL overridden via query parameter:', apiOverride);
    }
})();

const CONFIG = {
    /**
     * Backend API URL
     * Priority: 
     *   1. window.API_URL_OVERRIDE (if set)
     *   2. Query parameter ?api=<url>
     *   3. Default localhost:3000
     */
    API_URL: window.API_URL_OVERRIDE || 'http://localhost:3000/api',
    
    /**
     * Local storage keys for persisting user session
     * TOKEN: Authentication token from backend
     * USER: User profile data (id, name, role, etc.)
     */
    STORAGE_KEYS: {
        TOKEN: 'agent_portal_token',
        USER: 'agent_portal_user'
    },
    
    /**
     * Application name for display purposes
     */
    APP_NAME: 'Real Estate - Agent Portal',
    
    /**
     * Default pagination settings
     */
    PAGINATION: {
        DEFAULT_PAGE_SIZE: 20,
        MAX_PAGE_SIZE: 100
    }
};

// Log configuration on load (helpful for debugging)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('[CONFIG] Agent Portal Configuration:', {
        API_URL: CONFIG.API_URL,
        APP_NAME: CONFIG.APP_NAME
    });
}
