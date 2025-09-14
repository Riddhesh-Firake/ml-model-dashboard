/**
 * AppInitializer - Centralized application initialization and event binding
 * Manages the startup sequence and coordinates all event handlers
 */
class AppInitializer {
    constructor() {
        this.eventManager = null;
        this.modelInteractionHandler = null;
        this.initialized = false;
        this.cleanupHandlers = [];
        
        // Bind methods to preserve context
        this.handleDOMContentLoaded = this.handleDOMContentLoaded.bind(this);
        this.handlePageUnload = this.handlePageUnload.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.handlePageShow = this.handlePageShow.bind(this);
        this.handlePageHide = this.handlePageHide.bind(this);
        this.handleNavigation = this.handleNavigation.bind(this);
        this.handleGlobalAction = this.handleGlobalAction.bind(this);
        this.handleGlobalFormSubmit = this.handleGlobalFormSubmit.bind(this);
        this.handleGlobalKeyboard = this.handleGlobalKeyboard.bind(this);
        this.handlePopState = this.handlePopState.bind(this);
        this.handleHashChange = this.handleHashChange.bind(this);
        this.handleLoginForm = this.handleLoginForm.bind(this);
        this.handleRegisterForm = this.handleRegisterForm.bind(this);
        this.handleUploadForm = this.handleUploadForm.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
        this.handleToastClose = this.handleToastClose.bind(this);
        this.handleModalBackdropClick = this.handleModalBackdropClick.bind(this);
        this.handleCopyAction = this.handleCopyAction.bind(this);
        this.handleToggleAction = this.handleToggleAction.bind(this);
    }

