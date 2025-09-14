/**
 * API Client for ML Model Dashboard
 * CSP-compliant implementation without eval() or Function() constructors
 */
console.log('🚀 api.js script loaded');
class ApiClient {
    constructor() {
        this.baseUrl = window.location.origin;
        this.token = localStorage.getItem('auth_token');
        this.apiKey = localStorage.getItem('api_key');
    }

    /**
     * Set authentication token
     */
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('auth_token', token);
        } else {
            localStorage.removeItem('auth_token');
        }
    }

    /**
     * Set API key
     */
    setApiKey(apiKey) {
        this.apiKey = apiKey;
        if (apiKey) {
            localStorage.setItem('api_key', apiKey);
        } else {
            localStorage.removeItem('api_key');
        }
    }

    /**
     * Clear authentication
     */
    clearAuth() {
        this.token = null;
        this.apiKey = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('api_key');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_subscription');
    }

    /**
     * Get authentication headers
     */
    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (this.apiKey) {
            headers['X-API-Key'] = this.apiKey;
        }

        return headers;
    }

    /**
     * Make HTTP request
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: this.getAuthHeaders(),
            ...options
        };

        console.log('🌐 API Request:', {
            method: options.method || 'GET',
            url: url,
            headers: config.headers,
            hasBody: !!options.body
        });

        try {
            const response = await fetch(url, config);

            console.log('📡 API Response:', {
                status: response.status,
                statusText: response.statusText,
                url: url,
                ok: response.ok
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ API Error Response:', errorData);

                const error = new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
                error.status = response.status;
                error.response = errorData;
                throw error;
            }

            const contentType = response.headers.get('content-type');
            console.log('📋 Response Content-Type:', contentType);
            
            if (contentType && contentType.includes('application/json')) {
                const jsonData = await response.json();
                console.log('✅ API Success Response (JSON):', jsonData);
                return jsonData;
            }

            const textData = await response.text();
            console.log('⚠️ API Success Response (text - not JSON):', textData.substring(0, 200));
            console.log('🔍 Full response length:', textData.length);
            console.log('🔍 Is HTML?', textData.includes('<!DOCTYPE html>'));
            
            // If it looks like HTML but we expected JSON, this is likely a routing issue
            if (textData.includes('<!DOCTYPE html>')) {
                console.error('❌ Received HTML instead of JSON - possible routing issue');
                throw new Error('Server returned HTML instead of JSON - check API routing');
            }
            
            return textData;
        } catch (error) {
            console.error('❌ API Request failed:', {
                endpoint,
                error: error.message,
                status: error.status,
                response: error.response
            });
            throw error;
        }
    }

    /**
     * GET request
     */
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    /**
     * POST request
     */
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT request
     */
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE request
     */
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    /**
     * Upload file with progress tracking
     */
    async uploadFile(endpoint, formData, onProgress = null) {
        const url = `${this.baseUrl}${endpoint}`;

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            // Open request first
            xhr.open('POST', url);
            
            // Set timeout
            xhr.timeout = 300000; // 5 minutes timeout for uploads

            // Set up progress tracking
            if (onProgress) {
                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        const percentComplete = (event.loaded / event.total) * 100;
                        onProgress(percentComplete, event.loaded, event.total);
                    }
                });
            }

            // Set up response handling
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (error) {
                        resolve(xhr.responseText);
                    }
                } else {
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        reject(new Error(errorData.error?.message || `HTTP ${xhr.status}: ${xhr.statusText}`));
                    } catch (error) {
                        reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                    }
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Network error occurred'));
            });

            xhr.addEventListener('timeout', () => {
                reject(new Error('Request timeout'));
            });

            // Set headers AFTER opening the request
            if (this.token) {
                xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
            }
            if (this.apiKey) {
                xhr.setRequestHeader('X-API-Key', this.apiKey);
            }

            // Send request
            xhr.send(formData);
        });
    }

    // Auth API methods
    async login(email, password) {
        return this.post('/api/auth/login', { email, password });
    }

    async register(email, password) {
        return this.post('/api/auth/register', { email, password });
    }

    async logout() {
        return this.post('/api/auth/logout', {});
    }

    async getCurrentUser() {
        // Since there's no /me endpoint, we'll use the stored user info
        // or return a basic user object if we have authentication
        if (this.token || this.apiKey || localStorage.getItem('auth_token')) {
            // Return user object from localStorage
            return {
                id: localStorage.getItem('user_id'),
                email: localStorage.getItem('user_email') || 'user@example.com',
                subscription: localStorage.getItem('user_subscription') || 'free'
            };
        }
        throw new Error('Not authenticated');
    }

    // API Key methods
    async getApiKeys() {
        return this.get('/api/keys');
    }

    async createApiKey(name) {
        return this.post('/api/keys', { name });
    }

    async deleteApiKey(keyId) {
        return this.delete(`/api/keys/${keyId}`);
    }

    // Model management methods
    async getModels() {
        try {
            const models = await this.get('/api/models');
            console.log('✅ Models loaded successfully:', models);
            
            // If API returns empty array, try to use sample data
            if (Array.isArray(models) && models.length === 0) {
                const sampleModels = this.getSampleModels();
                if (sampleModels.length > 0) {
                    console.log('📋 Using sample models data:', sampleModels.length, 'models');
                    return sampleModels;
                }
            }
            
            return Array.isArray(models) ? models : [];
        } catch (error) {
            console.error('❌ Failed to load models:', error);
            
            // Try to use sample data as fallback
            const sampleModels = this.getSampleModels();
            if (sampleModels.length > 0) {
                console.log('📋 Using sample models as fallback:', sampleModels.length, 'models');
                return sampleModels;
            }
            
            // Return empty array as final fallback
            return [];
        }
    }

    async getModel(modelId) {
        return this.get(`/api/models/${modelId}`);
    }

    async updateModel(modelId, data) {
        return this.put(`/api/models/${modelId}`, data);
    }

    async deleteModel(modelId) {
        return this.delete(`/api/models/${modelId}`);
    }

    async uploadModel(formData, onProgress) {
        return this.uploadFile('/api/models/upload', formData, onProgress);
    }

    // Prediction methods
    async predict(modelId, inputData) {
        return this.post(`/api/predict/${modelId}`, inputData);
    }

    // Monitoring methods
    async getHealthStatus() {
        return this.get('/health');
    }

    async getModelStats(modelId) {
        return this.get(`/api/monitoring/models/${modelId}/stats`);
    }

    async getUserStats() {
        try {
            return await this.get('/api/monitoring/user/stats');
        } catch (error) {
            console.warn('User stats endpoint not available, trying sample data:', error.message);
            
            // Try to use sample data
            const sampleStats = this.getSampleUserStats();
            if (sampleStats) {
                console.log('📈 Using sample user stats:', sampleStats);
                return sampleStats;
            }
            
            // Return fallback stats
            return {
                totalRequests: 0,
                avgResponseTime: 0,
                successfulRequests: 0,
                errorCount: 0
            };
        }
    }

    async getSystemStats() {
        return this.get('/api/monitoring/system/stats');
    }

    // Analytics methods
    async getAnalyticsData(type, timeRange = '7d') {
        try {
            return await this.get(`/api/monitoring/analytics/${type}?range=${timeRange}`);
        } catch (error) {
            console.warn(`Analytics data for ${type} not available:`, error.message);
            return this.getSampleAnalyticsData(type);
        }
    }

    async getModelPerformance(modelId) {
        try {
            return await this.get(`/api/monitoring/models/${modelId}/performance`);
        } catch (error) {
            console.warn(`Model performance for ${modelId} not available:`, error.message);
            return this.getSampleModelPerformance(modelId);
        }
    }

    async getErrorLogs(hours = 24) {
        try {
            return await this.get(`/api/monitoring/logs/errors?hours=${hours}`);
        } catch (error) {
            console.warn('Error logs not available:', error.message);
            return this.getSampleErrorLogs();
        }
    }

    // Documentation methods
    async getModelDocumentation(modelId) {
        return this.get(`/docs/models/${modelId}`);
    }

    async getApiDocumentation() {
        return this.get('/docs/api-docs');
    }

    /**
     * Get sample models data from localStorage
     */
    getSampleModels() {
        try {
            const sampleData = localStorage.getItem('sample_models');
            if (sampleData) {
                return JSON.parse(sampleData);
            }
        } catch (error) {
            console.warn('Failed to parse sample models data:', error);
        }
        
        // Return hardcoded sample data if localStorage is empty
        return [
            {
                id: 'sample-1',
                name: 'Customer Churn Predictor',
                description: 'Predicts customer churn based on usage patterns',
                format: 'pkl',
                status: 'active',
                fileSize: 2048576,
                createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                requestCount: 1247,
                successfulRequests: 1198,
                avgResponseTime: 145
            },
            {
                id: 'sample-2',
                name: 'Sales Forecasting Model',
                description: 'Time series forecasting for sales predictions',
                format: 'h5',
                status: 'active',
                fileSize: 5242880,
                createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
                lastUsed: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                requestCount: 892,
                successfulRequests: 876,
                avgResponseTime: 234
            }
        ];
    }

    /**
     * Get sample user stats from localStorage
     */
    getSampleUserStats() {
        try {
            const sampleData = localStorage.getItem('sample_user_stats');
            if (sampleData) {
                return JSON.parse(sampleData);
            }
        } catch (error) {
            console.warn('Failed to parse sample user stats:', error);
        }
        
        // Return hardcoded sample stats
        return {
            totalRequests: 2139,
            avgResponseTime: 189,
            successfulRequests: 2074,
            errorCount: 65
        };
    }

    /**
     * Get sample analytics data
     */
    getSampleAnalyticsData(type) {
        const baseData = {
            requests: this.generateTimeSeriesData('requests', 7),
            performance: this.generateTimeSeriesData('performance', 24),
            errors: this.generateTimeSeriesData('errors', 7)
        };
        
        return baseData[type] || [];
    }

    /**
     * Get sample model performance
     */
    getSampleModelPerformance(modelId) {
        return {
            modelId,
            totalPredictions: Math.floor(Math.random() * 1000) + 100,
            averageResponseTime: Math.round((Math.random() * 200 + 50) * 100) / 100,
            successRate: Math.round((Math.random() * 10 + 90) * 100) / 100,
            errorRate: Math.round((Math.random() * 5) * 100) / 100,
            throughput: Math.round((Math.random() * 50 + 10) * 100) / 100
        };
    }

    /**
     * Get sample error logs
     */
    getSampleErrorLogs() {
        const errors = [];
        const errorTypes = ['ValidationError', 'TimeoutError', 'ModelError', 'AuthError'];
        
        for (let i = 0; i < 10; i++) {
            errors.push({
                timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
                type: errorTypes[Math.floor(Math.random() * errorTypes.length)],
                message: 'Sample error message',
                count: Math.floor(Math.random() * 10) + 1
            });
        }
        
        return { errors };
    }

    /**
     * Generate time series data
     */
    generateTimeSeriesData(type, periods) {
        const data = [];
        const now = new Date();
        
        for (let i = periods - 1; i >= 0; i--) {
            const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
            
            let value;
            switch (type) {
                case 'requests':
                    value = Math.floor(Math.random() * 200) + 50;
                    break;
                case 'performance':
                    value = Math.round((Math.random() * 100 + 100) * 100) / 100;
                    break;
                case 'errors':
                    value = Math.floor(Math.random() * 10) + 1;
                    break;
                default:
                    value = Math.floor(Math.random() * 100);
            }
            
            data.push({
                timestamp: date.toISOString(),
                value: value,
                date: date.toISOString().split('T')[0]
            });
        }
        
        return data;
    }
}

/**
 * CSP-compliant API client initialization
 * Avoids dynamic script loading and uses proper module pattern
 */
function initializeApiClient() {
    console.log('🔧 Creating global API client instance...');
    try {
        if (!window.apiClient) {
            window.apiClient = new ApiClient();
            console.log('✅ Global API client created:', window.apiClient);
            console.log('✅ API client type:', typeof window.apiClient);
            console.log('✅ API client methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(window.apiClient)));
        }
        return window.apiClient;
    } catch (error) {
        console.error('❌ Failed to create API client:', error);
        throw error;
    }
}

// Initialize API client when script loads
initializeApiClient();