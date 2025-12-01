/**
 * Property Detail Page JavaScript
 * 
 * Handles single property view, appointment booking with queue awareness,
 * and agent ratings display.
 */

let currentProperty = null;

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    loadPropertyDetail();
    setupDatePicker();
});

/**
 * Load property details from URL parameter
 */
async function loadPropertyDetail() {
    const container = document.getElementById('propertyDetail');
    const urlParams = new URLSearchParams(window.location.search);
    const propertyId = urlParams.get('id');
    
    if (!propertyId) {
        container.innerHTML = '<p class="text-center">Property not found.</p>';
        return;
    }
    
    const response = await API.get(`/properties/${propertyId}`);
    
    if (response.ok && response.data.success) {
        currentProperty = response.data.property;
        renderPropertyDetail(currentProperty);
        document.title = `${currentProperty.title} - Real Estate`;
        
        // Load agent ratings if agent is assigned
        if (currentProperty.assigned_agent_id) {
            loadAgentRatings(currentProperty.assigned_agent_id);
        }
    } else {
        container.innerHTML = '<p class="text-center">Property not found or no longer available.</p>';
    }
}

/**
 * Load agent ratings summary
 */
async function loadAgentRatings(agentId) {
    const response = await API.get(`/ratings/agent/${agentId}/summary`);
    
    if (response.ok && response.data.success) {
        const summary = response.data.summary;
        const agent = response.data.agent;
        
        if (summary.totalRatings > 0) {
            const ratingHtml = `
                <div class="agent-rating">
                    <div class="rating-stars">
                        ${renderStars(parseFloat(summary.averageRating))}
                        <span class="rating-value">${summary.averageRating}</span>
                    </div>
                    <span class="rating-count">(${summary.totalRatings} ${summary.totalRatings === 1 ? 'review' : 'reviews'})</span>
                </div>
            `;
            
            const agentInfoDiv = document.querySelector('.agent-info');
            if (agentInfoDiv) {
                agentInfoDiv.insertAdjacentHTML('beforeend', ratingHtml);
            }
        }
    }
}

/**
 * Render star rating
 */
function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating - fullStars >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let stars = '';
    for (let i = 0; i < fullStars; i++) stars += '★';
    if (hasHalfStar) stars += '½';
    for (let i = 0; i < emptyStars; i++) stars += '☆';
    
    return `<span class="stars">${stars}</span>`;
}

/**
 * Get all property images (uploaded photos + legacy image_url)
 */
function getPropertyImages(property) {
    const images = [];
    
    // Add uploaded photos first (they take priority)
    if (property.photos && property.photos.length > 0) {
        property.photos.forEach(photo => {
            images.push({
                url: `${CONFIG.API_URL.replace('/api', '')}/uploads/images/${photo.filename}`,
                alt: photo.original_filename || 'Property photo',
                isPrimary: photo.is_primary
            });
        });
    }
    
    // Add legacy image_url if no uploaded photos and it's a valid URL
    if (images.length === 0 && property.image_url && /^https?:\/\//i.test(property.image_url)) {
        images.push({
            url: property.image_url,
            alt: property.title,
            isPrimary: true
        });
    }
    
    return images;
}

/**
 * Render image gallery HTML
 */
