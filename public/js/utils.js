/**
 * Utility functions for the ML Model Dashboard
 */

/**
 * Format file size in human readable format
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format date in human readable format
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} month${months > 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleDateString();
    }
}

/**
 * Format number with commas
 */
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format duration in milliseconds to human readable format
 */
function formatDuration(ms) {
    if (ms < 1000) {
        return `${ms}ms`;
    } else if (ms < 60000) {
        return `${(ms / 1000).toFixed(1)}s`;
    } else {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
}

/**
 * Validate file type
 */
function isValidModelFile(filename) {
    const validExtensions = ['pkl', 'joblib', 'h5', 'onnx', 'pt', 'pth'];
    const extension = getFileExtension(filename).toLowerCase();
    return validExtensions.includes(extension);
}

/**
 * Get model format display name
 */
function getModelFormatName(extension) {
    if (!extension) {
        return 'Unknown';
    }
    
    const formatNames = {
        'pkl': 'Pickle',
        'joblib': 'Joblib',
        'h5': 'Keras/TensorFlow',
        'onnx': 'ONNX',
        'pt': 'PyTorch',
        'pth': 'PyTorch State'
    };
    return formatNames[extension.toLowerCase()] || extension.toUpperCase();
}

/**
 * Generate random ID
 */
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

/**
 * Debounce function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function
 */
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.className = 'sr-only-clipboard';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        } catch (err) {
            document.body.removeChild(textArea);
            return false;
        }
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info', title = null, duration = 5000) {
    const toastContainer = document.getElementById('toast-container');
    const toastId = generateId();
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.id = toastId;
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="${icons[type] || icons.info}"></i>
        </div>
        <div class="toast-content">
            ${title ? `<div class="toast-title">${title}</div>` : ''}
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="removeToast('${toastId}')">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after duration
    if (duration > 0) {
        setTimeout(() => removeToast(toastId), duration);
    }
    
    return toastId;
}

/**
 * Remove toast notification
 */
function removeToast(toastId) {
    const toast = document.getElementById(toastId);
    if (toast) {
        toast.classList.add('slide-out');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
}

/**
 * Show loading overlay
 */
function showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loading-overlay');
    const spinner = overlay.querySelector('.loading-spinner p');
    spinner.textContent = message;
    overlay.classList.remove('hidden');
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.add('hidden');
}

/**
 * Validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Sanitize HTML to prevent XSS
 */
function sanitizeHtml(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

/**
 * Format model status for display
 */
function formatModelStatus(status) {
    const statusMap = {
        'active': { text: 'Active', class: 'active' },
        'inactive': { text: 'Inactive', class: 'inactive' },
        'archived': { text: 'Archived', class: 'archived' }
    };
    return statusMap[status] || { text: status, class: 'inactive' };
}

/**
 * Calculate success rate percentage
 */
function calculateSuccessRate(successCount, totalCount) {
    if (totalCount === 0) return 0;
    return Math.round((successCount / totalCount) * 100);
}

/**
 * Generate endpoint URL for model
 */
function generateEndpointUrl(modelId) {
    return `${window.location.origin}/api/predict/${modelId}`;
}

/**
 * Parse error message from API response
 */
function parseErrorMessage(error) {
    if (typeof error === 'string') {
        return error;
    }
    
    if (error.message) {
        return error.message;
    }
    
    if (error.error && error.error.message) {
        return error.error.message;
    }
    
    return 'An unexpected error occurred';
}

/**
 * Format API response for display
 */
function formatApiResponse(response) {
    try {
        return JSON.stringify(response, null, 2);
    } catch (error) {
        return String(response);
    }
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
    const token = localStorage.getItem('auth_token');
    const apiKey = localStorage.getItem('api_key');
    
    // Check if we have either a token or API key
    if (!token && !apiKey) {
        return false;
    }
    
    // If we have a token, check if it's not a fake session token
    if (token && token.startsWith('session_')) {
        console.warn('Found fake session token, clearing authentication');
        localStorage.removeItem('auth_token');
        return false;
    }
    
    return true;
}

/**
 * Get user info from token (basic JWT decode)
 */
function getUserFromToken() {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload;
    } catch (error) {
        return null;
    }
}

/**
 * Get CSP nonce from existing script tag
 */
function getCSPNonce() {
    const scripts = document.querySelectorAll('script[nonce]');
    return scripts.length > 0 ? scripts[0].getAttribute('nonce') : null;
}

// Animation keyframes are now defined in main.css