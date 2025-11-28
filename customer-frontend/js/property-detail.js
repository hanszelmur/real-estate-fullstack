/**
 * Property Detail Page JavaScript
 * 
 * Handles single property view and appointment booking.
 */

let currentProperty = null;

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
    } else {
        container.innerHTML = '<p class="text-center">Property not found or no longer available.</p>';
    }
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
    
    container.innerHTML = `
        <div class="property-detail-image">
            ${property.image_url 
                ? `<img src="${property.image_url}" alt="${property.title}">`
                : '🏠'}
        </div>
        <div class="property-detail-content">
            <div class="property-detail-header">
                <div>
                    <span class="property-badge ${property.listing_type}">${typeLabel}</span>
                    <h1 class="property-detail-title">${property.title}</h1>
                </div>
                <div class="property-detail-price">${priceDisplay}</div>
            </div>
            
            <p class="property-detail-address">📍 ${property.address}, ${property.city}, ${property.state} ${property.zip_code}</p>
            
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
            
            ${property.description ? `
                <div class="property-description">
                    <h3>Description</h3>
                    <p>${property.description}</p>
                </div>
            ` : ''}
            
            ${property.agent_first_name ? `
                <div class="agent-info">
                    <h3>Listing Agent</h3>
                    <p><strong>${property.agent_first_name} ${property.agent_last_name}</strong></p>
                    <p>📧 ${property.agent_email}</p>
                    <p>📞 ${property.agent_phone}</p>
                </div>
            ` : ''}
            
            <div class="property-actions">
                <button class="btn btn-primary btn-full" onclick="scheduleViewing()">
                    📅 Schedule a Viewing
                </button>
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
    if (errorDiv) errorDiv.classList.add('hidden');
    if (successDiv) successDiv.classList.add('hidden');
    
    setupDatePicker();
    openModal('bookingModal');
}

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
        successDiv.textContent = 'Your viewing request has been submitted! We will confirm shortly.';
        successDiv.classList.remove('hidden');
        
        // Clear form
        document.getElementById('bookingForm').reset();
        
        // Close modal after a delay
        setTimeout(() => {
            closeModal('bookingModal');
        }, 2000);
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
