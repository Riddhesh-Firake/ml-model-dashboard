import { CSPConfig } from '../services/security/csp.middleware';
import { getProductionCSPConfig, validateProductionCSP } from './production-csp.config';

export const cspConfig: Record<string, CSPConfig> = {
  development: {
    enabled: false, // Temporarily disabled for debugging
    reportOnly: true, // Set to true for testing without enforcement
    nonce: {
      enabled: true,
      length: 16,
      algorithm: 'base64'
    },
    directives: {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        // Note: nonce will be added automatically by middleware
        // Remove 'unsafe-inline' for production security
      ],
      'style-src': [
        "'self'",
        // Note: nonce will be added automatically by middleware
        // Allow external stylesheets
        'https://fonts.googleapis.com',
        'https://cdnjs.cloudflare.com'
      ],
      'img-src': [
        "'self'",
        'data:',
        'https:',
        'blob:' // For dynamically generated images
      ],
      'connect-src': [
        "'self'",
        // Add any external APIs your app connects to
      ],
      'font-src': [
        "'self'",
        'https://fonts.gstatic.com',
        'https://cdnjs.cloudflare.com',
        'data:'
      ],
      'object-src': ["'none'"],
      'media-src': ["'self'"],
      'frame-src': ["'none'"],
      'worker-src': ["'self'"],
      'manifest-src': ["'self'"],
      'report-uri': ['/api/csp-violations']
    }
  },

  test: {
    enabled: false, // Disable CSP in test environment to avoid interference
    reportOnly: false,
    nonce: {
      enabled: false,
      length: 16,
      algorithm: 'base64'
    },
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'"],
      'font-src': ["'self'", 'https:', 'data:'],
      'object-src': ["'none'"],
      'media-src': ["'self'"],
      'frame-src': ["'none'"],
      'worker-src': ["'self'"],
      'manifest-src': ["'self'"]
    }
  },

  production: {
    enabled: true,
    reportOnly: false,
    nonce: {
      enabled: true,
      length: 32, // Longer nonce for production security
      algorithm: 'base64'
    },
    directives: {
      'default-src': ["'self'"],
      'script-src': [
        "'self'"
        // Note: nonce will be added automatically by middleware
        // STRICT: NO 'unsafe-inline' or 'unsafe-eval' in production
        // Only nonce-based scripts are allowed
      ],
      'style-src': [
        "'self'"
        // Note: nonce will be added automatically by middleware
        // STRICT: NO 'unsafe-inline' in production
        // Only nonce-based styles and trusted external sources allowed
      ],
      'img-src': [
        "'self'",
        'data:' // For base64 encoded images only
        // Removed 'https:' and 'blob:' for stricter policy
      ],
      'connect-src': [
        "'self'"
        // Only allow connections to same origin
        // Add specific external APIs if needed
      ],
      'font-src': [
        "'self'",
        'data:' // For base64 encoded fonts only
        // Removed external font sources for stricter policy
      ],
      'object-src': ["'none'"], // Block all plugins
      'media-src': ["'self'"], // Only same-origin media
      'frame-src': ["'none'"], // Block all frames/iframes
      'worker-src': ["'self'"], // Only same-origin workers
      'manifest-src': ["'self'"], // Only same-origin manifest
      'base-uri': ["'self'"], // Prevent base tag injection
      'form-action': ["'self'"], // Only same-origin form submissions
      'frame-ancestors': ["'none'"], // Prevent clickjacking
      'upgrade-insecure-requests': [], // Force HTTPS
      'block-all-mixed-content': [], // Block mixed content
      'report-uri': ['/api/csp-violations'],
      'report-to': ['csp-endpoint'] // For modern browsers
    }
  },

  // Staging environment with slightly relaxed policy for testing
  staging: {
    enabled: true,
    reportOnly: false,
    nonce: {
      enabled: true,
      length: 24,
      algorithm: 'base64'
    },
    directives: {
      'default-src': ["'self'"],
      'script-src': [
        "'self'"
        // Note: nonce will be added automatically by middleware
      ],
      'style-src': [
        "'self'",
        // Allow some external stylesheets for staging
        'https://fonts.googleapis.com'
      ],
      'img-src': [
        "'self'",
        'data:',
        'https:' // Allow HTTPS images in staging
      ],
      'connect-src': [
        "'self'"
      ],
      'font-src': [
        "'self'",
        'https://fonts.gstatic.com',
        'https://cdnjs.cloudflare.com',
        'data:'
      ],
      'object-src': ["'none'"],
      'media-src': ["'self'"],
      'frame-src': ["'none'"],
      'worker-src': ["'self'"],
      'manifest-src': ["'self'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'report-uri': ['/api/csp-violations'],
      'report-to': ['csp-endpoint']
    }
  }
};

/**
 * Get CSP configuration for current environment
 */
export function getCSPConfig(): CSPConfig {
  const env = process.env.NODE_ENV || 'development';
  
  // Use strict production CSP for production environment
  if (env === 'production') {
    const useStrictCSP = process.env.CSP_STRICT !== 'false'; // Default to strict
    const config = getProductionCSPConfig(useStrictCSP);
    
    // Validate production CSP and log warnings
    const warnings = validateProductionCSP(config);
    if (warnings.length > 0) {
      console.warn('CSP Configuration Warnings:', warnings);
    }
    
    return config;
  }
  
  const config = cspConfig[env];
  
  if (!config) {
    console.warn(`CSP configuration not found for environment: ${env}, using development config`);
    return cspConfig['development']!;
  }
  
  return config;
}