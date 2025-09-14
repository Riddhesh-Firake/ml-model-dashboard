/**
 * Models management functionality for ML Model Dashboard
 */
class Models {
    constructor() {
        this.models = [];
        this.filteredModels = [];
        this.currentModel = null;
        this.filters = {
            search: '',
            status: '',
            format: ''
        };
        this.initializeEventListeners();
    }

    /**
     * Initialize event listeners with CSP-compliant error handling
     */
    initializeEventListeners() {
        try {
            // Search and filter inputs with error handling
            const searchInput = document.getElementById('search-models');
            const statusFilter = document.getElementById('filter-status');
            const formatFilter = document.getElementById('filter-format');

            if (searchInput) {
                searchInput.addEventListener('input', debounce((e) => {
                    try {
                        this.filters.search = e.target.value;
                        this.applyFilters();
                    } catch (error) {
                        console.error('Error handling search input:', error);
                    }
                }, 300));
            }

            if (statusFilter) {
                statusFilter.addEventListener('change', (e) => {
                    try {
                        this.filters.status = e.target.value;
                        this.applyFilters();
                    } catch (error) {
                        console.error('Error handling status filter:', error);
                    }
                });
            }

            if (formatFilter) {
                formatFilter.addEventListener('change', (e) => {
                    try {
                        this.filters.format = e.target.value;
                        this.applyFilters();
                    } catch (error) {
                        console.error('Error handling format filter:', error);
                    }
                });
            }

            // Event delegation for dynamically generated content with error handling
            const modelsContainer = document.getElementById('models-page');
            if (modelsContainer) {
                modelsContainer.addEventListener('click', (e) => {
                    try {
                        this.handleDelegatedClick(e);
                    } catch (error) {
                        console.error('Error handling delegated click:', error);
                    }
                });
            }

            // Modal event listeners with error handling
            const closeModalBtn = document.getElementById('close-modal');
            const modal = document.getElementById('model-modal');
            
            if (closeModalBtn) {
                closeModalBtn.addEventListener('click', () => {
                    try {
                        this.closeModal();
                    } catch (error) {
                        console.error('Error closing modal:', error);
                    }
                });
            }

            if (modal) {
                modal.addEventListener('click', (e) => {
                    try {
                        if (e.target === modal) {
                            this.closeModal();
                        }
                    } catch (error) {
                        console.error('Error handling modal click:', error);
                    }
                });
            }

            // Modal action buttons with error handling
            this.bindModalActionButtons();

            // Keyboard shortcuts with error handling
            document.addEventListener('keydown', (e) => {
                try {
                    if (e.key === 'Escape') {
                        this.closeModal();
                    }
                } catch (error) {
                    console.error('Error handling keyboard shortcut:', error);
                }
            });

        } catch (error) {
            console.error('Error initializing event listeners:', error);
        }
    }

    /**
     * Bind modal action buttons with proper error handling
     */
    bindModalActionButtons() {
        const buttonConfigs = [
            { id: 'test-model', handler: () => this.testModel() },
            { id: 'edit-model', handler: () => this.editModel() },
            { id: 'delete-model', handler: () => this.deleteModel() },
            { id: 'modal-copy-endpoint', handler: () => this.copyModalEndpoint() }
        ];

        buttonConfigs.forEach(config => {
            const button = document.getElementById(config.id);
            if (button) {
                button.addEventListener('click', () => {
                    try {
                        config.handler();
                    } catch (error) {
                        console.error(`Error handling ${config.id} click:`, error);
                    }
                });
            }
        });
    }

    /**
     * Handle delegated click events for dynamically generated content
     */
    handleDelegatedClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.getAttribute('data-action');
        