function renderImageGallery(images, title) {
    if (images.length === 0) {
        return `<div class="property-detail-image no-image"><span class="placeholder-icon">🏠</span></div>`;
    }
    
    if (images.length === 1) {
        return `
            <div class="property-detail-image">
                <img src="${images[0].url}" alt="${escapeHtml(title)}">
            </div>
        `;
    }
    
    // Multiple images - create gallery
    return `
        <div class="property-gallery" id="propertyGallery">
            <div class="gallery-main">
                <button class="gallery-nav-btn gallery-prev" onclick="changeGalleryImage(-1)">❮</button>
                <img src="${images[0].url}" alt="${escapeHtml(title)}" id="galleryMainImage">
                <button class="gallery-nav-btn gallery-next" onclick="changeGalleryImage(1)">❯</button>
            </div>
            <div class="gallery-thumbnails">
                ${images.map((img, index) => `
                    <div class="gallery-thumb ${index === 0 ? 'active' : ''}" onclick="selectGalleryImage(${index})">
                        <img src="${img.url}" alt="${escapeHtml(img.alt)}">
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Gallery state
let currentGalleryIndex = 0;
let galleryImages = [];

/**
 * Change gallery image by direction
 */
function changeGalleryImage(direction) {
    if (galleryImages.length === 0) return;
    
    currentGalleryIndex = (currentGalleryIndex + direction + galleryImages.length) % galleryImages.length;
    updateGalleryDisplay();
}

/**
 * Select specific gallery image
 */
function selectGalleryImage(index) {
    if (index >= 0 && index < galleryImages.length) {
        currentGalleryIndex = index;
        updateGalleryDisplay();
    }
}

/**
 * Update gallery display
 */
function updateGalleryDisplay() {
    const mainImage = document.getElementById('galleryMainImage');
    if (mainImage && galleryImages[currentGalleryIndex]) {
        mainImage.src = galleryImages[currentGalleryIndex].url;
    }
    
    // Update thumbnail active state
    document.querySelectorAll('.gallery-thumb').forEach((thumb, index) => {
        thumb.classList.toggle('active', index === currentGalleryIndex);
    });
}

/**
 * Render property details
 */
function renderPropertyDetail(property) {
    const container = document.getElementById('propertyDetail');
    
    const priceDisplay = property.listing_type === 'rent' 
        ? `$${formatPrice(property.price)}/month`
        : `$${formatPrice(property.price)}`;
    
    const typeLabel = property.listing_type === 'rent' ? 'For Rent' : 'For Sale';
    
    // Escape user-controlled content to prevent XSS
    const safeTitle = escapeHtml(property.title);
    const safeAddress = escapeHtml(property.address);
    const safeCity = escapeHtml(property.city);
    const safeState = escapeHtml(property.state);
    const safeZipCode = escapeHtml(property.zip_code);
    const safeDescription = escapeHtml(property.description);
    const safeAgentFirstName = escapeHtml(property.agent_first_name);
    const safeAgentLastName = escapeHtml(property.agent_last_name);
    const safeAgentEmail = escapeHtml(property.agent_email);
    const safeAgentPhone = escapeHtml(property.agent_phone);
    
    // Get all property images (uploaded photos + legacy)
    galleryImages = getPropertyImages(property);
    currentGalleryIndex = 0;
    
    container.innerHTML = `
        ${renderImageGallery(galleryImages, property.title)}
        <div class="property-detail-content">
            <div class="property-detail-header">
                <div>
                    <span class="property-badge ${property.listing_type}">${typeLabel}</span>
                    <h1 class="property-detail-title">${safeTitle}</h1>
                </div>
                <div class="property-detail-price">${priceDisplay}</div>
            </div>
            
            <p class="property-detail-address">📍 ${safeAddress}, ${safeCity}, ${safeState} ${safeZipCode}</p>
            
            <div class="property-detail-features">
                ${property.bedrooms > 0 ? `
                    <div class="feature-item">
                        <div class="value">${property.bedrooms}</div>
                        <div class="label">Bedrooms</div>
                    </div>
                ` : ''}
                ${property.bathrooms > 0 ? `
                    <div class="feature-item">
                        <div class="value">${property.bathrooms}</div>
                        <div class="label">Bathrooms</div>
                    </div>
                ` : ''}
                ${property.square_feet > 0 ? `
                    <div class="feature-item">
                        <div class="value">${formatNumber(property.square_feet)}</div>
                        <div class="label">Sq. Ft.</div>
                    </div>
                ` : ''}
                ${property.lot_size > 0 ? `
                    <div class="feature-item">
                        <div class="value">${property.lot_size}</div>
                        <div class="label">Lot (acres)</div>
                    </div>
                ` : ''}
                ${property.year_built ? `
                    <div class="feature-item">
                        <div class="value">${property.year_built}</div>
                        <div class="label">Year Built</div>
                    </div>
                ` : ''}
                <div class="feature-item">
                    <div class="value">${capitalizeFirst(property.property_type)}</div>
                    <div class="label">Type</div>
                </div>
            </div>
            
            ${safeDescription ? `
                <div class="property-description">
                    <h3>Description</h3>
                    <p>${safeDescription}</p>
                </div>
            ` : ''}
            
            ${safeAgentFirstName ? `
                <div class="agent-info">
                    <h3>Listing Agent</h3>
                    <p><strong>${safeAgentFirstName} ${safeAgentLastName}</strong></p>
                    <p>📧 ${safeAgentEmail}</p>
                    <p>📞 ${safeAgentPhone}</p>
                </div>
            ` : ''}
            
            <div class="property-actions">
                ${property.status === 'sold' ? `
                    <div class="unavailable-notice sold">
                        <span class="notice-badge">SOLD</span>
                        <p>This property has been sold and is no longer available.</p>
                    </div>
                ` : property.status === 'rented' ? `
                    <div class="unavailable-notice rented">
                        <span class="notice-badge">RENTED</span>
                        <p>This property has been rented and is no longer available.</p>
                    </div>
                ` : `
                    <button class="btn btn-primary btn-full" onclick="scheduleViewing()">
                        📅 Schedule a Viewing
                    </button>
                `}
            </div>
        </div>
    `;
}

/**
 * Setup date picker constraints
 */
function setupDatePicker() {
    const dateInput = document.getElementById('appointmentDate');
    if (dateInput) {
        // Set minimum date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateInput.min = tomorrow.toISOString().split('T')[0];
        
        // Set maximum date to 30 days from now
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + 30);
        dateInput.max = maxDate.toISOString().split('T')[0];
    }
}

