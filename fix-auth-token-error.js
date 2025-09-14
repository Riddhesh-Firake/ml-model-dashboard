/**
 * Fix Authentication Token Error
 * 
 * This script fixes the "Invalid or expired token" error by:
 * 1. Clearing fake session tokens
 * 2. Registering a new user with proper JWT token
 * 3. Testing the authentication flow
 */

class AuthFixer {
    constructor() {
        this.baseUrl = window.location.origin;
        this.testUser = {
            email: `test-${Date.now()}@example.com`,
            password: 'TestPassword123!'
        };
    }

    async fixAuthentication() {
        console.log('🔧 Starting authentication fix...');
        
        try {
            // Step 1: Clear existing fake tokens
            this.clearFakeTokens();
            
            // Step 2: Register new user
            const registerResult = await this.registerUser();
            if (!registerResult.success) {
                throw new Error('Registration failed: ' + registerResult.error);
            }
            
            // Step 3: Test authentication
            const testResult = await this.testAuthentication();
            if (!testResult.success) {
                throw new Error('Authentication test failed: ' + testResult.error);
            }
            
            console.log('✅ Authentication fix completed successfully!');
            return {
                success: true,
                message: 'Authentication fixed successfully',
                user: this.testUser,
                token: registerResult.token
            };
            
        } catch (error) {
            console.error('❌ Authentication fix failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    clearFakeTokens() {
        console.log('🧹 Clearing fake session tokens...');
        
        const authToken = localStorage.getItem('auth_token');
        if (authToken && authToken.startsWith('session_')) {
            console.log('Found fake session token, removing...');
            localStorage.removeItem('auth_token');
        }
        
        // Clear other auth-related items to start fresh
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_subscription');
        
        console.log('✅ Fake tokens cleared');
    }

    async registerUser() {
        console.log('👤 Registering new user:', this.testUser.email);
        
        try {
            const response = await fetch(`${this.baseUrl}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.testUser)
            });

            const result = await response.json();

            if (response.ok && result.token) {
                console.log('✅ User registered successfully');
                
                // Store the real JWT token
                localStorage.setItem('auth_token', result.token);
                localStorage.setItem('user_email', result.user.email);
                localStorage.setItem('user_id', result.user.id);
                localStorage.setItem('user_subscription', result.user.subscription);
                
                return {
                    success: true,
                    token: result.token,
                    user: result.user
                };
            } else {
                return {
                    success: false,
                    error: result.error?.message || 'Registration failed'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async testAuthentication() {
        console.log('🧪 Testing authentication...');
        
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                return {
                    success: false,
                    error: 'No token found after registration'
                };
            }

            // Test with a simple API call
            const response = await fetch(`${this.baseUrl}/api/models`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                console.log('✅ Authentication test passed');
                return { success: true };
            } else {
                const result = await response.json();
                return {
                    success: false,
                    error: result.error?.message || 'Authentication test failed'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async testModelPrediction() {
        console.log('🔮 Testing model prediction...');
        
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                return {
                    success: false,
                    error: 'No authentication token'
                };
            }

            const testData = {
                bedrooms: 3,
                bathrooms: 2,
                sqft: 1500,
                age: 10
            };

            const response = await fetch(`${this.baseUrl}/api/predict/test-model`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(testData)
            });

            const result = await response.json();

            if (response.ok) {
                console.log('✅ Model prediction test passed');
                console.log('Prediction result:', result);
                return {
                    success: true,
                    prediction: result
                };
            } else {
                return {
                    success: false,
                    error: result.error?.message || 'Prediction failed'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Auto-fix function that can be called from console
async function fixAuthError() {
    const fixer = new AuthFixer();
    const result = await fixer.fixAuthentication();
    
    if (result.success) {
        console.log('🎉 Authentication fixed! You can now test your models.');
        console.log('User credentials:', result.user);
        
        // Test model prediction as well
        const predictionTest = await fixer.testModelPrediction();
        if (predictionTest.success) {
            console.log('🎯 Model prediction also works!');
            console.log('Prediction:', predictionTest.prediction);
        } else {
            console.warn('⚠️ Model prediction test failed:', predictionTest.error);
        }
        
        // Reload the page to apply changes
        setTimeout(() => {
            console.log('🔄 Reloading page to apply changes...');
            window.location.reload();
        }, 2000);
        
    } else {
        console.error('❌ Failed to fix authentication:', result.error);
    }
    
    return result;
}

// Make functions available globally
window.AuthFixer = AuthFixer;
window.fixAuthError = fixAuthError;

// Auto-run if this script is loaded directly
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🔧 Auth fixer loaded. Run fixAuthError() to fix authentication issues.');
    });
} else {
    console.log('🔧 Auth fixer loaded. Run fixAuthError() to fix authentication issues.');
}