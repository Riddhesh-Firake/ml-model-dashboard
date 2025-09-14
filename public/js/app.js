/**
 * Main application controller for ML Model Dashboard
 * CSP-compliant implementation with secure DOM manipulation
 */
class App {
    constructor() {
        console.log('🏗️ Constructing App instance...');
        
        this.currentPage = 'dashboard';
        this.dashboard = null;
        this.upload = null;
        this.models = null;
        this.user = null;
        this.initialized = false;
        
        // Bind methods to preserve context
        console.log('🔗 Binding methods...');
        this.handleLogin = this.handleLogin.bind(this);
        this.handleRegister = this.handleRegister.bind(this);
        this.logout = this.logout.bind(this);
        this.showPage = this.showPage.bind(this);
        this.refresh = this.refresh.bind(this);
        this.showModelDetails = this.showModelDetails.bind(this);
        this.handleInitialLoad = this.handleInitialLoad.bind(this);
        this.showLoginForm = this.showLoginForm.bind(this);
        this.showRegisterForm = this.showRegisterForm.bind(this);
        this.createLoginModal = this.createLoginModal.bind(this);
        this.createRegisterModal = this.createRegisterModal.bind(this);
        this.createFormGroup = this.createFormGroup.bind(this);
        
        console.log('✅ App constructor completed');
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('🔄 App.init() called, initialized:', this.initialized);
            
            // Prevent re-initialization if already initialized
            if (this.initialized) {
                console.log('⚠️ App already initialized, skipping re-initialization');
                return;
            }

            // Check authentication
            if (!this.checkAuthentication()) {
                this.showLoginForm();
                return;
            }

            // Load user info
            await this.loadUserInfo();

            // Clean up existing components if they exist
            this.cleanup();

            // Initialize components
            console.log('🏗️ Creating new component instances...');
            this.dashboard = new Dashboard();
            this.upload = new Upload();
            this.models = new Models();

            // Set up navigation
            this.initializeNavigation();

            // Show initial page
            await this.showPage('dashboard');

            this.initialized = true;
            console.log('✅ ML Model Dashboard initialized successfully');

        } catch (error) {
            console.error('❌ Failed to initialize application:', error);
            showToast('Failed to initialize application', 'error');
        }
    }

    /**
     * Reset the application state for re-initialization
     */
    reset() {
        console.log('🔄 Resetting application state...');
        this.initialized = false;
        this.cleanup();
    }

    /**
     * Clean up existing components and event listeners
     */
    cleanup() {
        console.log('🧹 Cleaning up existing components...');
        
        // Clean up existing components if they have cleanup methods
        if (this.dashboard && typeof this.dashboard.cleanup === 'function') {
            this.dashboard.cleanup();
        }
        if (this.upload && typeof this.upload.cleanup === 'function') {
            this.upload.cleanup();
        }
        if (this.models && typeof this.models.cleanup === 'function') {
            this.models.cleanup();
        }
        
        // Reset component references
        this.dashboard = null;
        this.upload = null;
        this.models = null;
        
        console.log('✅ Cleanup completed');
    }

    /**
     * Check if user is authenticated
     */
    checkAuthentication() {
        return isAuthenticated();
    }

    /**
     * Load user information
     */
    async loadUserInfo() {
        try {
            // Try to get user info from localStorage first
            const userEmail = localStorage.getItem('user_email');
            const userId = localStorage.getItem('user_id');
            const userSubscription = localStorage.getItem('user_subscription');
            
            if (userEmail) {
                this.user = { 
                    email: userEmail, 
                    id: userId, 
                    subscription: userSubscription 
                };
                this.updateUserDisplay();
                return;
            }

            // If no stored info, try to fetch from API
            const user = await window.apiClient.getCurrentUser();
            this.user = user;
            this.updateUserDisplay();

        } catch (error) {
            console.error('Failed to load user info:', error);
            // Use fallback user info
            this.user = { email: 'user@example.com' };
            this.updateUserDisplay();
        }
    }

    /**
     * Update user display in navigation
     */
    updateUserDisplay() {
        const userEmailElement = document.getElementById('user-email');
        if (userEmailElement && this.user) {
            userEmailElement.textContent = this.user.email;
        }
    }

    /**
     * Initialize navigation
     */
    initializeNavigation() {
        // Navigation links
        const navLinks = document.querySelectorAll('.nav-link[data-page]');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.getAttribute('data-page');
                this.showPage(page);
            });
        });

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        logoutBtn.addEventListener('click', () => this.logout());

        // Debug test buttons
        const testRegistrationBtn = document.getElementById('test-registration-btn');
        if (testRegistrationBtn) {
            testRegistrationBtn.addEventListener('click', () => this.testRegistration());
        }

        const testLoginBtn = document.getElementById('test-login-btn');
        if (testLoginBtn) {
            testLoginBtn.addEventListener('click', () => this.testLogin());
        }

        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.page) {
                this.showPage(e.state.page, false);
            }
        });
    }

    /**
     * Show specific page
     */
    async showPage(pageName, updateHistory = true) {
        if (!this.initialized && pageName !== 'dashboard') {
            console.warn('Application not fully initialized yet');
            return;
        }

        try {
            // Hide all pages
            const pages = document.querySelectorAll('.page');
            pages.forEach(page => page.classList.remove('active'));

            // Update navigation
            const navLinks = document.querySelectorAll('.nav-link');
            navLinks.forEach(link => link.classList.remove('active'));

            const activeNavLink = document.querySelector(`.nav-link[data-page="${pageName}"]`);
            if (activeNavLink) {
                activeNavLink.classList.add('active');
            }

            // Show target page
            const targetPage = document.getElementById(`${pageName}-page`);
            if (targetPage) {
                targetPage.classList.add('active');
            }

            // Initialize page-specific functionality
            switch (pageName) {
                case 'dashboard':
                    if (this.dashboard) {
                        await this.dashboard.init();
                    }
                    break;
                case 'upload':
                    if (this.upload) {
                        this.upload.init();
                    }
                    break;
                case 'models':
                    if (this.models) {
                        await this.models.init();
                    }
                    break;
            }

            this.currentPage = pageName;

            // Update browser history
            if (updateHistory) {
                const url = pageName === 'dashboard' ? '/' : `/#${pageName}`;
                history.pushState({ page: pageName }, '', url);
            }

        } catch (error) {
            console.error(`Failed to show page ${pageName}:`, error);
            showToast(`Failed to load ${pageName} page`, 'error');
        }
    }

    /**
     * Show model details modal
     */
    async showModelDetails(modelId) {
        if (this.models) {
            await this.models.showModelDetails(modelId);
        }
    }

    /**
     * Show login form modal using CSP-compliant DOM creation
     */
    showLoginForm() {
    // Remove any existing modal
    const existingModal = document.getElementById('login-modal') || document.getElementById('register-modal');
    if (existingModal) existingModal.remove();

    // Create login modal using secure DOM methods
    const loginModal = this.createLoginModal();
    document.body.appendChild(loginModal);

    // Attach event listeners programmatically
    const loginForm = document.getElementById('login-form');
    const registerBtn = document.getElementById('go-to-register-btn');
    
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }
    if (registerBtn) {
        registerBtn.addEventListener('click', () => this.showRegisterForm());
    }
}

    /**
     * Create login modal using CSP-compliant DOM creation
     */
    createLoginModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'login-modal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // Header
    const header = document.createElement('div');
    header.className = 'modal-header';
    const title = document.createElement('h2');
    title.textContent = 'Login to ML Model Dashboard';
    header.appendChild(title);
    
    // Form
    const form = document.createElement('form');
    form.id = 'login-form';
    
    // Modal body
    const body = document.createElement('div');
    body.className = 'modal-body';
    
    // Email field
    const emailGroup = this.createFormGroup('login-email', 'Email', 'email', 'Enter your email', true);
    body.appendChild(emailGroup);
    
    // Password field
    const passwordGroup = this.createFormGroup('login-password', 'Password', 'password', 'Enter your password', true);
    body.appendChild(passwordGroup);
    
    // API Key field
    const apiKeyGroup = this.createFormGroup('login-api-key', 'API Key (Optional)', 'text', 'Enter your API key if you have one', false);
    const small = document.createElement('small');
    small.textContent = 'You can use either email/password or API key for authentication';
    apiKeyGroup.appendChild(small);
    body.appendChild(apiKeyGroup);
    
    // Footer
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    
    const loginBtn = document.createElement('button');
    loginBtn.type = 'submit';
    loginBtn.className = 'btn btn-primary';
    loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
    
    const registerBtn = document.createElement('button');
    registerBtn.type = 'button';
    registerBtn.id = 'go-to-register-btn';
    registerBtn.className = 'btn btn-outline';
    registerBtn.textContent = 'Register';
    
    footer.appendChild(loginBtn);
    footer.appendChild(registerBtn);
    
    form.appendChild(body);
    form.appendChild(footer);
    modalContent.appendChild(header);
    modalContent.appendChild(form);
    modal.appendChild(modalContent);
    
    return modal;
}

    /**
     * Show register form modal using CSP-compliant DOM creation
     */
    showRegisterForm() {
    // Remove any existing modal
    const existingModal = document.getElementById('login-modal') || document.getElementById('register-modal');
    if (existingModal) existingModal.remove();

    // Create register modal using secure DOM methods
    const registerModal = this.createRegisterModal();
    document.body.appendChild(registerModal);

    // Attach event listeners programmatically
    const registerForm = document.getElementById('register-form');
    const backToLoginBtn = document.getElementById('back-to-login-btn');
    const registerBtn = document.getElementById('register-submit-btn');
    
    if (registerForm) {
        console.log('🔗 Attaching register form event listener');
        registerForm.addEventListener('submit', (e) => {
            console.log('🎯 Register form submit event triggered');
            this.handleRegister(e);
        });
    }

    if (backToLoginBtn) {
        console.log('🔗 Attaching back to login button event listener');
        backToLoginBtn.addEventListener('click', () => {
            console.log('🎯 Back to login button clicked');
            this.showLoginForm();
        });
    }

    if (registerBtn) {
        console.log('🔗 Attaching register button click event listener as backup');
        registerBtn.addEventListener('click', (e) => {
            console.log('🎯 Register button clicked directly');
            if (e.target.type === 'submit') {
                return;
            }
            e.preventDefault();
            this.handleRegister(e);
        });
    }
}

    /**
     * Create register modal using CSP-compliant DOM creation
     */
    createRegisterModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'register-modal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // Header
    const header = document.createElement('div');
    header.className = 'modal-header';
    const title = document.createElement('h2');
    title.textContent = 'Register for ML Model Dashboard';
    header.appendChild(title);
    
    // Form
    const form = document.createElement('form');
    form.id = 'register-form';
    
    // Modal body
    const body = document.createElement('div');
    body.className = 'modal-body';
    
    // Email field
    const emailGroup = this.createFormGroup('register-email', 'Email', 'email', 'Enter your email', true);
    body.appendChild(emailGroup);
    
    // Password field
    const passwordGroup = this.createFormGroup('register-password', 'Password', 'password', 'Create a password', true);
    body.appendChild(passwordGroup);
    
    // Confirm Password field
    const confirmPasswordGroup = this.createFormGroup('register-confirm-password', 'Confirm Password', 'password', 'Confirm your password', true);
    body.appendChild(confirmPasswordGroup);
    
    // Footer
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    
    const registerBtn = document.createElement('button');
    registerBtn.type = 'submit';
    registerBtn.id = 'register-submit-btn';
    registerBtn.className = 'btn btn-primary';
    registerBtn.innerHTML = '<i class="fas fa-user-plus"></i> Register';
    
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.id = 'back-to-login-btn';
    backBtn.className = 'btn btn-outline';
    backBtn.textContent = 'Back to Login';
    
    footer.appendChild(registerBtn);
    footer.appendChild(backBtn);
    
    form.appendChild(body);
    form.appendChild(footer);
    modalContent.appendChild(header);
    modalContent.appendChild(form);
    modal.appendChild(modalContent);
    
    return modal;
}

    /**
     * Create form group element using CSP-compliant DOM creation
     */
    createFormGroup(id, labelText, inputType, placeholder, required = false) {
    const group = document.createElement('div');
    group.className = 'form-group';
    
    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = labelText;
    
    const input = document.createElement('input');
    input.type = inputType;
    input.id = id;
    input.placeholder = placeholder;
    if (required) {
        input.required = true;
    }
    
    group.appendChild(label);
    group.appendChild(input);
    
    return group;
}




    

    /**
     * Handle login form submission
     */
    async handleLogin(e) {
        e.preventDefault();
        console.log('🔄 Login form submitted');
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const apiKey = document.getElementById('login-api-key').value;

        console.log('📝 Login data:', { 
            email, 
            passwordLength: password.length, 
            hasApiKey: !!apiKey 
        });

        try {
            console.log('🚀 Starting login process...');
            showLoading('Logging in...');

            if (apiKey) {
                console.log('🗝️ Using API key authentication');
                // Use API key authentication
                window.apiClient.setApiKey(apiKey);
                // Test API key by making a request
                await window.apiClient.getCurrentUser();
                console.log('✅ API key authentication successful');
            } else {
                console.log('🔑 Using email/password authentication');
                console.log('🔍 Checking window object:', typeof window);
                console.log('🔍 Checking window.apiClient availability:', typeof window.apiClient, window.apiClient);
                console.log('🔍 All window properties containing "api":', Object.keys(window).filter(key => key.toLowerCase().includes('api')));
                
                if (!window.apiClient) {
                    console.log('⚠️ API client not found, attempting to create it...');
                    try {
                        window.apiClient = new ApiClient();
                        console.log('✅ API client created successfully:', window.apiClient);
                    } catch (createError) {
                        console.error('❌ Failed to create API client:', createError);
                        throw new Error('API client not initialized and could not be created');
                    }
                }
                
                // Use email/password authentication
                const result = await window.apiClient.login(email, password);
                console.log('✅ Login API call successful:', result);
                
                // Store the actual JWT token returned by the API
                if (result.token) {
                    console.log('🔑 Setting JWT token for user');
                    window.apiClient.setToken(result.token);
                }
                
                // Store user information
                if (result.user && result.user.email) {
                    console.log('🔑 Setting user info for:', result.user.email);
                    localStorage.setItem('user_email', result.user.email);
                    localStorage.setItem('user_id', result.user.id);
                    localStorage.setItem('user_subscription', result.user.subscription);
                }
            }

            // Remove login modal
            const loginModal = document.getElementById('login-modal');
            if (loginModal) {
                loginModal.remove();
            }

            // Reset and initialize application
            console.log('🎯 Resetting and initializing application after login...');
            this.reset();
            await this.init();
            console.log('🎉 Login process completed successfully');
            showToast('Login successful!', 'success');

        } catch (error) {
            console.error('❌ Login failed with error:', error);
            console.error('Error details:', {
                message: error.message,
                status: error.status,
                response: error.response
            });
            
            let errorMessage = 'Login failed. Please check your credentials.';
            if (error.status === 401) {
                errorMessage = 'Invalid email, password, or API key.';
            } else if (error.status === 404) {
                errorMessage = 'Login service not available. Please try again later.';
            } else if (error.status === 500) {
                errorMessage = 'Server error. Please try again later.';
            }
            
            showToast(errorMessage, 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * Handle register form submission
     */
    async handleRegister(e) {
        console.log('🎯 handleRegister called with event:', e);
        e.preventDefault();
        console.log('🔄 Registration form submitted');
        
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;

        console.log('📝 Registration data:', { email, passwordLength: password.length });

        // Validate passwords match
        if (password !== confirmPassword) {
            console.error('❌ Password validation failed: passwords do not match');
            showToast('Passwords do not match', 'error');
            return;
        }

        try {
            console.log('🚀 Starting registration API call...');
            console.log('🔍 Checking apiClient availability:', typeof window.apiClient, window.apiClient);
            
            if (!window.apiClient) {
                console.log('⚠️ API client not found, attempting to create it...');
                try {
                    window.apiClient = new ApiClient();
                    console.log('✅ API client created successfully:', window.apiClient);
                } catch (createError) {
                    console.error('❌ Failed to create API client:', createError);
                    throw new Error('API client not initialized and could not be created');
                }
            }
            
            showLoading('Creating account...');

            const result = await window.apiClient.register(email, password);
            console.log('✅ Registration API call successful:', result);
            
            // Store the actual JWT token returned by the API
            if (result.token) {
                console.log('🔑 Setting JWT token for user');
                window.apiClient.setToken(result.token);
            }
            
            // Store user information
            if (result.user && result.user.email) {
                console.log('🔑 Setting user info for:', result.user.email);
                localStorage.setItem('user_email', result.user.email);
                localStorage.setItem('user_id', result.user.id);
                localStorage.setItem('user_subscription', result.user.subscription);
            }

            // Remove register modal
            const registerModal = document.getElementById('register-modal');
            if (registerModal) {
                registerModal.remove();
            }

            // Reset and initialize application
            console.log('🎯 Resetting and initializing application after registration...');
            this.reset();
            await this.init();
            console.log('🎉 Registration process completed successfully');
            showToast('Registration successful!', 'success');

        } catch (error) {
            console.error('❌ Registration failed with error:', error);
            console.error('Error details:', {
                message: error.message,
                status: error.status,
                response: error.response
            });
            
            let errorMessage = 'Registration failed. Please try again.';
            if (error.message && error.message.includes('already exists')) {
                errorMessage = 'An account with this email already exists.';
            } else if (error.status === 400) {
                errorMessage = 'Invalid registration data. Please check your input.';
            } else if (error.status === 500) {
                errorMessage = 'Server error. Please try again later.';
            }
            
            showToast(errorMessage, 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * Logout user
     */
    async logout() {
        try {
            // Call logout API
            await window.apiClient.logout().catch(() => {
                // Ignore logout API errors
            });

            // Clear authentication
            window.apiClient.clearAuth();

            // Reset application state
            this.user = null;
            this.initialized = false;

            // Cleanup components
            if (this.dashboard) {
                this.dashboard.destroy();
                this.dashboard = null;
            }

            // Show login form
            this.showLoginForm();
            showToast('Logged out successfully', 'success');

        } catch (error) {
            console.error('Logout error:', error);
            // Force logout even if API call fails
            window.apiClient.clearAuth();
            this.showLoginForm();
        }
    }

    /**
     * Handle initial page load
     */
    handleInitialLoad() {
        // Check URL hash for initial page
        const hash = window.location.hash.substring(1);
        const validPages = ['dashboard', 'upload', 'models'];
        
        if (validPages.includes(hash)) {
            this.showPage(hash, false);
        } else {
            this.showPage('dashboard', false);
        }
    }

    /**
     * Refresh current page
     */
    async refresh() {
        await this.showPage(this.currentPage, false);
    }

    /**
     * Test registration API call
     */
    async testRegistration() {
        console.log('🧪 Testing registration API...');
        
        const testEmail = 'test@example.com';
        const testPassword = 'testpassword123';
        
        try {
            console.log('📝 Test registration data:', { email: testEmail, passwordLength: testPassword.length });
            
            const result = await window.apiClient.register(testEmail, testPassword);
            console.log('✅ Test registration successful:', result);
            showToast('Test registration successful!', 'success');
            
        } catch (error) {
            console.error('❌ Test registration failed:', error);
            console.error('Error details:', {
                message: error.message,
                status: error.status,
                response: error.response
            });
            showToast(`Test registration failed: ${error.message}`, 'error');
        }
    }

    /**
     * Test login API call
     */
    async testLogin() {
        console.log('🧪 Testing login API...');
        
        const testEmail = 'test@example.com';
        const testPassword = 'testpassword123';
        
        try {
            console.log('📝 Test login data:', { email: testEmail, passwordLength: testPassword.length });
            
            const result = await window.apiClient.login(testEmail, testPassword);
            console.log('✅ Test login successful:', result);
            showToast('Test login successful!', 'success');
            
        } catch (error) {
            console.error('❌ Test login failed:', error);
            console.error('Error details:', {
                message: error.message,
                status: error.status,
                response: error.response
            });
            showToast(`Test login failed: ${error.message}`, 'error');
        }
    }
}

// Make App class available globally for testing
window.App = App;

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🚀 Initializing ML Model Dashboard...');
        window.app = new App();
        
        // Handle initial authentication and page load
        if (window.app.checkAuthentication()) {
            console.log('✅ User is authenticated, initializing app...');
            await window.app.init();
            window.app.handleInitialLoad();
        } else {
            console.log('⚠️ User not authenticated, showing login form...');
            window.app.showLoginForm();
        }
    } catch (error) {
        console.error('❌ Failed to initialize application:', error);
        showToast('Failed to initialize application. Please refresh the page.', 'error');
    }
});

// Handle page visibility changes to refresh data
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.app && window.app.initialized) {
        // Refresh current page when user returns to tab
        setTimeout(() => {
            window.app.refresh();
        }, 1000);
    }
});