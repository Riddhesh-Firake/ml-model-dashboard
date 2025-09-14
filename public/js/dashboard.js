/**
 * Dashboard functionality for ML Model Dashboard
 * CSP-compliant implementation with safe DOM manipulation
 */
class Dashboard {
    constructor() {
        this.stats = {
            totalModels: 0,
            totalRequests: 0,
            avgResponseTime: 0,
            activeModels: 0
        };
        this.recentModels = [];
        this.usageData = [];
        this.refreshInterval = null;
    }

    /**
     * Initialize dashboard
     */
    async init() {
        try {
            await this.loadDashboardData();
            this.renderStats();
            this.renderRecentModels();
            await this.initAnalytics();
            this.startAutoRefresh();
        } catch (error) {
            console.error('Failed to initialize dashboard:', error);
            showToast('Failed to load dashboard data', 'error');
        }
    }

    /**
     * Load dashboard data from API
     */
    async loadDashboardData() {
        try {
            showLoading('Loading dashboard data...');
            
            console.log('🔄 Loading dashboard data...');
            
            // Load user stats and models in parallel with better error handling
            const [userStats, models] = await Promise.all([
                window.apiClient.getUserStats().catch((error) => {
                    console.warn('⚠️ Failed to load user stats:', error.message);
                    return { totalRequests: 0, avgResponseTime: 0 };
                }),
                window.apiClient.getModels().catch((error) => {
                    console.warn('⚠️ Failed to load models:', error.message);
                    return [];
                })
            ]);

            // Debug logging
            console.log('📊 Dashboard data loaded:', { userStats, models });
            console.log('📋 Models type:', typeof models, 'Is array:', Array.isArray(models), 'Length:', models?.length);

            // Ensure models is an array
            const modelsArray = Array.isArray(models) ? models : [];

            // Calculate stats from models
            this.stats.totalModels = modelsArray.length;
            this.stats.activeModels = modelsArray.filter(model => model && model.status === 'active').length;
            this.stats.totalRequests = userStats.totalRequests || 0;
            this.stats.avgResponseTime = userStats.avgResponseTime || 0;

            console.log('📈 Calculated stats:', this.stats);

            // Get recent models (last 5)
            this.recentModels = modelsArray
                .filter(model => model && model.createdAt) // Filter out invalid models
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5);

            console.log('🕒 Recent models:', this.recentModels);

            // Generate usage data (mock data for now)
            this.generateUsageData(modelsArray);

            console.log('✅ Dashboard data loading completed');

        } catch (error) {
            console.error('❌ Error loading dashboard data:', error);
            // Set fallback data
            this.stats = {
                totalModels: 0,
                totalRequests: 0,
                avgResponseTime: 0,
                activeModels: 0
            };
            this.recentModels = [];
            this.generateUsageData([]);
        } finally {
            hideLoading();
        }
    }

    /**
     * Generate usage data for chart
     */
    generateUsageData(models) {
        // Generate last 7 days of usage data
        const days = 7;
        const today = new Date();
        this.usageData = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            // Mock usage data based on models
            const requests = Math.floor(Math.random() * (models.length * 10)) + models.length;
            
            this.usageData.push({
                date: date.toISOString().split('T')[0],
                requests: requests,
                label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : date.toLocaleDateString('en-US', { weekday: 'short' })
            });
        }
    }

    /**
     * Render statistics cards
     */
    renderStats() {
        document.getElementById('total-models').textContent = formatNumber(this.stats.totalModels);
        document.getElementById('total-requests').textContent = formatNumber(this.stats.totalRequests);
        document.getElementById('avg-response-time').textContent = formatDuration(this.stats.avgResponseTime);
        document.getElementById('active-models').textContent = formatNumber(this.stats.activeModels);
    }

    /**
     * Render recent models list
     */
    renderRecentModels() {
        const container = document.getElementById('recent-models-list');
        
        if (this.recentModels.length === 0) {
            container.innerHTML = `
                <div class="no-models">
                    <p>No models uploaded yet</p>
                    <button class="btn btn-primary" data-action="navigate" data-page="upload">
                        <i class="fas fa-upload"></i>
                        Upload Your First Model
                    </button>
                </div>
            `;
            
            // Add event listener for the upload button
            const uploadButton = container.querySelector('[data-action="navigate"]');
            if (uploadButton) {
                uploadButton.addEventListener('click', () => {
                    if (window.app) {
                        window.app.showPage('upload');
                    }
                });
            }
            return;
        }

        // CSP-compliant DOM creation without innerHTML for dynamic content
        this.renderRecentModelsSecurely(container);
    }

    /**
     * Render recent models using CSP-compliant DOM creation
     */
    renderRecentModelsSecurely(container) {
        // Clear container
        container.innerHTML = '';
        
        this.recentModels.forEach(model => {
            const modelItem = document.createElement('div');
            modelItem.className = 'model-item';
            modelItem.setAttribute('data-model-id', model.id);
            
            // Create header
            const header = document.createElement('div');
            header.className = 'model-item-header';
            
            const titleDiv = document.createElement('div');
            titleDiv.className = 'model-item-title';
            
            const title = document.createElement('h4');
            title.textContent = model.name;
            
            const format = document.createElement('span');
            format.className = 'model-format';
            format.textContent = getModelFormatName(model.format);
            
            titleDiv.appendChild(title);
            titleDiv.appendChild(format);
            
            const statusBadge = document.createElement('span');
            const status = formatModelStatus(model.status);
            statusBadge.className = `status-badge ${status.class}`;
            statusBadge.textContent = status.text;
            
            header.appendChild(titleDiv);
            header.appendChild(statusBadge);
            
            // Create description
            const description = document.createElement('p');
            description.className = 'model-item-description';
            description.textContent = model.description || 'No description';
            
            // Create stats
            const stats = document.createElement('div');
            stats.className = 'model-item-stats';
            
            const requestsSpan = document.createElement('span');
            requestsSpan.innerHTML = `<i class="fas fa-chart-line"></i> ${formatNumber(model.requestCount || 0)} requests`;
            
            const dateSpan = document.createElement('span');
            dateSpan.innerHTML = `<i class="fas fa-clock"></i> ${formatDate(model.createdAt)}`;
            
            stats.appendChild(requestsSpan);
            stats.appendChild(dateSpan);
            
            // Assemble model item
            modelItem.appendChild(header);
            modelItem.appendChild(description);
            modelItem.appendChild(stats);
            
            // Add click event listener
            modelItem.addEventListener('click', () => {
                if (window.app) {
                    window.app.showModelDetails(model.id);
                }
            });
            
            container.appendChild(modelItem);
        });
    }

    /**
     * Initialize analytics
     */
    async initAnalytics() {
        try {
            if (window.AnalyticsService) {
                this.analytics = new window.AnalyticsService();
                await this.analytics.init();
            } else {
                console.warn('AnalyticsService not available, using fallback chart');
                this.renderFallbackChart();
            }
        } catch (error) {
            console.error('Failed to initialize analytics:', error);
            this.renderFallbackChart();
        }
    }

    /**
     * Render fallback chart when analytics service is not available
     */
    renderFallbackChart() {
        // Try to find the old usage chart canvas
        const canvas = document.getElementById('usage-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (this.usageData.length === 0) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No usage data available', canvas.width / 2, canvas.height / 2);
            return;
        }

        // Chart dimensions
        const padding = 40;
        const chartWidth = canvas.width - (padding * 2);
        const chartHeight = canvas.height - (padding * 2);
        
        // Find max value for scaling
        const maxRequests = Math.max(...this.usageData.map(d => d.requests));
        const scale = chartHeight / (maxRequests || 1);
        
        // Draw axes
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        
        // Y-axis
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, canvas.height - padding);
        ctx.stroke();
        
        // X-axis
        ctx.beginPath();
        ctx.moveTo(padding, canvas.height - padding);
        ctx.lineTo(canvas.width - padding, canvas.height - padding);
        ctx.stroke();
        
        // Draw bars
        const barWidth = chartWidth / this.usageData.length;
        const barSpacing = barWidth * 0.2;
        const actualBarWidth = barWidth - barSpacing;
        
        this.usageData.forEach((data, index) => {
            const barHeight = data.requests * scale;
            const x = padding + (index * barWidth) + (barSpacing / 2);
            const y = canvas.height - padding - barHeight;
            
            // Draw bar
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(x, y, actualBarWidth, barHeight);
            
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
     * Start auto refresh
     */
    startAutoRefresh() {
        // Refresh every 5 minutes
        this.refreshInterval = setInterval(() => {
            this.refresh();
        }, 5 * 60 * 1000);
    }

    /**
     * Stop auto refresh
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * Refresh dashboard data
     */
    async refresh() {
        try {
            await this.loadDashboardData();
            this.renderStats();
            this.renderRecentModels();
            
            // Refresh analytics if available
            if (this.analytics) {
                await this.analytics.refresh();
            } else {
                this.renderFallbackChart();
            }
        } catch (error) {
            console.error('Failed to refresh dashboard:', error);
        }
    }

    /**
     * Cleanup dashboard
     */
    destroy() {
        this.stopAutoRefresh();
        
        // Cleanup analytics
        if (this.analytics) {
            this.analytics.destroy();
            this.analytics = null;
        }
    }
}



// Export dashboard class
window.Dashboard = Dashboard;