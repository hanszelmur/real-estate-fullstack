/**
 * TODO: Document Upload System
 * 
 * @file documents.js
 * @description Routes for property document/photo management.
 *              This is a skeleton/stub for future implementation.
 * 
 * ## Feature Overview
 * 
 * The Document Upload System allows:
 * 
 * 1. **Property Photos**
 *    - Agents/admins can upload multiple photos per property
 *    - Support for main photo and gallery images
 *    - Image ordering/reordering
 *    - Customers see photo gallery on property detail page
 * 
 * 2. **Floor Plans**
 *    - PDF or image floor plan uploads
 *    - Link to specific property
 *    - Viewable by customers
 * 
 * 3. **Property Documents**
 *    - Title documents, inspection reports
 *    - Agent-only documents (not shown to customers)
 *    - Admin can access all documents
 * 
 * ## Database Schema Addition
 * 
 * ```sql
 * CREATE TABLE IF NOT EXISTS property_documents (
 *     id INT AUTO_INCREMENT PRIMARY KEY,
 *     property_id INT NOT NULL,
 *     document_type ENUM('photo', 'floor_plan', 'title_doc', 'inspection', 'other') NOT NULL,
 *     file_name VARCHAR(255) NOT NULL,
 *     file_path VARCHAR(500) NOT NULL,
 *     file_size INT NOT NULL,
 *     mime_type VARCHAR(100) NOT NULL,
 *     display_order INT DEFAULT 0,
 *     is_main_photo BOOLEAN DEFAULT FALSE,
 *     is_public BOOLEAN DEFAULT TRUE,
 *     uploaded_by INT NOT NULL,
 *     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *     FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
 *     FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
 *     INDEX idx_property (property_id),
 *     INDEX idx_type (document_type)
 * );
 * ```
 * 
 * ## Implementation Notes
 * 
 * **File Storage Options:**
 * 1. Local filesystem (development): Store in `/backend/uploads/`
 * 2. Cloud storage (production): AWS S3, Google Cloud Storage, Azure Blob
 * 
 * **File Validation:**
 * - Max file size: 10MB for images, 25MB for documents
 * - Allowed image types: JPEG, PNG, WebP
 * - Allowed document types: PDF
 * - Sanitize file names to prevent path traversal
 * 
 * **Considerations:**
 * - Thumbnail generation for faster gallery loading
 * - Image compression before storage
 * - CDN for serving static files
 * 
 * @module routes/todo/documents
 * @status TODO - Not yet implemented
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { authenticate, requireRole } = require('../../middleware/auth');

// ============================================================================
// Configuration
// ============================================================================

/**
 * File upload configuration
 * In production, these would come from environment variables
 */
const UPLOAD_CONFIG = {
    // Maximum file sizes in bytes
    maxImageSize: 10 * 1024 * 1024,  // 10 MB
    maxDocumentSize: 25 * 1024 * 1024, // 25 MB
    
    // Allowed MIME types
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedDocumentTypes: ['application/pdf'],
    
    // Upload directory (for local storage)
    uploadDir: 'uploads/',
    
    // Maximum photos per property
    maxPhotosPerProperty: 20
};

// ============================================================================
// TODO: LIST PROPERTY DOCUMENTS
// ============================================================================

/**
 * GET /api/documents/property/:propertyId
 * Get all documents for a property
 * 
 * @param {number} propertyId - Property ID
 * @queryparam {string} type - Filter by document type
 * @queryparam {boolean} publicOnly - Only return public documents
 * 
 * @returns {Object} Documents list
 * @returns {Object[]} documents - Array of document objects
 * @returns {Object} documents[].id - Document ID
 * @returns {string} documents[].fileName - Original file name
 * @returns {string} documents[].url - URL to access the file
 * @returns {string} documents[].type - Document type
 * @returns {boolean} documents[].isMainPhoto - True if this is the main property photo
 * 
 * @example Response:
 * {
 *   "success": true,
 *   "documents": [
 *     {
 *       "id": 1,
 *       "fileName": "front-view.jpg",
 *       "url": "/uploads/properties/1/front-view.jpg",
 *       "type": "photo",
 *       "isMainPhoto": true,
 *       "displayOrder": 1
 *     },
 *     {
 *       "id": 2,
 *       "fileName": "living-room.jpg",
 *       "url": "/uploads/properties/1/living-room.jpg",
 *       "type": "photo",
 *       "isMainPhoto": false,
 *       "displayOrder": 2
 *     }
 *   ]
 * }
 */
