/**
 * Upload functionality for ML Model Dashboard
 */

// Global flag to prevent multiple uploads across all instances
window.globalUploadInProgress = false;

class Upload {
    constructor() {
        this.currentFile = null;
        this.uploadInProgress = false;
        
        // Bind methods to preserve context for proper event listener removal
        this.handleFormSubmit = this.handleFormSubmit.bind(this);
        this.handleFileSelect = this.handleFileSelect.bind(this);
        this.handleDragOver = this.handleDragOver.bind(this);
        this.handleDragLeave = this.handleDragLeave.bind(this);
        this.handleFileDrop = this.handleFileDrop.bind(this);
        this.removeFile = this.removeFile.bind(this);
        this.copyEndpoint = this.copyEndpoint.bind(this);
        this.viewUploadedModel = this.viewUploadedModel.bind(this);
        this.resetUploadForm = this.resetUploadForm.bind(this);
        
        this.initializeEventListeners();
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        console.log('🔗 Initializing Upload event listeners...');
        
        // Form submission
        const uploadForm = document.getElementById('upload-form');
        if (uploadForm) {
            uploadForm.addEventListener('submit', this.handleFormSubmit);
        }

        // File input change
        const fileInput = document.getElementById('model-file');
        if (fileInput) {
            fileInput.addEventListener('change', this.handleFileSelect);
        }

        // Drag and drop
        const uploadArea = document.getElementById('file-upload-area');
        if (uploadArea) {
            uploadArea.addEventListener('dragover', this.handleDragOver);
            uploadArea.addEventListener('dragleave', this.handleDragLeave);
            uploadArea.addEventListener('drop', this.handleFileDrop);
            
            // File link click
            const fileLink = uploadArea.querySelector('.file-link');
            if (fileLink) {
                fileLink.addEventListener('click', () => fileInput.click());
            }
        }

        // Remove file button
        const removeFileBtn = document.getElementById('remove-file');
        if (removeFileBtn) {
            removeFileBtn.addEventListener('click', this.removeFile);
        }

        // Copy endpoint button
        const copyEndpointBtn = document.getElementById('copy-endpoint');
        if (copyEndpointBtn) {
            copyEndpointBtn.addEventListener('click', this.copyEndpoint);
        }

        // Result action buttons
        const viewModelBtn = document.getElementById('view-model');
        if (viewModelBtn) {
            viewModelBtn.addEventListener('click', this.viewUploadedModel);
        }

        const uploadAnotherBtn = document.getElementById('upload-another');
        if (uploadAnotherBtn) {
            uploadAnotherBtn.addEventListener('click', this.resetUploadForm);
        }
        
        console.log('✅ Upload event listeners initialized');
    }

