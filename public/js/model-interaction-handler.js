/**
 * ModelInteractionHandler - Handles all model-related user interactions
 * Provides CSP-compliant event handling for model management operations
 */
class ModelInteractionHandler {
    constructor(eventManager, apiClient) {
        this.eventManager = eventManager;
        this.apiClient = apiClient;
        this.activeListeners = [];
        this.currentModel = null;
        
        // Bind methods to preserve context
        this.handleModelClick = this.handleModelClick.bind(this);
        this.handleModelEdit = this.handleModelEdit.bind(this);
        this.handleModelDelete = this.handleModelDelete.bind(this);
        this.handleModelTest = this.handleModelTest.bind(this);
        this.handleCopyEndpoint = this.handleCopyEndpoint.bind(this);
        this.handleModalClose = this.handleModalClose.bind(this);
        this.handleFormSubmit = this.handleFormSubmit.bind(this);
    }

    /**
     * Initialize model interaction handlers
     * Sets up event delegation for all model-related interactions
     */
    initialize() {
        this.cleanup(); // Clean up any existing listeners
        
        // Set up event delegation for model grid interactions
        const modelsPageId = this.eventManager.delegateEvent(
            '#models-page',
            '[data-action="show-model-details"]',
            'click',
            this.handleModelClick
        );

        // Set up event delegation for model action buttons
        const editButtonId = this.eventManager.delegateEvent(
            'body',
            '[data-action="edit-model"]',
            'click',
            this.handleModelEdit
        );

        const deleteButtonId = this.eventManager.delegateEvent(
            'body',
            '[data-action="delete-model"]',
            'click',
            this.handleModelDelete
        );

        const testButtonId = this.eventManager.delegateEvent(
            'body',
            '[data-action="test-model"]',
            'click',
            this.handleModelTest
        );

        const copyEndpointId = this.eventManager.delegateEvent(
            'body',
            '[data-action="copy-endpoint"]',
            'click',
            this.handleCopyEndpoint
        );

        // Set up modal close handlers
        const modalCloseId = this.eventManager.delegateEvent(
            'body',
            '[data-action="close-modal"]',
            'click',
            this.handleModalClose
        );

        // Set up form submission handlers
        const formSubmitId = this.eventManager.delegateEvent(
            'body',
            '.model-form',
            'submit',
            this.handleFormSubmit
        );

        // Store listener IDs for cleanup
        this.activeListeners = [
            modelsPageId,
            editButtonId,
            deleteButtonId,
            testButtonId,
            copyEndpointId,
            modalCloseId,
            formSubmitId
        ].filter(id => id !== null);

        // Set up keyboard shortcuts
        this.setupKeyboardShortcuts();

        console.log('ModelInteractionHandler: Initialized with', this.activeListeners.length, 'event listeners');
    }

    /**
     * Handle model card click to show details
     * @param {Event} event - Click event
     */
    async handleModelClick(event) {
        event.preventDefault();
        
        const modelCard = event.delegatedTarget;
        const modelId = modelCard.getAttribute('data-model-id');
        
        if (!modelId) {
            console.warn('ModelInteractionHandler: No model ID found on clicked element');
            return;
        }

        try {
            await this.showModelDetails(modelId);
        } catch (error) {
            console.error('ModelInteractionHandler: Error showing model details:', error);
            showToast('Failed to load model details', 'error');
        }
    }

    /**
     * Handle model edit button click
     * @param {Event} event - Click event
     */
    async handleModelEdit(event) {
        event.preventDefault();
        
        const button = event.delegatedTarget;
        const modelId = button.getAttribute('data-model-id') || 
                       (this.currentModel && this.currentModel.id);
        
        if (!modelId) {
            console.warn('ModelInteractionHandler: No model ID found for edit operation');
            return;
        }

        try {
            await this.showEditModal(modelId);
        } catch (error) {
            console.error('ModelInteractionHandler: Error showing edit modal:', error);
            showToast('Failed to load edit form', 'error');
        }
    }

    /**
     * Handle model delete button click
     * @param {Event} event - Click event
     */
    async handleModelDelete(event) {
        event.preventDefault();
        
        const button = event.delegatedTarget;
        const modelId = button.getAttribute('data-model-id') || 
                       (this.currentModel && this.currentModel.id);
        
        if (!modelId) {
            console.warn('ModelInteractionHandler: No model ID found for delete operation');
            return;
        }

        try {
            await this.showDeleteConfirmation(modelId);
        } catch (error) {
            console.error('ModelInteractionHandler: Error showing delete confirmation:', error);
            showToast('Failed to show delete confirmation', 'error');
        }
    }

