/**
 * Properties Page JavaScript
 * 
 * Handles property listing, filtering, and pagination.
 */

let currentPage = 1;
const pageSize = 12;

document.addEventListener('DOMContentLoaded', () => {
    // Check URL params for pre-filled filters
    const urlParams = new URLSearchParams(window.location.search);
    const cityParam = urlParams.get('city');
    
    if (cityParam) {
        document.getElementById('filterCity').value = cityParam;
    }
    
    loadProperties();
});

/**
 * Load properties with current filters
 */
async function loadProperties() {
    const container = document.getElementById('propertyList');
    const resultsCount = document.getElementById('resultsCount');
    
    container.innerHTML = '<div class="loading">Loading properties...</div>';
    
    // Build query string from filters
    const params = new URLSearchParams();
    
    const city = document.getElementById('filterCity').value;
    const propertyType = document.getElementById('filterType').value;
    const listingType = document.getElementById('filterListingType').value;
    const minPrice = document.getElementById('filterMinPrice').value;
    const maxPrice = document.getElementById('filterMaxPrice').value;
    const bedrooms = document.getElementById('filterBedrooms').value;
    
    if (city) params.set('city', city);
    if (propertyType) params.set('propertyType', propertyType);
    if (listingType) params.set('listingType', listingType);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (bedrooms) params.set('bedrooms', bedrooms);
    
    params.set('page', currentPage);
    params.set('limit', pageSize);
    
    const response = await API.get(`/properties?${params.toString()}`);
    
    if (response.ok && response.data.success) {
        const { properties, pagination } = response.data;
        
        resultsCount.textContent = `Showing ${properties.length} of ${pagination.total} properties`;
        
        if (properties.length === 0) {
            container.innerHTML = '<p class="text-center">No properties found matching your criteria.</p>';
            document.getElementById('pagination').innerHTML = '';
            return;
        }
        
        container.innerHTML = properties.map(property => createPropertyCard(property)).join('');
        renderPagination(pagination);
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
    
    return `
        <div class="property-card" onclick="viewProperty(${property.id})">
            <div class="property-image">
                ${property.image_url 
                    ? `<img src="${property.image_url}" alt="${property.title}">`
                    : '🏠'}
                <span class="property-badge ${badgeClass}">${badgeText}</span>
            </div>
            <div class="property-info">
                <div class="property-price">${priceDisplay}</div>
                <h3 class="property-title">${property.title}</h3>
                <p class="property-address">${property.address}, ${property.city}, ${property.state}</p>
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
 * Render pagination controls
 */
function renderPagination(pagination) {
    const container = document.getElementById('pagination');
    const { page, totalPages } = pagination;
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Previous button
    html += `<button onclick="goToPage(${page - 1})" ${page === 1 ? 'disabled' : ''}>← Prev</button>`;
    
    // Page numbers
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(totalPages, page + 2);
    
    if (startPage > 1) {
        html += `<button onclick="goToPage(1)">1</button>`;
        if (startPage > 2) {
            html += `<button disabled>...</button>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button onclick="goToPage(${i})" class="${i === page ? 'active' : ''}">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<button disabled>...</button>`;
        }
        html += `<button onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }
    
    // Next button
    html += `<button onclick="goToPage(${page + 1})" ${page === totalPages ? 'disabled' : ''}>Next →</button>`;
    
    container.innerHTML = html;
}

/**
 * Go to specific page
 */
function goToPage(page) {
    currentPage = page;
    loadProperties();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Apply filters and reload properties
 */
function applyFilters() {
    currentPage = 1;
    loadProperties();
}

/**
 * Clear all filters
 */
function clearFilters() {
    document.getElementById('filterCity').value = '';
    document.getElementById('filterType').value = '';
    document.getElementById('filterListingType').value = '';
    document.getElementById('filterMinPrice').value = '';
    document.getElementById('filterMaxPrice').value = '';
    document.getElementById('filterBedrooms').value = '';
    currentPage = 1;
    loadProperties();
}

/**
 * Navigate to property details
 */
function viewProperty(propertyId) {
    window.location.href = `property.html?id=${propertyId}`;
}

/**
 * Format price with commas
 */
function formatPrice(price) {
    return Number(price).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/**
 * Format number with commas
 */
function formatNumber(num) {
    return Number(num).toLocaleString('en-US');
}
