/**
 * Main App JavaScript
 * 
 * Handles home page functionality including featured properties.
 * 
 * Note: Utility functions (escapeHtml, formatPrice, formatNumber, etc.)
 * are provided by ../shared/js/utils.js
 */

document.addEventListener('DOMContentLoaded', () => {
    loadFeaturedProperties();
});

/**
 * Load featured properties on homepage
 */
async function loadFeaturedProperties() {
    const container = document.getElementById('featuredProperties');
    if (!container) return;
    
    const response = await API.get('/properties/featured');
    
    if (response.ok && response.data.success) {
        const properties = response.data.properties;
        
        if (properties.length === 0) {
            container.innerHTML = '<p class="text-center">No featured properties available.</p>';
            return;
        }
        
        container.innerHTML = properties.map(property => createPropertyCard(property)).join('');
    } else {
        container.innerHTML = '<p class="text-center">Failed to load properties. Please try again later.</p>';
    }
}

/**
 * Create HTML for a property card
 */
function createPropertyCard(property) {
    const priceDisplay = property.listing_type === 'rent' 
        ? `$${formatPrice(property.price)}<small>/mo</small>`
        : `$${formatPrice(property.price)}`;
    
    const badgeClass = property.featured ? 'featured' : (property.listing_type === 'rent' ? 'rent' : '');
    const badgeText = property.featured ? 'Featured' : (property.listing_type === 'rent' ? 'For Rent' : 'For Sale');
    
    // Escape user-controlled content to prevent XSS
    const safeTitle = escapeHtml(property.title);
    const safeAddress = escapeHtml(property.address);
    const safeCity = escapeHtml(property.city);
    const safeState = escapeHtml(property.state);
    
    // For image URL, only allow http/https URLs
    const safeImageUrl = property.image_url && /^https?:\/\//i.test(property.image_url) 
        ? property.image_url 
        : null;
    
    return `
        <div class="property-card" onclick="viewProperty(${parseInt(property.id)})">
            <div class="property-image">
                ${safeImageUrl 
                    ? `<img src="${safeImageUrl}" alt="${safeTitle}">`
                    : '🏠'}
                <span class="property-badge ${badgeClass}">${badgeText}</span>
            </div>
            <div class="property-info">
                <div class="property-price">${priceDisplay}</div>
                <h3 class="property-title">${safeTitle}</h3>
                <p class="property-address">${safeAddress}, ${safeCity}, ${safeState}</p>
                <div class="property-features">
                    ${property.bedrooms > 0 ? `<span>🛏️ ${property.bedrooms} Beds</span>` : ''}
                    ${property.bathrooms > 0 ? `<span>🛁 ${property.bathrooms} Baths</span>` : ''}
                    ${property.square_feet > 0 ? `<span>📐 ${formatNumber(property.square_feet)} sqft</span>` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Navigate to property details page
 */
function viewProperty(propertyId) {
    window.location.href = `property.html?id=${propertyId}`;
}

/**
 * Search properties
 */
function searchProperties() {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput.value.trim();
    
    if (query) {
        window.location.href = `properties.html?city=${encodeURIComponent(query)}`;
    } else {
        window.location.href = 'properties.html';
    }
}

// Allow pressing Enter in search box
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchProperties();
            }
        });
    }
});