    /**
     * Handle form submission
     */
    async handleFormSubmit(e) {
        e.preventDefault();
        e.stopImmediatePropagation(); // Prevent other event listeners from firing
        
        console.log('📤 Upload form submitted, uploadInProgress:', this.uploadInProgress, 'globalUploadInProgress:', window.globalUploadInProgress);
        
        if (this.uploadInProgress || window.globalUploadInProgress) {
            console.log('⚠️ Upload already in progress, ignoring duplicate submission');
            return;
        }

        const formData = new FormData(e.target);
        
        // Validate form
        if (!this.validateForm(formData)) {
            return;
        }

        try {
            this.uploadInProgress = true;
            window.globalUploadInProgress = true;
            console.log('🔒 Upload started, setting flags to true');
            
            // Disable the submit button to prevent multiple clicks
            const submitBtn = document.getElementById('upload-btn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
            }
            
            this.showUploadProgress();
            
            const result = await this.uploadModel(formData);
            this.showUploadSuccess(result);
            
        } catch (error) {
            console.error('Upload failed:', error);
            this.showUploadError(error);
        } finally {
            this.uploadInProgress = false;
            window.globalUploadInProgress = false;
            console.log('🔓 Upload completed, setting flags to false');
            
            // Re-enable the submit button
            const submitBtn = document.getElementById('upload-btn');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Model';
            }
        }
    }

    /**
     * Validate upload form
     */
    validateForm(formData) {
        const modelName = formData.get('modelName');
        const modelFile = formData.get('modelFile');

        // Check model name
        if (!modelName || modelName.trim().length === 0) {
            showToast('Please enter a model name', 'error');
            return false;
        }

        if (modelName.trim().length < 3) {
            showToast('Model name must be at least 3 characters long', 'error');
            return false;
        }

        // Check file
        if (!modelFile || modelFile.size === 0) {
            showToast('Please select a model file', 'error');
            return false;
        }

        if (!isValidModelFile(modelFile.name)) {
            showToast('Invalid file format. Supported formats: .pkl, .joblib, .h5, .onnx, .pt, .pth', 'error');
            return false;
        }

        // Check file size (100MB limit)
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (modelFile.size > maxSize) {
            showToast('File size exceeds 100MB limit', 'error');
            return false;
        }

        return true;
    }

    /**
     * Upload model to server
     */
    async uploadModel(formData) {
        return new Promise((resolve, reject) => {
            window.apiClient.uploadFile('/api/models/upload', formData, (progress, loaded, total) => {
                this.updateUploadProgress(progress, loaded, total);
            })
            .then(resolve)
            .catch(reject);
        });
    }

    /**
     * Handle file selection
     */
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.setSelectedFile(file);
        }
    }

    /**
     * Handle drag over
     */
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        const uploadArea = document.getElementById('file-upload-area');
        uploadArea.classList.add('dragover');
    }

    /**
     * Handle drag leave
     */
    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        const uploadArea = document.getElementById('file-upload-area');
        uploadArea.classList.remove('dragover');
    }

    /**
     * Handle file drop
     */
    handleFileDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const uploadArea = document.getElementById('file-upload-area');
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.setSelectedFile(files[0]);
        }
    }

    /**
     * Set selected file
     */
    setSelectedFile(file) {
        // Validate file
        if (!isValidModelFile(file.name)) {
            showToast('Invalid file format. Supported formats: .pkl, .joblib, .h5, .onnx, .pt, .pth', 'error');
            return;
        }

        // Check file size
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (file.size > maxSize) {
            showToast('File size exceeds 100MB limit', 'error');
            return;
        }

        this.currentFile = file;
        
        // Update UI
        const fileInput = document.getElementById('model-file');
        const uploadArea = document.getElementById('file-upload-area');
        const fileInfo = document.getElementById('file-info');
        const fileName = document.getElementById('file-name');
        const fileSize = document.getElementById('file-size');
        const uploadBtn = document.getElementById('upload-btn');

        // Create a new FileList with the selected file
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;

        // Show file info
        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        
        uploadArea.classList.add('hidden');
        fileInfo.classList.remove('hidden');
        uploadBtn.disabled = false;
    }

    /**
     * Remove selected file
     */
    removeFile() {
        this.currentFile = null;
        
        const fileInput = document.getElementById('model-file');
        const uploadArea = document.getElementById('file-upload-area');
        const fileInfo = document.getElementById('file-info');
        const uploadBtn = document.getElementById('upload-btn');

        fileInput.value = '';
        uploadArea.classList.remove('hidden');
        fileInfo.classList.add('hidden');
        uploadBtn.disabled = true;
    }

    /**
     * Show upload progress
     */
    showUploadProgress() {
        const uploadForm = document.getElementById('upload-form');
        const uploadProgress = document.getElementById('upload-progress');
        const uploadSuccess = document.getElementById('upload-success');

        uploadForm.classList.add('hidden');
        uploadSuccess.classList.add('hidden');
        uploadProgress.classList.remove('hidden');

        // Reset progress
        this.updateUploadProgress(0, 0, 0);
    }

    /**
     * Update upload progress
     */
    updateUploadProgress(percentage, loaded, total) {
        const progressFill = document.getElementById('progress-fill');
        const progressPercentage = document.getElementById('progress-percentage');
        const progressStatus = document.getElementById('progress-status');

        progressFill.style.width = `${percentage}%`;
        progressPercentage.textContent = `${Math.round(percentage)}%`;

        if (percentage < 100) {
            if (loaded && total) {
                progressStatus.textContent = `Uploading... ${formatFileSize(loaded)} of ${formatFileSize(total)}`;
            } else {
                progressStatus.textContent = 'Preparing upload...';
            }
        } else {
            progressStatus.textContent = 'Processing model...';
        }
    }

    /**
     * Show upload success
     */
    showUploadSuccess(result) {
        const uploadProgress = document.getElementById('upload-progress');
        const uploadSuccess = document.getElementById('upload-success');
        const generatedEndpoint = document.getElementById('generated-endpoint');

        uploadProgress.classList.add('hidden');
        uploadSuccess.classList.remove('hidden');

        // Set endpoint URL
        const endpointUrl = result.endpointUrl || generateEndpointUrl(result.modelId);
        generatedEndpoint.value = endpointUrl;

        // Store model ID for later use
        this.lastUploadedModelId = result.modelId;

        showToast('Model uploaded successfully!', 'success', 'Upload Complete');
    }

    /**
     * Show upload error
     */
    showUploadError(error) {
        const uploadProgress = document.getElementById('upload-progress');
        const uploadForm = document.getElementById('upload-form');

        uploadProgress.classList.add('hidden');
        uploadForm.classList.remove('hidden');

        const errorMessage = parseErrorMessage(error);
        showToast(errorMessage, 'error', 'Upload Failed');
    }

    /**
     * Copy endpoint URL to clipboard
     */
    async copyEndpoint() {
        const endpointInput = document.getElementById('generated-endpoint');
        const success = await copyToClipboard(endpointInput.value);
        
        if (success) {
            showToast('Endpoint URL copied to clipboard', 'success');
        } else {
            showToast('Failed to copy endpoint URL', 'error');
        }
    }

    /**
     * View uploaded model details
     */
    viewUploadedModel() {
        if (this.lastUploadedModelId) {
            app.showModelDetails(this.lastUploadedModelId);
        } else {
            app.showPage('models');
        }
    }

    /**
     * Reset upload form
     */
    resetUploadForm() {
        const uploadForm = document.getElementById('upload-form');
        const uploadProgress = document.getElementById('upload-progress');
        const uploadSuccess = document.getElementById('upload-success');

        // Reset form
        uploadForm.reset();
        this.removeFile();

        // Show form
        uploadForm.classList.remove('hidden');
        uploadProgress.classList.add('hidden');
        uploadSuccess.classList.add('hidden');

        // Clear last uploaded model
        this.lastUploadedModelId = null;
        this.uploadInProgress = false;
    }

    /**
     * Initialize upload page
     */
    init() {
        this.resetUploadForm();
    }

    /**
     * Cleanup method to remove event listeners
     */
    cleanup() {
        console.log('🧹 Cleaning up Upload component...');
        
        // Remove form event listener
        const uploadForm = document.getElementById('upload-form');
        if (uploadForm) {
            uploadForm.removeEventListener('submit', this.handleFormSubmit);
        }
        
        // Remove file input event listener
        const fileInput = document.getElementById('model-file');
        if (fileInput) {
            fileInput.removeEventListener('change', this.handleFileSelect);
        }
        
        // Remove drag and drop event listeners
        const uploadArea = document.getElementById('file-upload-area');
        if (uploadArea) {
            uploadArea.removeEventListener('dragover', this.handleDragOver);
            uploadArea.removeEventListener('dragleave', this.handleDragLeave);
            uploadArea.removeEventListener('drop', this.handleFileDrop);
        }
        
        // Remove other button event listeners
        const removeFileBtn = document.getElementById('remove-file');
        if (removeFileBtn) {
            removeFileBtn.removeEventListener('click', this.removeFile);
        }
        
        const copyEndpointBtn = document.getElementById('copy-endpoint');
        if (copyEndpointBtn) {
            copyEndpointBtn.removeEventListener('click', this.copyEndpoint);
        }
        
        const viewModelBtn = document.getElementById('view-model');
        if (viewModelBtn) {
            viewModelBtn.removeEventListener('click', this.viewUploadedModel);
        }
        
        const uploadAnotherBtn = document.getElementById('upload-another');
        if (uploadAnotherBtn) {
            uploadAnotherBtn.removeEventListener('click', this.resetUploadForm);
        }
        
        console.log('✅ Upload component cleanup completed');
    }
}

// Export upload class
window.Upload = Upload;