router.get('/property/:propertyId', async (req, res) => {
    // TODO: Implement document listing
    //
    // Query example:
    // SELECT * FROM property_documents 
    // WHERE property_id = ? 
    // AND (is_public = TRUE OR ?)  -- Check user role for private docs
    // ORDER BY display_order ASC
    
    res.status(501).json({
        success: false,
        error: 'Document listing not yet implemented',
        todo: 'See backend/routes/todo/documents.js for implementation guide'
    });
});

// ============================================================================
// TODO: UPLOAD DOCUMENT
// ============================================================================

/**
 * POST /api/documents/property/:propertyId
 * Upload a document/photo for a property
 * 
 * @requires Authentication (Agent or Admin)
 * @requires multipart/form-data content type
 * 
 * @param {number} propertyId - Property ID
 * @bodyparam {File} file - The file to upload
 * @bodyparam {string} type - Document type (photo, floor_plan, etc.)
 * @bodyparam {boolean} isMainPhoto - Set as main property photo
 * @bodyparam {boolean} isPublic - Whether customers can see this document
 * 
 * @returns {Object} Upload result
 * @returns {Object} document - Created document object
 * 
 * @example Request (multipart/form-data):
 * file: [binary file data]
 * type: "photo"
 * isMainPhoto: true
 * 
 * @example Response:
 * {
 *   "success": true,
 *   "message": "File uploaded successfully",
 *   "document": {
 *     "id": 5,
 *     "fileName": "front-view.jpg",
 *     "url": "/uploads/properties/1/front-view.jpg",
 *     "type": "photo",
 *     "isMainPhoto": true
 *   }
 * }
 */
router.post('/property/:propertyId', authenticate, requireRole('admin', 'agent'), async (req, res) => {
    // TODO: Implement file upload
    //
    // Implementation steps:
    // 1. Validate user can upload to this property (admin or assigned agent)
    // 2. Parse multipart form data (use multer or busboy)
    // 3. Validate file type and size
    // 4. Generate unique filename to prevent collisions
    // 5. Save file to storage (local or cloud)
    // 6. Create database record
    // 7. Return document info
    //
    // Example using multer:
    // const multer = require('multer');
    // const upload = multer({ dest: 'uploads/' });
    // router.post('...', upload.single('file'), async (req, res) => {...});
    
    res.status(501).json({
        success: false,
        error: 'File upload not yet implemented',
        todo: 'See backend/routes/todo/documents.js for implementation guide',
        hint: 'Consider using multer for handling multipart/form-data'
    });
});

// ============================================================================
// TODO: UPDATE DOCUMENT
// ============================================================================

/**
 * PUT /api/documents/:documentId
 * Update document metadata (order, main photo, visibility)
 * 
 * @param {number} documentId - Document ID
 * @bodyparam {number} displayOrder - New display order
 * @bodyparam {boolean} isMainPhoto - Set as main photo
 * @bodyparam {boolean} isPublic - Update visibility
 */
router.put('/:documentId', authenticate, requireRole('admin', 'agent'), async (req, res) => {
    // TODO: Implement document update
    
    res.status(501).json({
        success: false,
        error: 'Document update not yet implemented'
    });
});

// ============================================================================
// TODO: DELETE DOCUMENT
// ============================================================================

/**
 * DELETE /api/documents/:documentId
 * Delete a document
 * 
 * @param {number} documentId - Document ID
 */
router.delete('/:documentId', authenticate, requireRole('admin', 'agent'), async (req, res) => {
    // TODO: Implement document deletion
    //
    // Steps:
    // 1. Verify user can delete (admin or assigned agent)
    // 2. Delete file from storage
    // 3. Delete database record
    // 4. Update display_order for remaining documents
    
    res.status(501).json({
        success: false,
        error: 'Document deletion not yet implemented'
    });
});

// ============================================================================
// TODO: REORDER DOCUMENTS
// ============================================================================

/**
 * PUT /api/documents/property/:propertyId/reorder
 * Reorder documents (for drag-and-drop photo gallery)
 * 
 * @param {number} propertyId - Property ID
 * @bodyparam {number[]} documentIds - Array of document IDs in new order
 * 
 * @example Request body:
 * {
 *   "documentIds": [3, 1, 5, 2, 4]
 * }
 */
router.put('/property/:propertyId/reorder', authenticate, requireRole('admin', 'agent'), async (req, res) => {
    // TODO: Implement reordering
    //
    // Update display_order based on array position:
    // documentIds.forEach((id, index) => {
    //     UPDATE property_documents SET display_order = index WHERE id = id
    // });
    
    res.status(501).json({
        success: false,
        error: 'Document reordering not yet implemented'
    });
});

module.exports = router;
