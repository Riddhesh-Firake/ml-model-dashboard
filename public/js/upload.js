/**
 * Upload functionality for ML Model Dashboard
 */
class Upload {
    constructor() {
        this.currentFile = null;
        this.uploadInProgress = false;
        this.initializeEventListeners();
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        // Form submission
        const uploadForm = document.getElementById('upload-form');
        uploadForm.addEventListener('submit', (e) => this.handleFormSubmit(e));

        // File input change
        const fileInput = document.getElementById('model-file');
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Drag and drop
        const uploadArea = document.getElementById('file-upload-area');
        uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        uploadArea.addEventListener('drop', (e) => this.handleFileDrop(e));

        // Remove file button
        const removeFileBtn = document.getElementById('remove-file');
        removeFileBtn.addEventListener('click', () => this.removeFile());

        // Copy endpoint button
        const copyEndpointBtn = document.getElementById('copy-endpoint');
        copyEndpointBtn.addEventListener('click', () => this.copyEndpoint());

        // Result action buttons
        const viewModelBtn = document.getElementById('view-model');
        viewModelBtn.addEventListener('click', () => this.viewUploadedModel());

        const uploadAnotherBtn = document.getElementById('upload-another');
        uploadAnotherBtn.addEventListener('click', () => this.resetUploadForm());

        // File link click
        const fileLink = uploadArea.querySelector('.file-link');
        fileLink.addEventListener('click', () => fileInput.click());
    }

    /**
     * Handle form submission
     */
    async handleFormSubmit(e) {
        e.preventDefault();
        
        if (this.uploadInProgress) {
            return;
        }

        const formData = new FormData(e.target);
        
        // Validate form
        if (!this.validateForm(formData)) {
            return;
        }

        try {
            this.uploadInProgress = true;
            this.showUploadProgress();
            
            const result = await this.uploadModel(formData);
            this.showUploadSuccess(result);
            
        } catch (error) {
            console.error('Upload failed:', error);
            this.showUploadError(error);
        } finally {
            this.uploadInProgress = false;
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
}

// Export upload class
window.Upload = Upload;