/**
 * Open viewing scheduling modal
 */
function scheduleViewing() {
    if (!isAuthenticated()) {
        // Show login modal
        alert('Please log in to schedule a viewing.');
        openModal('loginModal');
        return;
    }
    
    // Reset form
    const form = document.getElementById('bookingForm');
    if (form) form.reset();
    
    const errorDiv = document.getElementById('bookingError');
    const successDiv = document.getElementById('bookingSuccess');
    const warningDiv = document.getElementById('bookingWarning');
    if (errorDiv) errorDiv.classList.add('hidden');
    if (successDiv) successDiv.classList.add('hidden');
    if (warningDiv) warningDiv.classList.remove('hidden');
    
    setupDatePicker();
    openModal('bookingModal');
}

// UI Constants
const BOOKING_SUCCESS_DISPLAY_MS = 3000;

/**
 * Handle booking form submission
 */
async function handleBooking(event) {
    event.preventDefault();
    
    const errorDiv = document.getElementById('bookingError');
    const successDiv = document.getElementById('bookingSuccess');
    
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    
    const appointmentDate = document.getElementById('appointmentDate').value;
    const appointmentTime = document.getElementById('appointmentTime').value;
    const notes = document.getElementById('appointmentNotes').value;
    
    const response = await API.post('/appointments', {
        propertyId: currentProperty.id,
        appointmentDate,
        appointmentTime,
        notes
    });
    
    if (response.ok && response.data.success) {
        let message = response.data.message;
        
        if (response.data.isQueued) {
            successDiv.innerHTML = `
                <strong>⏳ Added to Queue</strong><br>
                ${message}<br>
                <small>Queue Position: #${response.data.queuePosition}</small>
            `;
        } else {
            successDiv.innerHTML = `
                <strong>✓ Request Submitted</strong><br>
                ${message}
            `;
        }
        successDiv.classList.remove('hidden');
        
        // Clear form
        document.getElementById('bookingForm').reset();
        
        // Close modal after a delay
        setTimeout(() => {
            closeModal('bookingModal');
        }, BOOKING_SUCCESS_DISPLAY_MS);
    } else {
        errorDiv.textContent = response.data.error || 'Failed to submit request. Please try again.';
        errorDiv.classList.remove('hidden');
    }
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

/**
 * Capitalize first letter
 */
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