    /**
     * Handle model test button click
     * @param {Event} event - Click event
     */
    async handleModelTest(event) {
        event.preventDefault();
        
        const button = event.delegatedTarget;
        const modelId = button.getAttribute('data-model-id') || 
                       (this.currentModel && this.currentModel.id);
        
        if (!modelId) {
            console.warn('ModelInteractionHandler: No model ID found for test operation');
            return;
        }

        try {
            await this.showTestInterface(modelId);
        } catch (error) {
            console.error('ModelInteractionHandler: Error showing test interface:', error);
            showToast('Failed to load test interface', 'error');
        }
    }

    /**
     * Handle copy endpoint button click
     * @param {Event} event - Click event
     */
    async handleCopyEndpoint(event) {
        event.preventDefault();
        
        const button = event.delegatedTarget;
        const endpoint = button.getAttribute('data-endpoint');
        
        if (!endpoint) {
            console.warn('ModelInteractionHandler: No endpoint found for copy operation');
            return;
        }

        try {
            const success = await copyToClipboard(endpoint);
            if (success) {
                showToast('Endpoint URL copied to clipboard', 'success');
            } else {
                showToast('Failed to copy endpoint URL', 'error');
            }
        } catch (error) {
            console.error('ModelInteractionHandler: Error copying endpoint:', error);
            showToast('Failed to copy endpoint URL', 'error');
        }
    }

    /**
     * Handle modal close button click
     * @param {Event} event - Click event
     */
    handleModalClose(event) {
        event.preventDefault();
        
        const modal = event.delegatedTarget.closest('.modal');
        if (modal) {
            this.closeModal(modal);
        }
    }

    /**
     * Handle form submission
     * @param {Event} event - Submit event
     */
    async handleFormSubmit(event) {
        event.preventDefault();
        
        const form = event.delegatedTarget;
        const formType = form.getAttribute('data-form-type');
        
        switch (formType) {
            case 'edit-model':
                await this.handleEditFormSubmit(form);
                break;
            case 'test-model':
                await this.handleTestFormSubmit(form);
                break;
            default:
                console.warn('ModelInteractionHandler: Unknown form type:', formType);
        }
    }

    /**
     * Show model details modal
     * @param {string} modelId - Model ID
     */
    async showModelDetails(modelId) {
        try {
            showLoading('Loading model details...');
            
            const model = await this.apiClient.getModel(modelId);
            this.currentModel = model;
            
            this.renderModelDetailsModal(model);
            
        } catch (error) {
            console.error('ModelInteractionHandler: Failed to load model details:', error);
            throw error;
        } finally {
            hideLoading();
        }
    }

    /**
     * Show edit modal for model
     * @param {string} modelId - Model ID
     */
    async showEditModal(modelId) {
        try {
            showLoading('Loading model data...');
            
            const model = await this.apiClient.getModel(modelId);
            this.renderEditModal(model);
            
        } catch (error) {
            console.error('ModelInteractionHandler: Failed to load model for editing:', error);
            throw error;
        } finally {
            hideLoading();
        }
    }

    /**
     * Show delete confirmation modal
     * @param {string} modelId - Model ID
     */
    async showDeleteConfirmation(modelId) {
        try {
            const model = await this.apiClient.getModel(modelId);
            this.renderDeleteConfirmationModal(model);
        } catch (error) {
            console.error('ModelInteractionHandler: Failed to load model for deletion:', error);
            throw error;
        }
    }

    /**
     * Show test interface modal
     * @param {string} modelId - Model ID
     */
    async showTestInterface(modelId) {
        try {
            showLoading('Loading test interface...');
            
            const model = await this.apiClient.getModel(modelId);
            this.renderTestModal(model);
            
        } catch (error) {
            console.error('ModelInteractionHandler: Failed to load test interface:', error);
            throw error;
        } finally {
            hideLoading();
        }
    }

