# Shared Frontend Code

This folder contains JavaScript utility files shared across all frontend applications (customer, agent, admin portals).

## Files

### `js/api.js`
HTTP client wrapper for making API requests to the backend. Provides a consistent interface for GET, POST, PUT, and DELETE requests with automatic authentication token handling.

**Key Features:**
- Automatic token injection from localStorage
- JSON request/response handling  
- Error handling for network failures
- 401 authentication error handling (clears stored credentials)

**Usage:**
```html
<!-- Include AFTER config.js -->
<script src="../shared/js/api.js"></script>
```

**Example:**
```javascript
// GET request
const response = await API.get('/properties');
if (response.ok && response.data.success) {
    console.log(response.data.properties);
}

// POST request
const response = await API.post('/auth/login', { email, password });
```

### `js/utils.js`
Common utility functions for formatting, validation, and UI helpers.

**Available Functions:**
- `escapeHtml(str)` - Prevent XSS by escaping HTML special characters
- `formatPrice(price)` - Format numbers as prices with commas
- `formatNumber(num)` - Format numbers with commas
- `formatDate(dateStr)` - Format dates as "Jan 15, 2024"
- `formatTime(timeStr)` - Format times as "9:00 AM"
- `formatDateTime(dateTimeStr)` - Combined date and time formatting
- `validateEmail(email)` - Basic email format validation
- `validatePhone(phone)` - Basic phone format validation
- `debounce(func, wait)` - Debounce function calls
- `getQueryParam(name)` - Get URL query parameters
- `createStatusBadge(status)` - Create HTML status badge
- `showToast(message, type, duration)` - Display toast notifications

**Usage:**
```html
<script src="../shared/js/utils.js"></script>
```

## Integration Guide

### Updating Existing Frontends

1. **Update HTML files** to include shared scripts:
   ```html
   <!-- Load config first (portal-specific settings) -->
   <script src="js/config.js"></script>
   
   <!-- Load shared utilities -->
   <script src="../shared/js/api.js"></script>
   <script src="../shared/js/utils.js"></script>
   
   <!-- Load portal-specific scripts -->
   <script src="js/app.js"></script>
   ```

2. **Portal-specific config.js** should define:
   ```javascript
   const CONFIG = {
       API_URL: 'http://localhost:3000/api',
       STORAGE_KEYS: {
           TOKEN: 'your_portal_token_key',
           USER: 'your_portal_user_key'
       }
   };
   ```

3. **Remove duplicate code** from portal-specific js/api.js files.

## Notes

- The API object requires `CONFIG` to be defined before `api.js` is loaded
- All functions use ES6+ syntax (async/await, template literals)
- Functions are designed to work in modern browsers (Chrome, Firefox, Safari, Edge)