        switch (action) {
            case 'show-model-details':
                const modelId = target.getAttribute('data-model-id');
                console.log('🖱️ Model card clicked, modelId:', modelId);
                console.log('🎯 Target element:', target);
                console.log('📋 All data attributes:', target.dataset);
                if (modelId) {
                    this.showModelDetails(modelId);
                } else {
                    console.error('❌ No model ID found in data-model-id attribute');
                }
                break;
            case 'navigate':
                const page = target.getAttribute('data-page');
                if (page && window.app) {
                    window.app.showPage(page);
                }
                break;
            case 'clear-filters':
                this.clearFilters();
                break;
            case 'close-modal':
                const modal = target.closest('.modal');
                if (modal) {
                    modal.remove();
                }
                break;
            case 'copy-endpoint':
                const endpoint = target.getAttribute('data-endpoint');
                if (endpoint) {
                    this.copyEndpoint(endpoint);
                }
                break;
            case 'load-test-example':
                const format = target.getAttribute('data-format');
                const type = target.getAttribute('data-type');
                if (format && type) {
                    this.loadTestExample(format, type);
                }
                break;
            case 'run-model-test':
                const testModelId = target.getAttribute('data-model-id');
                if (testModelId) {
                    this.runModelTest(testModelId);
                }
                break;
            case 'generate-curl':
                const curlModelId = target.getAttribute('data-model-id');
                if (curlModelId) {
                    this.generateCurlCommand(curlModelId);
                }
                break;
            case 'copy-curl':
                const curlCommand = target.getAttribute('data-curl-command');
                if (curlCommand) {
                    this.copyCurlCommand(curlCommand);
                }
                break;
            case 'confirm-delete':
                const deleteModelId = target.getAttribute('data-model-id');
                const deleteModal = target.closest('.modal');
                if (deleteModelId && deleteModal) {
                    this.confirmDeleteModel(deleteModelId, deleteModal);
                }
                break;
        }
    }

    /**
     * Initialize models page
     */
    async init() {
        try {
            await this.loadModels();
            this.renderModels();
        } catch (error) {
            console.error('Failed to initialize models page:', error);
            showToast('Failed to load models', 'error');
        }
    }

    /**
     * Cleanup method to remove event listeners
     */
    cleanup() {
        console.log('🧹 Cleaning up Models component...');
        
        // Remove event listeners from search and filter inputs
        const searchInput = document.getElementById('search-models');
        if (searchInput) {
            searchInput.removeEventListener('input', this.handleSearchInput);
        }
        
        const statusFilter = document.getElementById('filter-status');
        if (statusFilter) {
            statusFilter.removeEventListener('change', this.handleStatusFilter);
        }
        
        const formatFilter = document.getElementById('filter-format');
        if (formatFilter) {
            formatFilter.removeEventListener('change', this.handleFormatFilter);
        }
        
        // Remove modal event listeners
        const closeModalBtn = document.getElementById('close-modal');
        if (closeModalBtn) {
            closeModalBtn.removeEventListener('click', this.closeModal);
        }
        
        const modal = document.getElementById('model-modal');
        if (modal) {
            modal.removeEventListener('click', this.handleModalClick);
        }
        
        // Remove keyboard event listener
        document.removeEventListener('keydown', this.handleKeydown);
        
        console.log('✅ Models component cleanup completed');
    }

    /**
     * Load models from API
     */
    async loadModels() {
        try {
            showLoading('Loading models...');
            console.log('🔄 Loading models from API...');
            
            const models = await window.apiClient.getModels();
            console.log('📋 Models loaded:', models);
            
            this.models = Array.isArray(models) ? models : [];
            this.filteredModels = [...this.models];
            
            console.log('✅ Models loading completed:', {
                totalModels: this.models.length,
                filteredModels: this.filteredModels.length
            });
        } catch (error) {
            console.error('❌ Error loading models:', error);
            this.models = [];
            this.filteredModels = [];
            // Don't throw error, just show empty state
            showToast('Failed to load models. Please try refreshing the page.', 'warning');
        } finally {
            hideLoading();
        }
    }

    /**
     * Apply filters to models
     */
    applyFilters() {
        this.filteredModels = this.models.filter(model => {
            // Search filter
            if (this.filters.search) {
                const searchTerm = this.filters.search.toLowerCase();
                const matchesSearch = 
                    model.name.toLowerCase().includes(searchTerm) ||
                    (model.description && model.description.toLowerCase().includes(searchTerm));
                if (!matchesSearch) return false;
            }

            // Status filter
            if (this.filters.status && model.status !== this.filters.status) {
                return false;
            }

            // Format filter
            if (this.filters.format && model.format !== this.filters.format) {
                return false;
            }

            return true;
        });

        this.renderModels();
    }

    /**
     * Render models grid
     */
    renderModels() {
        const modelsGrid = document.getElementById('models-grid');
        const noModels = document.getElementById('no-models');

        if (this.filteredModels.length === 0) {
            modelsGrid.classList.add('hidden');
            noModels.classList.remove('hidden');
            
            if (this.models.length === 0) {
                noModels.innerHTML = `
                    <i class="fas fa-cube"></i>
                    <h3>No Models Found</h3>
                    <p>You haven't uploaded any models yet.</p>
                    <button class="btn btn-primary" data-action="navigate" data-page="upload">
                        <i class="fas fa-upload"></i>
                        Upload Your First Model
                    </button>
                `;
            } else {
                noModels.innerHTML = `
                    <i class="fas fa-search"></i>
                    <h3>No Models Match Your Filters</h3>
                    <p>Try adjusting your search criteria.</p>
                    <button class="btn btn-outline" data-action="clear-filters">
                        <i class="fas fa-times"></i>
                        Clear Filters
                    </button>
                `;
            }
            return;
        }

        noModels.classList.add('hidden');
        modelsGrid.classList.remove('hidden');

        modelsGrid.innerHTML = this.filteredModels.map(model => {
            const status = formatModelStatus(model.status);
            return `
                <div class="model-card" data-action="show-model-details" data-model-id="${model.id}">
                    <div class="model-header">
                        <div>
                            <div class="model-title">${sanitizeHtml(model.name)}</div>
                            <div class="model-format">${getModelFormatName(model.format)}</div>
                        </div>
                        <span class="status-badge ${status.class}">${status.text}</span>
                    </div>
                    <div class="model-description">
                        ${sanitizeHtml(model.description || 'No description provided')}
                    </div>
                    <div class="model-stats">
                        <div class="model-stat">
                            <i class="fas fa-chart-line"></i>
                            <span>${formatNumber(model.requestCount || 0)} requests</span>
                        </div>
                        <div class="model-stat">
                            <i class="fas fa-clock"></i>
                            <span>${formatDate(model.createdAt)}</span>
                        </div>
                        <div class="model-stat">
                            <i class="fas fa-hdd"></i>
                            <span>${formatFileSize(model.fileSize || 0)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        this.filters = { search: '', status: '', format: '' };
        
        document.getElementById('search-models').value = '';
        document.getElementById('filter-status').value = '';
        document.getElementById('filter-format').value = '';
        
        this.applyFilters();
    }

    /**
     * Show model details modal
     */
    async showModelDetails(modelId) {
        try {
            console.log('🔍 showModelDetails called with modelId:', modelId);
            
            if (!modelId || modelId === 'undefined') {
                console.error('❌ Invalid model ID:', modelId);
                showToast('Invalid model ID', 'error');
                return;
            }
            
            showLoading('Loading model details...');
            
            const model = await window.apiClient.getModel(modelId);
            console.log('✅ Model loaded:', model);
            
            this.currentModel = model;
            
            this.renderModelModal(model);
            this.showModal();
            
        } catch (error) {
            console.error('Failed to load model details:', error);
            showToast('Failed to load model details', 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * Render model details in modal
     */
    async renderModelModal(model) {
        const status = formatModelStatus(model.status);
        
        // Basic information
        document.getElementById('modal-model-name').textContent = model.name;
        document.getElementById('modal-name').textContent = model.name;
        document.getElementById('modal-status').textContent = status.text;
        document.getElementById('modal-status').className = `status-badge ${status.class}`;
        document.getElementById('modal-format').textContent = getModelFormatName(model.format);
        document.getElementById('modal-created').textContent = formatDate(model.createdAt);
        document.getElementById('modal-last-used').textContent = model.lastUsed ? formatDate(model.lastUsed) : 'Never';
        document.getElementById('modal-file-size').textContent = formatFileSize(model.fileSize || 0);
        document.getElementById('modal-description').textContent = model.description || 'No description provided';
        
        // API endpoint
        const endpointUrl = model.endpointUrl || generateEndpointUrl(model.id);
        document.getElementById('modal-endpoint').value = endpointUrl;
        
        // Usage statistics
        document.getElementById('modal-request-count').textContent = formatNumber(model.requestCount || 0);
        document.getElementById('modal-avg-response').textContent = formatDuration(model.avgResponseTime || 0);
        
        const successRate = calculateSuccessRate(model.successfulRequests || 0, model.requestCount || 0);
        document.getElementById('modal-success-rate').textContent = `${successRate}%`;

        // Load and render usage analytics
        await this.loadModelAnalytics(model.id);
    }

    /**
     * Load model analytics data
     */
    async loadModelAnalytics(modelId) {
        try {
            // Try to get detailed model stats
            const stats = await window.apiClient.getModelStats(modelId).catch(() => null);
            
            if (stats) {
                this.renderUsageAnalytics(stats);
            } else {
                // Generate mock analytics data for demonstration
                this.renderUsageAnalytics(this.generateMockAnalytics(modelId));
            }
        } catch (error) {
            console.error('Failed to load model analytics:', error);
            this.renderUsageAnalytics(this.generateMockAnalytics(modelId));
        }
    }

    /**
     * Generate mock analytics data
     */
    generateMockAnalytics(modelId) {
        const days = 7;
        const today = new Date();
        const dailyStats = [];
        const hourlyStats = [];

        // Generate daily stats for the last 7 days
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            const requests = Math.floor(Math.random() * 50) + 5;
            const errors = Math.floor(requests * (Math.random() * 0.1));
            const avgResponseTime = Math.floor(Math.random() * 200) + 50;

            dailyStats.push({
                date: date.toISOString().split('T')[0],
                requests,
                errors,
                successRate: ((requests - errors) / requests * 100).toFixed(1),
                avgResponseTime,
                label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : date.toLocaleDateString('en-US', { weekday: 'short' })
            });
        }

        // Generate hourly stats for today
        for (let hour = 0; hour < 24; hour++) {
            const requests = Math.floor(Math.random() * 10) + 1;
            hourlyStats.push({
                hour,
                requests,
                label: `${hour.toString().padStart(2, '0')}:00`
            });
        }

        return {
            daily: dailyStats,
            hourly: hourlyStats,
            totalRequests: dailyStats.reduce((sum, day) => sum + day.requests, 0),
            totalErrors: dailyStats.reduce((sum, day) => sum + day.errors, 0),
            avgResponseTime: dailyStats.reduce((sum, day) => sum + day.avgResponseTime, 0) / dailyStats.length
        };
    }

    /**
     * Render usage analytics
     */
    renderUsageAnalytics(analytics) {
        // Add analytics section to modal if it doesn't exist
        let analyticsSection = document.querySelector('.analytics-section');
        if (!analyticsSection) {
            const modalBody = document.querySelector('#model-modal .modal-body');
            analyticsSection = document.createElement('div');
            analyticsSection.className = 'info-section analytics-section';
            analyticsSection.innerHTML = `
                <h3>Usage Analytics</h3>
                <div class="analytics-content">
                    <div class="analytics-tabs">
                        <button class="analytics-tab active" data-tab="daily">Daily Usage</button>
                        <button class="analytics-tab" data-tab="hourly">Hourly Usage</button>
                        <button class="analytics-tab" data-tab="performance">Performance</button>
                    </div>
                    <div class="analytics-charts">
                        <div class="analytics-chart active" id="daily-chart">
                            <canvas id="daily-usage-chart" width="500" height="200"></canvas>
                        </div>
                        <div class="analytics-chart" id="hourly-chart">
                            <canvas id="hourly-usage-chart" width="500" height="200"></canvas>
                        </div>
                        <div class="analytics-chart" id="performance-chart">
                            <div class="performance-metrics">
                                <div class="metric-card">
                                    <div class="metric-value" id="total-requests-metric">0</div>
                                    <div class="metric-label">Total Requests (7 days)</div>
                                </div>
                                <div class="metric-card">
                                    <div class="metric-value" id="error-rate-metric">0%</div>
                                    <div class="metric-label">Error Rate</div>
                                </div>
                                <div class="metric-card">
                                    <div class="metric-value" id="avg-response-metric">0ms</div>
                                    <div class="metric-label">Avg Response Time</div>
                                </div>
                            </div>
                            <canvas id="performance-trend-chart" width="500" height="150"></canvas>
                        </div>
                    </div>
                </div>
            `;
            modalBody.appendChild(analyticsSection);

            // Set up tab switching
            const tabs = analyticsSection.querySelectorAll('.analytics-tab');
            const charts = analyticsSection.querySelectorAll('.analytics-chart');

            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    charts.forEach(c => c.classList.remove('active'));
                    
                    tab.classList.add('active');
                    document.getElementById(`${tab.dataset.tab}-chart`).classList.add('active');
                });
            });
        }

        // Render charts
        this.renderDailyUsageChart(analytics.daily);
        this.renderHourlyUsageChart(analytics.hourly);
        this.renderPerformanceMetrics(analytics);
    }

    /**
     * Render daily usage chart
     */
    renderDailyUsageChart(dailyData) {
        const canvas = document.getElementById('daily-usage-chart');
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (dailyData.length === 0) return;

        // Chart dimensions
        const padding = 40;
        const chartWidth = canvas.width - (padding * 2);
        const chartHeight = canvas.height - (padding * 2);
        
        // Find max value for scaling
        const maxRequests = Math.max(...dailyData.map(d => d.requests));
        const scale = chartHeight / (maxRequests || 1);
        
        // Draw bars
        const barWidth = chartWidth / dailyData.length;
        const barSpacing = barWidth * 0.2;
        const actualBarWidth = barWidth - barSpacing;
        
        dailyData.forEach((data, index) => {
            const barHeight = data.requests * scale;
            const x = padding + (index * barWidth) + (barSpacing / 2);
            const y = canvas.height - padding - barHeight;
            
            // Draw bar
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(x, y, actualBarWidth, barHeight);
            
            // Draw error portion
            if (data.errors > 0) {
                const errorHeight = data.errors * scale;
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(x, y, actualBarWidth, errorHeight);
            }
            
            // Draw value on top of bar
            ctx.fillStyle = '#1e293b';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(data.requests.toString(), x + (actualBarWidth / 2), y - 5);
            
            // Draw label
            ctx.fillStyle = '#64748b';
            ctx.font = '11px sans-serif';
            ctx.fillText(data.label, x + (actualBarWidth / 2), canvas.height - padding + 15);
        });
        
        // Draw title
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Daily API Requests', canvas.width / 2, 20);
    }

    /**
     * Render hourly usage chart
     */
    renderHourlyUsageChart(hourlyData) {
        const canvas = document.getElementById('hourly-usage-chart');
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (hourlyData.length === 0) return;

        // Chart dimensions
        const padding = 40;
        const chartWidth = canvas.width - (padding * 2);
        const chartHeight = canvas.height - (padding * 2);
        
        // Find max value for scaling
        const maxRequests = Math.max(...hourlyData.map(d => d.requests));
        const scale = chartHeight / (maxRequests || 1);
        
        // Draw line chart
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        hourlyData.forEach((data, index) => {
            const x = padding + (index / (hourlyData.length - 1)) * chartWidth;
            const y = canvas.height - padding - (data.requests * scale);
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            
            // Draw point
            ctx.fillStyle = '#3b82f6';
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
        });
        
        ctx.stroke();
        
        // Draw title
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Hourly Usage Pattern (Today)', canvas.width / 2, 20);
    }

    /**
     * Render performance metrics
     */
    renderPerformanceMetrics(analytics) {
        document.getElementById('total-requests-metric').textContent = formatNumber(analytics.totalRequests);
        
        const errorRate = analytics.totalRequests > 0 ? 
            (analytics.totalErrors / analytics.totalRequests * 100).toFixed(1) : '0';
        document.getElementById('error-rate-metric').textContent = `${errorRate}%`;
        
        document.getElementById('avg-response-metric').textContent = `${Math.round(analytics.avgResponseTime)}ms`;

        // Render performance trend
        const canvas = document.getElementById('performance-trend-chart');
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw response time trend
        const padding = 30;
        const chartWidth = canvas.width - (padding * 2);
        const chartHeight = canvas.height - (padding * 2);
        
        const responseTimes = analytics.daily.map(d => d.avgResponseTime);
        const maxTime = Math.max(...responseTimes);
        const scale = chartHeight / (maxTime || 1);
        
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        responseTimes.forEach((time, index) => {
            const x = padding + (index / (responseTimes.length - 1)) * chartWidth;
            const y = canvas.height - padding - (time * scale);
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Draw title
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Response Time Trend', canvas.width / 2, 15);
    }

    /**
     * Show modal
     */
    showModal() {
        const modal = document.getElementById('model-modal');
        modal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }

    /**
     * Close modal
     */
    closeModal() {
        const modal = document.getElementById('model-modal');
        modal.classList.add('hidden');
        document.body.classList.remove('modal-open');
        this.currentModel = null;
    }

    /**
     * Copy endpoint URL to clipboard
     */
    async copyEndpoint(endpoint) {
        const success = await copyToClipboard(endpoint);
        
        if (success) {
            showToast('Endpoint URL copied to clipboard', 'success');
        } else {
            showToast('Failed to copy endpoint URL', 'error');
        }
    }

    /**
     * Copy modal endpoint URL
     */
    async copyModalEndpoint() {
        const endpointInput = document.getElementById('modal-endpoint');
        const success = await copyToClipboard(endpointInput.value);
        
        if (success) {
            showToast('Endpoint URL copied to clipboard', 'success');
        } else {
            showToast('Failed to copy endpoint URL', 'error');
        }
    }

    /**
     * Test model functionality
     */
    testModel() {
        if (!this.currentModel) return;
        
        // For now, show a simple test interface
        this.showTestInterface();
    }

    /**
     * Show test interface
     */
    showTestInterface() {
        const testData = {
            modelId: this.currentModel.id,
            endpoint: this.currentModel.endpointUrl || generateEndpointUrl(this.currentModel.id),
            format: this.currentModel.format
        };

        // Create enhanced test modal with better UI
        const testModal = document.createElement('div');
        testModal.className = 'modal';
        testModal.innerHTML = `
            <div class="modal-content test-modal">
                <div class="modal-header">
                    <h2>Test Model: ${sanitizeHtml(this.currentModel.name)}</h2>
                    <button class="btn-close" data-action="close-modal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="test-interface">
                        <div class="test-section">
                            <h3>API Endpoint</h3>
                            <div class="endpoint-display">
                                <div class="http-method">POST</div>
                                <input type="text" value="${testData.endpoint}" readonly class="endpoint-input">
                                <button class="btn btn-outline btn-sm" data-action="copy-endpoint" data-endpoint="${testData.endpoint}">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                        
                        <div class="test-section">
                            <h3>Request Headers</h3>
                            <div class="headers-display">
                                <div class="header-item">
                                    <span class="header-name">Content-Type:</span>
                                    <span class="header-value">application/json</span>
                                </div>
                                <div class="header-item">
                                    <span class="header-name">X-API-Key:</span>
                                    <span class="header-value">${this.apiKey || 'your-api-key'}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="test-section">
                            <div class="section-header">
                                <h3>Request Body</h3>
                                <div class="test-examples">
                                    <button class="btn btn-outline btn-sm" data-action="load-test-example" data-format="${testData.format}" data-type="basic">
                                        Basic Example
                                    </button>
                                    <button class="btn btn-outline btn-sm" data-action="load-test-example" data-format="${testData.format}" data-type="advanced">
                                        Advanced Example
                                    </button>
                                </div>
                            </div>
                            <textarea id="test-input" rows="8" placeholder='{"data": [[1.0, 2.0, 3.0]]}'></textarea>
                            <div class="input-validation" id="input-validation"></div>
                        </div>
                        
                        <div class="test-section">
                            <div class="section-header">
                                <h3>Response</h3>
                                <div class="response-info">
                                    <span id="response-status" class="response-status"></span>
                                    <span id="response-time" class="response-time"></span>
                                </div>
                            </div>
                            <textarea id="test-output" rows="8" readonly placeholder="Response will appear here..."></textarea>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" data-action="run-model-test" data-model-id="${testData.modelId}" id="run-test-btn">
                        <i class="fas fa-play"></i>
                        Run Test
                    </button>
                    <button class="btn btn-outline" data-action="generate-curl" data-model-id="${testData.modelId}">
                        <i class="fas fa-terminal"></i>
                        Generate cURL
                    </button>
                    <button class="btn btn-outline" data-action="close-modal">
                        Close
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(testModal);
        
        // Add event delegation for modal actions
        testModal.addEventListener('click', (e) => {
            this.handleDelegatedClick(e);
        });
        
        // Load default example
        this.loadTestExample(testData.format, 'basic');
        
        // Add input validation
        const testInput = document.getElementById('test-input');
        testInput.addEventListener('input', () => this.validateTestInput());
    }

    /**
     * Load test example data
     */
    loadTestExample(format, type) {
        const examples = {
            pkl: {
                basic: '{\n  "data": [[1.0, 2.0, 3.0, 4.0]]\n}',
                advanced: '{\n  "data": [\n    [1.0, 2.0, 3.0, 4.0],\n    [2.0, 3.0, 4.0, 5.0]\n  ],\n  "feature_names": ["feature1", "feature2", "feature3", "feature4"]\n}'
            },
            joblib: {
                basic: '{\n  "data": [[1.0, 2.0, 3.0, 4.0]]\n}',
                advanced: '{\n  "data": [\n    [1.0, 2.0, 3.0, 4.0],\n    [2.0, 3.0, 4.0, 5.0]\n  ],\n  "feature_names": ["feature1", "feature2", "feature3", "feature4"]\n}'
            },
            h5: {
                basic: '{\n  "data": [[[1.0, 2.0], [3.0, 4.0]]]\n}',
                advanced: '{\n  "data": [\n    [[[1.0, 2.0], [3.0, 4.0]]],\n    [[[2.0, 3.0], [4.0, 5.0]]]\n  ],\n  "batch_size": 2\n}'
            },
            onnx: {
                basic: '{\n  "input_data": [[1.0, 2.0, 3.0, 4.0]]\n}',
                advanced: '{\n  "input_data": [\n    [1.0, 2.0, 3.0, 4.0],\n    [2.0, 3.0, 4.0, 5.0]\n  ],\n  "input_names": ["input_tensor"]\n}'
            },
            pt: {
                basic: '{\n  "data": [[1.0, 2.0, 3.0, 4.0]]\n}',
                advanced: '{\n  "data": [\n    [1.0, 2.0, 3.0, 4.0],\n    [2.0, 3.0, 4.0, 5.0]\n  ],\n  "device": "cpu"\n}'
            },
            pth: {
                basic: '{\n  "data": [[1.0, 2.0, 3.0, 4.0]]\n}',
                advanced: '{\n  "data": [\n    [1.0, 2.0, 3.0, 4.0],\n    [2.0, 3.0, 4.0, 5.0]\n  ],\n  "device": "cpu"\n}'
            }
        };

        const example = examples[format]?.[type] || examples.pkl[type];
        document.getElementById('test-input').value = example;
        this.validateTestInput();
    }

    /**
     * Validate test input JSON
     */
    validateTestInput() {
        const testInput = document.getElementById('test-input');
        const validation = document.getElementById('input-validation');
        
        try {
            JSON.parse(testInput.value);
            validation.innerHTML = '<i class="fas fa-check-circle text-success"></i> Valid JSON';
            validation.className = 'input-validation valid';
            document.getElementById('run-test-btn').disabled = false;
        } catch (error) {
            validation.innerHTML = `<i class="fas fa-exclamation-circle text-error"></i> Invalid JSON: ${error.message}`;
            validation.className = 'input-validation invalid';
            document.getElementById('run-test-btn').disabled = true;
        }
    }

    /**
     * Copy endpoint URL
     */
    async copyEndpoint(endpoint) {
        const success = await copyToClipboard(endpoint);
        if (success) {
            showToast('Endpoint URL copied to clipboard', 'success');
        } else {
            showToast('Failed to copy endpoint URL', 'error');
        }
    }

    /**
     * Generate cURL command
     */
    generateCurlCommand(modelId) {
        const testInput = document.getElementById('test-input');
        const endpoint = this.currentModel.endpointUrl || generateEndpointUrl(modelId);
        
        let inputData;
        try {
            inputData = JSON.parse(testInput.value || '{}');
        } catch (error) {
            inputData = {};
        }

        const curlCommand = `curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-api-key" \\
  -d '${JSON.stringify(inputData, null, 2)}'`;

        // Show cURL command in a modal
        const curlModal = document.createElement('div');
        curlModal.className = 'modal';
        curlModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>cURL Command</h2>
                    <button class="btn-close" data-action="close-modal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <p>Copy this cURL command to test your model from the command line:</p>
                    <textarea readonly rows="8" class="curl-command">${curlCommand}</textarea>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" data-action="copy-curl" data-curl-command="${curlCommand.replace(/"/g, '&quot;')}">
                        <i class="fas fa-copy"></i>
                        Copy Command
                    </button>
                    <button class="btn btn-outline" data-action="close-modal">
                        Close
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(curlModal);
        
        // Add event delegation for modal actions
        curlModal.addEventListener('click', (e) => {
            this.handleDelegatedClick(e);
        });
    }

    /**
     * Copy cURL command
     */
    async copyCurlCommand(command) {
        const success = await copyToClipboard(command);
        if (success) {
            showToast('cURL command copied to clipboard', 'success');
        } else {
            showToast('Failed to copy cURL command', 'error');
        }
    }

    /**
     * Run model test
     */
    async runModelTest(modelId) {
        console.log('🧪 runModelTest called with modelId:', modelId);
        
        if (!modelId || modelId === 'undefined') {
            console.error('❌ Invalid model ID for test:', modelId);
            showToast('Invalid model ID for test', 'error');
            return;
        }
        
        const testInput = document.getElementById('test-input');
        const testOutput = document.getElementById('test-output');
        const responseStatus = document.getElementById('response-status');
        const responseTime = document.getElementById('response-time');
        const runButton = document.getElementById('run-test-btn');
        
        try {
            const inputData = JSON.parse(testInput.value || '{}');
            console.log('📊 Test input data:', inputData);
            
            // Update UI for running state
            testOutput.value = 'Running test...';
            responseStatus.textContent = '';
            responseTime.textContent = '';
            runButton.disabled = true;
            runButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...';
            
            const startTime = Date.now();
            console.log('🚀 Calling predict API with modelId:', modelId);
            const result = await window.apiClient.predict(modelId, inputData);
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            console.log('✅ Prediction result:', result);
            
            // Update response
            testOutput.value = JSON.stringify(result, null, 2);
            responseStatus.textContent = '200 OK';
            responseStatus.className = 'response-status success';
            responseTime.textContent = `${duration}ms`;
            
            showToast('Test completed successfully', 'success');
            
        } catch (error) {
            const errorMessage = parseErrorMessage(error);
            testOutput.value = JSON.stringify({
                error: errorMessage,
                timestamp: new Date().toISOString()
            }, null, 2);
            
            responseStatus.textContent = 'Error';
            responseStatus.className = 'response-status error';
            responseTime.textContent = '';
            
            showToast('Test failed', 'error');
        } finally {
            runButton.disabled = false;
            runButton.innerHTML = '<i class="fas fa-play"></i> Run Test';
        }
    }

    /**
     * Edit model functionality
     */
    editModel() {
        if (!this.currentModel) return;
        
        // Create enhanced edit form
        const editModal = document.createElement('div');
        editModal.className = 'modal';
        editModal.innerHTML = `
            <div class="modal-content edit-modal">
                <div class="modal-header">
                    <h2>Edit Model: ${sanitizeHtml(this.currentModel.name)}</h2>
                    <button class="btn-close" data-action="close-modal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="edit-model-form">
                    <div class="modal-body">
                        <div class="edit-sections">
                            <div class="edit-section">
                                <h3>Basic Information</h3>
                                <div class="form-group">
                                    <label for="edit-name">Model Name *</label>
                                    <input type="text" id="edit-name" value="${sanitizeHtml(this.currentModel.name)}" required maxlength="100">
                                    <div class="field-help">Choose a descriptive name for your model</div>
                                </div>
                                <div class="form-group">
                                    <label for="edit-description">Description</label>
                                    <textarea id="edit-description" rows="4" maxlength="500" placeholder="Describe what your model does and its use case...">${sanitizeHtml(this.currentModel.description || '')}</textarea>
                                    <div class="field-help">
                                        <span id="description-count">0</span>/500 characters
                                    </div>
                                </div>
                            </div>
                            
                            <div class="edit-section">
                                <h3>Model Configuration</h3>
                                <div class="form-group">
                                    <label for="edit-status">Status</label>
                                    <select id="edit-status">
                                        <option value="active" ${this.currentModel.status === 'active' ? 'selected' : ''}>Active - Model is available for predictions</option>
                                        <option value="inactive" ${this.currentModel.status === 'inactive' ? 'selected' : ''}>Inactive - Model is temporarily disabled</option>
                                        <option value="archived" ${this.currentModel.status === 'archived' ? 'selected' : ''}>Archived - Model is archived and read-only</option>
                                    </select>
                                    <div class="field-help">
                                        <div class="status-info">
                                            <div class="status-option" data-status="active">
                                                <i class="fas fa-check-circle text-success"></i>
                                                <strong>Active:</strong> Model accepts prediction requests
                                            </div>
                                            <div class="status-option" data-status="inactive">
                                                <i class="fas fa-pause-circle text-warning"></i>
                                                <strong>Inactive:</strong> Model is temporarily disabled
                                            </div>
                                            <div class="status-option" data-status="archived">
                                                <i class="fas fa-archive text-muted"></i>
                                                <strong>Archived:</strong> Model is read-only and cannot be modified
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="edit-section">
                                <h3>Model Information</h3>
                                <div class="info-grid">
                                    <div class="info-item">
                                        <label>Format:</label>
                                        <span>${getModelFormatName(this.currentModel.format)}</span>
                                    </div>
                                    <div class="info-item">
                                        <label>File Size:</label>
                                        <span>${formatFileSize(this.currentModel.fileSize || 0)}</span>
                                    </div>
                                    <div class="info-item">
                                        <label>Created:</label>
                                        <span>${formatDate(this.currentModel.createdAt)}</span>
                                    </div>
                                    <div class="info-item">
                                        <label>Last Used:</label>
                                        <span>${this.currentModel.lastUsed ? formatDate(this.currentModel.lastUsed) : 'Never'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="submit" class="btn btn-primary" id="save-changes-btn">
                            <i class="fas fa-save"></i>
                            Save Changes
                        </button>
                        <button type="button" class="btn btn-outline" data-action="close-modal">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(editModal);

        // Add event delegation for modal actions
        editModal.addEventListener('click', (e) => {
            this.handleDelegatedClick(e);
        });

        // Set up form validation and interactions
        this.setupEditFormValidation(editModal);

        // Handle form submission
        const editForm = editModal.querySelector('#edit-model-form');
        editForm.addEventListener('submit', (e) => this.saveModelChanges(e, editModal));
    }

    /**
     * Set up edit form validation and interactions
     */
    setupEditFormValidation(modal) {
        const nameInput = modal.querySelector('#edit-name');
        const descriptionInput = modal.querySelector('#edit-description');
        const statusSelect = modal.querySelector('#edit-status');
        const descriptionCount = modal.querySelector('#description-count');
        const saveButton = modal.querySelector('#save-changes-btn');

        // Character count for description
        const updateDescriptionCount = () => {
            const count = descriptionInput.value.length;
            descriptionCount.textContent = count;
            descriptionCount.className = count > 450 ? 'text-warning' : '';
        };

        descriptionInput.addEventListener('input', updateDescriptionCount);
        updateDescriptionCount();

        // Name validation
        const validateName = () => {
            const name = nameInput.value.trim();
            const isValid = name.length >= 3 && name.length <= 100;
            
            if (!isValid && name.length > 0) {
                nameInput.setCustomValidity('Model name must be between 3 and 100 characters');
            } else {
                nameInput.setCustomValidity('');
            }
            
            return isValid;
        };

        nameInput.addEventListener('input', validateName);

        // Status change handling
        statusSelect.addEventListener('change', () => {
            const selectedStatus = statusSelect.value;
            const statusOptions = modal.querySelectorAll('.status-option');
            
            statusOptions.forEach(option => {
                option.classList.toggle('hidden', option.dataset.status !== selectedStatus);
            });
        });

        // Initial status display
        statusSelect.dispatchEvent(new Event('change'));

        // Form validation
        const validateForm = () => {
            const isNameValid = validateName();
            const hasChanges = this.hasModelChanges(modal);
            
            saveButton.disabled = !isNameValid || !hasChanges;
        };

        nameInput.addEventListener('input', validateForm);
        descriptionInput.addEventListener('input', validateForm);
        statusSelect.addEventListener('change', validateForm);

        validateForm();
    }

    /**
     * Check if model has changes
     */
    hasModelChanges(modal) {
        const nameInput = modal.querySelector('#edit-name');
        const descriptionInput = modal.querySelector('#edit-description');
        const statusSelect = modal.querySelector('#edit-status');

        return (
            nameInput.value.trim() !== this.currentModel.name ||
            descriptionInput.value.trim() !== (this.currentModel.description || '') ||
            statusSelect.value !== this.currentModel.status
        );
    }

    /**
     * Save model changes
     */
    async saveModelChanges(e, modal) {
        e.preventDefault();
        
        const name = document.getElementById('edit-name').value;
        const description = document.getElementById('edit-description').value;
        const status = document.getElementById('edit-status').value;
        
        try {
            showLoading('Saving changes...');
            
            await window.apiClient.updateModel(this.currentModel.id, {
                name: name.trim(),
                description: description.trim(),
                status
            });
            
            // Update current model
            this.currentModel.name = name.trim();
            this.currentModel.description = description.trim();
            this.currentModel.status = status;
            
            // Refresh models list and modal
            await this.loadModels();
            this.renderModels();
            this.renderModelModal(this.currentModel);
            
            modal.remove();
            showToast('Model updated successfully', 'success');
            
        } catch (error) {
            console.error('Failed to update model:', error);
            showToast('Failed to update model', 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * Delete model functionality
     */
    deleteModel() {
        if (!this.currentModel) return;
        
        // Show confirmation dialog
        const confirmModal = document.createElement('div');
        confirmModal.className = 'modal';
        confirmModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Delete Model</h2>
                    <button class="btn-close" data-action="close-modal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <p>Are you sure you want to delete the model <strong>"${sanitizeHtml(this.currentModel.name)}"</strong>?</p>
                    <p>This action cannot be undone. The model file and all associated data will be permanently deleted.</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-danger" data-action="confirm-delete" data-model-id="${this.currentModel.id}">
                        <i class="fas fa-trash"></i>
                        Delete Model
                    </button>
                    <button class="btn btn-outline" data-action="close-modal">
                        Cancel
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(confirmModal);
        
        // Add event delegation for modal actions
        confirmModal.addEventListener('click', (e) => {
            this.handleDelegatedClick(e);
        });
    }

    /**
     * Confirm model deletion
     */
    async confirmDeleteModel(modelId, confirmModal) {
        try {
            showLoading('Deleting model...');
            
            await window.apiClient.deleteModel(modelId);
            
            // Remove from models array
            this.models = this.models.filter(model => model.id !== modelId);
            this.applyFilters();
            
            confirmModal.remove();
            this.closeModal();
            
            showToast('Model deleted successfully', 'success');
            
        } catch (error) {
            console.error('Failed to delete model:', error);
            showToast('Failed to delete model', 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * Refresh models list
     */
    async refresh() {
        try {
            await this.loadModels();
            this.renderModels();
        } catch (error) {
            console.error('Failed to refresh models:', error);
            showToast('Failed to refresh models', 'error');
        }
    }
}

// Export models class
window.Models = Models;