    /**
     * Render model details modal
     * @param {Object} model - Model data
     */
    renderModelDetailsModal(model) {
        const modal = this.createModal('model-details-modal', 'Model Details');
        const status = formatModelStatus(model.status);
        
        modal.querySelector('.modal-body').innerHTML = `
            <div class="model-details">
                <div class="model-header">
                    <h2>${sanitizeHtml(model.name)}</h2>
                    <span class="status-badge ${status.class}">${status.text}</span>
                </div>
                
                <div class="model-info-grid">
                    <div class="info-item">
                        <label>Format:</label>
                        <span>${getModelFormatName(model.format)}</span>
                    </div>
                    <div class="info-item">
                        <label>Created:</label>
                        <span>${formatDate(model.createdAt)}</span>
                    </div>
                    <div class="info-item">
                        <label>File Size:</label>
                        <span>${formatFileSize(model.fileSize || 0)}</span>
                    </div>
                    <div class="info-item">
                        <label>Requests:</label>
                        <span>${formatNumber(model.requestCount || 0)}</span>
                    </div>
                </div>
                
                <div class="model-description">
                    <label>Description:</label>
                    <p>${sanitizeHtml(model.description || 'No description provided')}</p>
                </div>
                
                <div class="model-endpoint">
                    <label>API Endpoint:</label>
                    <div class="endpoint-display">
                        <input type="text" value="${generateEndpointUrl(model.id)}" readonly>
                        <button class="btn btn-outline btn-sm" data-action="copy-endpoint" data-endpoint="${generateEndpointUrl(model.id)}">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
                
                <div class="modal-actions">
                    <button class="btn btn-primary" data-action="test-model" data-model-id="${model.id}">
                        <i class="fas fa-play"></i> Test Model
                    </button>
                    <button class="btn btn-outline" data-action="edit-model" data-model-id="${model.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger" data-action="delete-model" data-model-id="${model.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
        
        this.showModal(modal);
    }

    /**
     * Render edit modal
     * @param {Object} model - Model data
     */
    renderEditModal(model) {
        const modal = this.createModal('edit-model-modal', 'Edit Model');
        
        modal.querySelector('.modal-body').innerHTML = `
            <form class="model-form" data-form-type="edit-model" data-model-id="${model.id}">
                <div class="form-group">
                    <label for="edit-model-name">Model Name</label>
                    <input type="text" id="edit-model-name" name="name" value="${sanitizeHtml(model.name)}" required>
                </div>
                
                <div class="form-group">
                    <label for="edit-model-description">Description</label>
                    <textarea id="edit-model-description" name="description" rows="4">${sanitizeHtml(model.description || '')}</textarea>
                </div>
                
                <div class="form-group">
                    <label for="edit-model-status">Status</label>
                    <select id="edit-model-status" name="status">
                        <option value="active" ${model.status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="inactive" ${model.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                        <option value="archived" ${model.status === 'archived' ? 'selected' : ''}>Archived</option>
                    </select>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-save"></i> Save Changes
                    </button>
                    <button type="button" class="btn btn-outline" data-action="close-modal">
                        Cancel
                    </button>
                </div>
            </form>
        `;
        
        this.showModal(modal);
    }

    /**
     * Render delete confirmation modal
     * @param {Object} model - Model data
     */
    renderDeleteConfirmationModal(model) {
        const modal = this.createModal('delete-model-modal', 'Confirm Deletion');
        
        modal.querySelector('.modal-body').innerHTML = `
            <div class="delete-confirmation">
                <div class="warning-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3>Delete Model</h3>
                <p>Are you sure you want to delete <strong>${sanitizeHtml(model.name)}</strong>?</p>
                <p class="warning-text">This action cannot be undone. All associated data and API endpoints will be permanently removed.</p>
                
                <div class="form-actions">
                    <button class="btn btn-danger" data-action="confirm-delete" data-model-id="${model.id}">
                        <i class="fas fa-trash"></i> Delete Model
                    </button>
                    <button class="btn btn-outline" data-action="close-modal">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        // Add confirm delete handler
        const confirmDeleteId = this.eventManager.addEventListener(
            modal.querySelector('[data-action="confirm-delete"]'),
            'click',
            async (e) => {
                e.preventDefault();
                await this.confirmDelete(model.id);
            }
        );
        
        this.showModal(modal);
    }

    /**
     * Render test modal
     * @param {Object} model - Model data
     */
    renderTestModal(model) {
        const modal = this.createModal('test-model-modal', `Test Model: ${model.name}`);
        
        modal.querySelector('.modal-body').innerHTML = `
            <div class="test-interface">
                <div class="endpoint-info">
                    <label>API Endpoint:</label>
                    <div class="endpoint-display">
                        <span class="http-method">POST</span>
                        <input type="text" value="${generateEndpointUrl(model.id)}" readonly>
                        <button class="btn btn-outline btn-sm" data-action="copy-endpoint" data-endpoint="${generateEndpointUrl(model.id)}">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
                
                <form class="model-form" data-form-type="test-model" data-model-id="${model.id}">
                    <div class="form-group">
                        <label for="test-input-data">Test Data (JSON)</label>
                        <textarea id="test-input-data" name="data" rows="6" placeholder='{"data": [[1.0, 2.0, 3.0]]}'></textarea>
                        <small>Enter test data in JSON format</small>
                    </div>
                    
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-play"></i> Run Test
                        </button>
                        <button type="button" class="btn btn-outline" data-action="close-modal">
                            Close
                        </button>
                    </div>
                </form>
                
                <div class="test-results hidden" id="test-results">
                    <h4>Test Results</h4>
                    <div class="results-content"></div>
                </div>
            </div>
        `;
        
        this.showModal(modal);
    }

    /**
     * Handle edit form submission
     * @param {HTMLFormElement} form - Form element
     */
    async handleEditFormSubmit(form) {
        try {
            showLoading('Saving changes...');
            
            const formData = new FormData(form);
            const modelId = form.getAttribute('data-model-id');
            
            const updateData = {
                name: formData.get('name'),
                description: formData.get('description'),
                status: formData.get('status')
            };
            
            await this.apiClient.updateModel(modelId, updateData);
            
            showToast('Model updated successfully', 'success');
            this.closeModal(form.closest('.modal'));
            
            // Refresh models list if available
            if (window.app && window.app.models) {
                await window.app.models.loadModels();
                window.app.models.renderModels();
            }
            
        } catch (error) {
            console.error('ModelInteractionHandler: Error updating model:', error);
            showToast('Failed to update model', 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * Handle test form submission
     * @param {HTMLFormElement} form - Form element
     */
    async handleTestFormSubmit(form) {
        try {
            showLoading('Running test...');
            
            const formData = new FormData(form);
            const modelId = form.getAttribute('data-model-id');
            const testData = formData.get('data');
            
            let parsedData;
            try {
                parsedData = JSON.parse(testData);
            } catch (parseError) {
                throw new Error('Invalid JSON format in test data');
            }
            
            const result = await this.apiClient.testModel(modelId, parsedData);
            
            this.showTestResults(result);
            showToast('Test completed successfully', 'success');
            
        } catch (error) {
            console.error('ModelInteractionHandler: Error testing model:', error);
            this.showTestResults({ error: error.message });
            showToast('Test failed', 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * Confirm model deletion
     * @param {string} modelId - Model ID
     */
    async confirmDelete(modelId) {
        try {
            showLoading('Deleting model...');
            
            await this.apiClient.deleteModel(modelId);
            
            showToast('Model deleted successfully', 'success');
            this.closeModal(document.querySelector('.modal'));
            
            // Refresh models list if available
            if (window.app && window.app.models) {
                await window.app.models.loadModels();
                window.app.models.renderModels();
            }
            
        } catch (error) {
            console.error('ModelInteractionHandler: Error deleting model:', error);
            showToast('Failed to delete model', 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * Show test results
     * @param {Object} results - Test results
     */
    showTestResults(results) {
        const resultsContainer = document.getElementById('test-results');
        const resultsContent = resultsContainer.querySelector('.results-content');
        
        if (results.error) {
            resultsContent.innerHTML = `
                <div class="error-result">
                    <i class="fas fa-exclamation-circle"></i>
                    <strong>Error:</strong> ${sanitizeHtml(results.error)}
                </div>
            `;
        } else {
            resultsContent.innerHTML = `
                <div class="success-result">
                    <i class="fas fa-check-circle"></i>
                    <strong>Success:</strong>
                    <pre>${JSON.stringify(results, null, 2)}</pre>
                </div>
            `;
        }
        
        resultsContainer.classList.remove('hidden');
    }

    /**
     * Create modal element
     * @param {string} id - Modal ID
     * @param {string} title - Modal title
     * @returns {HTMLElement} - Modal element
     */
    createModal(id, title) {
        // Remove existing modal with same ID
        const existing = document.getElementById(id);
        if (existing) {
            existing.remove();
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = id;
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${sanitizeHtml(title)}</h2>
                    <button class="btn-close" data-action="close-modal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <!-- Content will be inserted here -->
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        return modal;
    }

    /**
     * Show modal
     * @param {HTMLElement} modal - Modal element
     */
    showModal(modal) {
        modal.classList.remove('hidden');
        document.body.classList.add('modal-open');
        
        // Focus management for accessibility
        const firstFocusable = modal.querySelector('button, input, select, textarea');
        if (firstFocusable) {
            firstFocusable.focus();
        }
    }

    /**
     * Close modal
     * @param {HTMLElement} modal - Modal element
     */
    closeModal(modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('modal-open');
        modal.remove();
        this.currentModel = null;
    }

    /**
     * Set up keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        const keyboardId = this.eventManager.addEventListener(
            document,
            'keydown',
            (e) => {
                // Escape key closes modals
                if (e.key === 'Escape') {
                    const openModal = document.querySelector('.modal:not(.hidden)');
                    if (openModal) {
                        this.closeModal(openModal);
                    }
                }
            }
        );
        
        this.activeListeners.push(keyboardId);
    }

    /**
     * Clean up all event listeners
     */
    cleanup() {
        this.activeListeners.forEach(id => {
            this.eventManager.removeEventListener(id);
            this.eventManager.removeDelegatedEvent(id);
        });
        this.activeListeners = [];
        this.currentModel = null;
    }

    /**
     * Destroy the handler and clean up
     */
    destroy() {
        this.cleanup();
        console.log('ModelInteractionHandler: Destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModelInteractionHandler;
} else {
    window.ModelInteractionHandler = ModelInteractionHandler;
}