    /**
     * Initialize the application
     * Sets up all event managers and handlers
     */
    async initialize() {
        if (this.initialized) {
            console.warn('AppInitializer: Already initialized');
            return;
        }

        try {
            console.log('AppInitializer: Starting initialization...');
            
            // Initialize core event management
            this.initializeEventManager();
            
            // Set up global event handlers
            this.setupGlobalEventHandlers();
            
            // Initialize component handlers
            this.initializeComponentHandlers();
            
            // Set up navigation handlers
            this.setupNavigationHandlers();
            
            // Set up form handlers
            this.setupFormHandlers();
            
            // Set up utility handlers
            this.setupUtilityHandlers();
            
            // Set up page lifecycle handlers
            this.setupPageLifecycleHandlers();
            
            this.initialized = true;
            console.log('AppInitializer: Initialization complete');
            
            // Dispatch custom event to notify other components
            this.dispatchInitializationComplete();
            
        } catch (error) {
            console.error('AppInitializer: Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize the event manager
     */
    initializeEventManager() {
        this.eventManager = new EventManager();
        
        // Make event manager globally available
        window.eventManager = this.eventManager;
        
        console.log('AppInitializer: EventManager initialized');
    }

    /**
     * Initialize component-specific handlers
     */
    initializeComponentHandlers() {
        // Initialize model interaction handler
        if (window.apiClient) {
            this.modelInteractionHandler = new ModelInteractionHandler(
                this.eventManager,
                window.apiClient
            );
            this.modelInteractionHandler.initialize();
            
            // Make globally available
            window.modelInteractionHandler = this.modelInteractionHandler;
            
            console.log('AppInitializer: ModelInteractionHandler initialized');
        } else {
            console.warn('AppInitializer: API client not available, skipping ModelInteractionHandler');
        }
    }

    /**
     * Set up global event handlers
     */
    setupGlobalEventHandlers() {
        // Global click handler for data-action attributes
        const globalClickId = this.eventManager.delegateEvent(
            document.body,
            '[data-action]',
            'click',
            this.handleGlobalAction.bind(this)
        );

        // Global form submission handler
        const globalFormId = this.eventManager.delegateEvent(
            document.body,
            'form[data-action]',
            'submit',
            this.handleGlobalFormSubmit.bind(this)
        );

        // Global keyboard shortcuts
        const keyboardId = this.eventManager.addEventListener(
            document,
            'keydown',
            this.handleGlobalKeyboard.bind(this)
        );

        this.cleanupHandlers.push(globalClickId, globalFormId, keyboardId);
        
        console.log('AppInitializer: Global event handlers set up');
    }

    /**
     * Set up navigation handlers
     */
    setupNavigationHandlers() {
        // Navigation link handlers
        const navLinksId = this.eventManager.delegateEvent(
            document.body,
            '.nav-link[data-page]',
            'click',
            this.handleNavigation.bind(this)
        );

        // Browser back/forward navigation
        const popstateId = this.eventManager.addEventListener(
            window,
            'popstate',
            this.handlePopState.bind(this)
        );

        // Hash change navigation
        const hashChangeId = this.eventManager.addEventListener(
            window,
            'hashchange',
            this.handleHashChange.bind(this)
        );

        this.cleanupHandlers.push(navLinksId, popstateId, hashChangeId);
        
        console.log('AppInitializer: Navigation handlers set up');
    }

    /**
     * Set up form handlers
     */
    setupFormHandlers() {
        // Login form handler
        const loginFormId = this.eventManager.delegateEvent(
            document.body,
            '#login-form',
            'submit',
            this.handleLoginForm.bind(this)
        );

        // Registration form handler
        const registerFormId = this.eventManager.delegateEvent(
            document.body,
            '#register-form',
            'submit',
            this.handleRegisterForm.bind(this)
        );

        // Upload form handler
        const uploadFormId = this.eventManager.delegateEvent(
            document.body,
            '#upload-form',
            'submit',
            this.handleUploadForm.bind(this)
        );

        // Search form handler
        const searchId = this.eventManager.delegateEvent(
            document.body,
            '#search-models',
            'input',
            debounce(this.handleSearch.bind(this), 300)
        );

        this.cleanupHandlers.push(loginFormId, registerFormId, uploadFormId, searchId);
        
        console.log('AppInitializer: Form handlers set up');
    }

    /**
     * Set up utility handlers
     */
    setupUtilityHandlers() {
        // Toast close handlers
        const toastCloseId = this.eventManager.delegateEvent(
            document.body,
            '.toast-close',
            'click',
            this.handleToastClose.bind(this)
        );

        // Modal backdrop click handlers
        const modalBackdropId = this.eventManager.delegateEvent(
            document.body,
            '.modal',
            'click',
            this.handleModalBackdropClick.bind(this)
        );

        // Copy button handlers
        const copyButtonId = this.eventManager.delegateEvent(
            document.body,
            '[data-copy]',
            'click',
            this.handleCopyAction.bind(this)
        );

        // Toggle button handlers
        const toggleId = this.eventManager.delegateEvent(
            document.body,
            '[data-toggle]',
            'click',
            this.handleToggleAction.bind(this)
        );

        this.cleanupHandlers.push(toastCloseId, modalBackdropId, copyButtonId, toggleId);
        
        console.log('AppInitializer: Utility handlers set up');
    }

    /**
     * Set up page lifecycle handlers
     */
    setupPageLifecycleHandlers() {
        // Page visibility change
        const visibilityId = this.eventManager.addEventListener(
            document,
            'visibilitychange',
            this.handleVisibilityChange
        );

        // Page show/hide events
        const pageShowId = this.eventManager.addEventListener(
            window,
            'pageshow',
            this.handlePageShow
        );

        const pageHideId = this.eventManager.addEventListener(
            window,
            'pagehide',
            this.handlePageHide
        );

        // Before unload
        const beforeUnloadId = this.eventManager.addEventListener(
            window,
            'beforeunload',
            this.handlePageUnload
        );

        this.cleanupHandlers.push(visibilityId, pageShowId, pageHideId, beforeUnloadId);
        
        console.log('AppInitializer: Page lifecycle handlers set up');
    }

    /**
     * Handle global actions via data-action attributes
     * @param {Event} event - Click event
     */
    handleGlobalAction(event) {
        const element = event.delegatedTarget;
        const action = element.getAttribute('data-action');
        
        // Skip if already handled by specific handlers
        if (element.closest('.model-card') || element.closest('.modal')) {
            return;
        }

        switch (action) {
            case 'navigate':
                const page = element.getAttribute('data-page');
                if (page && window.app) {
                    event.preventDefault();
                    window.app.showPage(page);
                }
                break;
                
            case 'logout':
                event.preventDefault();
                this.handleLogout();
                break;
                
            case 'refresh':
                event.preventDefault();
                this.handleRefresh();
                break;
                
            case 'clear-filters':
                event.preventDefault();
                this.handleClearFilters();
                break;
                
            default:
                // Let other handlers process the action
                break;
        }
    }

    /**
     * Handle global form submissions
     * @param {Event} event - Submit event
     */
    handleGlobalFormSubmit(event) {
        const form = event.delegatedTarget;
        const action = form.getAttribute('data-action');
        
        switch (action) {
            case 'search':
                event.preventDefault();
                this.handleSearch({ target: form.querySelector('input[type="search"], input[name="search"]') });
                break;
                
            case 'filter':
                event.preventDefault();
                // Handle filter form submission
                break;
                
            default:
                // Let specific handlers process the form
                break;
        }
    }

    /**
     * Handle global keyboard shortcuts
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleGlobalKeyboard(event) {
        // Ctrl/Cmd + K for search
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
            event.preventDefault();
            const searchInput = document.getElementById('search-models');
            if (searchInput) {
                searchInput.focus();
            }
        }
        
        // Escape key for closing modals/dropdowns
        if (event.key === 'Escape') {
            this.handleEscapeKey();
        }
        
        // Ctrl/Cmd + R for refresh (prevent default and use custom refresh)
        if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
            event.preventDefault();
            this.handleRefresh();
        }
    }

    /**
     * Handle navigation clicks
     * @param {Event} event - Click event
     */
    handleNavigation(event) {
        event.preventDefault();
        
        const link = event.delegatedTarget;
        const page = link.getAttribute('data-page');
        
        if (page && window.app && window.app.showPage) {
            window.app.showPage(page);
        }
    }

    /**
     * Handle browser back/forward navigation
     * @param {PopStateEvent} event - PopState event
     */
    handlePopState(event) {
        if (event.state && event.state.page && window.app) {
            window.app.showPage(event.state.page, false);
        }
    }

    /**
     * Handle hash change navigation
     * @param {HashChangeEvent} event - HashChange event
     */
    handleHashChange(event) {
        const hash = window.location.hash.substring(1);
        const validPages = ['dashboard', 'upload', 'models'];
        
        if (validPages.includes(hash) && window.app && window.app.showPage) {
            window.app.showPage(hash, false);
        }
    }

    /**
     * Handle login form submission
     * @param {Event} event - Submit event
     */
    handleLoginForm(event) {
        if (window.app && typeof window.app.handleLogin === 'function') {
            window.app.handleLogin(event);
        }
    }

    /**
     * Handle registration form submission
     * @param {Event} event - Submit event
     */
    handleRegisterForm(event) {
        if (window.app && typeof window.app.handleRegister === 'function') {
            window.app.handleRegister(event);
        }
    }

    /**
     * Handle upload form submission
     * @param {Event} event - Submit event
     */
    handleUploadForm(event) {
        if (window.upload && typeof window.upload.handleFormSubmit === 'function') {
            window.upload.handleFormSubmit(event);
        }
    }

    /**
     * Handle search input
     * @param {Event} event - Input event
     */
    handleSearch(event) {
        if (window.app && window.app.models && typeof window.app.models.applyFilters === 'function') {
            window.app.models.filters.search = event.target.value;
            window.app.models.applyFilters();
        }
    }

    /**
     * Handle toast close
     * @param {Event} event - Click event
     */
    handleToastClose(event) {
        const toast = event.delegatedTarget.closest('.toast');
        if (toast) {
            removeToast(toast.id);
        }
    }

    /**
     * Handle modal backdrop clicks
     * @param {Event} event - Click event
     */
    handleModalBackdropClick(event) {
        if (event.target === event.delegatedTarget) {
            const modal = event.delegatedTarget;
            if (this.modelInteractionHandler) {
                this.modelInteractionHandler.closeModal(modal);
            } else {
                modal.classList.add('hidden');
                document.body.classList.remove('modal-open');
            }
        }
    }

    /**
     * Handle copy actions
     * @param {Event} event - Click event
     */
    async handleCopyAction(event) {
        const element = event.delegatedTarget;
        const textToCopy = element.getAttribute('data-copy');
        
        if (textToCopy) {
            const success = await copyToClipboard(textToCopy);
            if (success) {
                showToast('Copied to clipboard', 'success');
            } else {
                showToast('Failed to copy', 'error');
            }
        }
    }

    /**
     * Handle toggle actions
     * @param {Event} event - Click event
     */
    handleToggleAction(event) {
        const element = event.delegatedTarget;
        const targetSelector = element.getAttribute('data-toggle');
        
        if (targetSelector) {
            const target = document.querySelector(targetSelector);
            if (target) {
                target.classList.toggle('hidden');
            }
        }
    }

    /**
     * Handle logout
     */
    async handleLogout() {
        if (window.app && typeof window.app.logout === 'function') {
            await window.app.logout();
        }
    }

    /**
     * Handle refresh
     */
    async handleRefresh() {
        if (window.app && typeof window.app.refresh === 'function') {
            await window.app.refresh();
        }
    }

    /**
     * Handle clear filters
     */
    handleClearFilters() {
        if (window.app && window.app.models && typeof window.app.models.clearFilters === 'function') {
            window.app.models.clearFilters();
        }
    }

    /**
     * Handle escape key
     */
    handleEscapeKey() {
        // Close any open modals
        const openModal = document.querySelector('.modal:not(.hidden)');
        if (openModal) {
            if (this.modelInteractionHandler) {
                this.modelInteractionHandler.closeModal(openModal);
            } else {
                openModal.classList.add('hidden');
                document.body.classList.remove('modal-open');
            }
        }
        
        // Close any open dropdowns
        const openDropdowns = document.querySelectorAll('.dropdown.open');
        openDropdowns.forEach(dropdown => {
            dropdown.classList.remove('open');
        });
    }

    /**
     * Handle DOM content loaded
     */
    handleDOMContentLoaded() {
        console.log('AppInitializer: DOM content loaded');
        
        // Initialize the application if not already done
        if (!this.initialized) {
            this.initialize().catch(error => {
                console.error('AppInitializer: Failed to initialize on DOM ready:', error);
            });
        }
    }

    /**
     * Handle page visibility change
     */
    handleVisibilityChange() {
        if (!document.hidden && window.app && window.app.initialized) {
            // Refresh data when user returns to tab
            setTimeout(() => {
                if (window.app && typeof window.app.refresh === 'function') {
                    window.app.refresh();
                }
            }, 1000);
        }
    }

    /**
     * Handle page show event
     * @param {PageTransitionEvent} event - Page show event
     */
    handlePageShow(event) {
        console.log('AppInitializer: Page show event', event.persisted ? '(from cache)' : '(fresh load)');
        
        if (event.persisted && this.initialized) {
            // Page was loaded from cache, refresh data
            this.handleRefresh();
        }
    }

    /**
     * Handle page hide event
     * @param {PageTransitionEvent} event - Page hide event
     */
    handlePageHide(event) {
        console.log('AppInitializer: Page hide event');
        
        // Save any pending data or state
        this.saveApplicationState();
    }

    /**
     * Handle page unload
     * @param {BeforeUnloadEvent} event - Before unload event
     */
    handlePageUnload(event) {
        console.log('AppInitializer: Page unload event');
        
        // Perform cleanup
        this.cleanup();
        
        // Save application state
        this.saveApplicationState();
    }

    /**
     * Save application state to localStorage
     */
    saveApplicationState() {
        try {
            const state = {
                currentPage: window.app ? window.app.currentPage : 'dashboard',
                timestamp: Date.now()
            };
            
            localStorage.setItem('app_state', JSON.stringify(state));
        } catch (error) {
            console.warn('AppInitializer: Failed to save application state:', error);
        }
    }

    /**
     * Restore application state from localStorage
     */
    restoreApplicationState() {
        try {
            const stateJson = localStorage.getItem('app_state');
            if (stateJson) {
                const state = JSON.parse(stateJson);
                
                // Only restore if state is recent (within 1 hour)
                if (Date.now() - state.timestamp < 3600000) {
                    return state;
                }
            }
        } catch (error) {
            console.warn('AppInitializer: Failed to restore application state:', error);
        }
        
        return null;
    }

    /**
     * Dispatch initialization complete event
     */
    dispatchInitializationComplete() {
        const event = new CustomEvent('appInitialized', {
            detail: {
                eventManager: this.eventManager,
                modelInteractionHandler: this.modelInteractionHandler,
                timestamp: Date.now()
            }
        });
        
        document.dispatchEvent(event);
    }

    /**
     * Clean up all event handlers and resources
     */
    cleanup() {
        console.log('AppInitializer: Starting cleanup...');
        
        // Clean up component handlers
        if (this.modelInteractionHandler) {
            this.modelInteractionHandler.destroy();
            this.modelInteractionHandler = null;
        }
        
        // Clean up event manager
        if (this.eventManager) {
            this.eventManager.destroy();
            this.eventManager = null;
        }
        
        // Clear global references
        if (window.eventManager) {
            delete window.eventManager;
        }
        if (window.modelInteractionHandler) {
            delete window.modelInteractionHandler;
        }
        
        this.cleanupHandlers = [];
        this.initialized = false;
        
        console.log('AppInitializer: Cleanup complete');
    }

    /**
     * Destroy the initializer
     */
    destroy() {
        this.cleanup();
        console.log('AppInitializer: Destroyed');
    }
}

// Create global instance and set up initialization
window.appInitializer = new AppInitializer();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.appInitializer.handleDOMContentLoaded);
} else {
    // DOM is already ready
    window.appInitializer.handleDOMContentLoaded();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppInitializer;
} else {
    window.AppInitializer = AppInitializer;
}