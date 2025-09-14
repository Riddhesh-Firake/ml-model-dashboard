import { CSPConfig } from '../services/security/csp.middleware';

/**
 * Strict production CSP configuration
 * This configuration implements the most restrictive CSP policy possible
 * while maintaining application functionality
 */
export const strictProductionCSP: CSPConfig = {
  enabled: true,
  reportOnly: false,
  nonce: {
    enabled: true,
    length: 32, // Maximum security with longer nonce
    algorithm: 'base64'
  },
  directives: {
    // Default fallback - only same origin
    'default-src': ["'self'"],
    
    // Scripts: ONLY same-origin and nonce-based (NO unsafe-inline)
    'script-src': [
      "'self'"
      // Nonce will be added automatically by middleware
      // SECURITY: No 'unsafe-inline', 'unsafe-eval', or external scripts
    ],
    
    // Styles: ONLY same-origin and nonce-based (NO unsafe-inline)
    'style-src': [
      "'self'"
      // Nonce will be added automatically by middleware
      // SECURITY: No 'unsafe-inline' or external stylesheets
    ],
    
    // Images: Only same-origin and data URIs
    'img-src': [
      "'self'",
      'data:' // For base64 encoded images only
    ],
    
    // AJAX/WebSocket connections: Only same-origin
    'connect-src': [
      "'self'"
    ],
    
    // Fonts: Only same-origin and data URIs
    'font-src': [
      "'self'",
      'data:' // For base64 encoded fonts only
    ],
    
    // Block all plugins (Flash, Java, etc.)
    'object-src': ["'none'"],
    
    // Media: Only same-origin
    'media-src': ["'self'"],
    
    // Frames: Block all iframes
    'frame-src': ["'none'"],
    
    // Web Workers: Only same-origin
    'worker-src': ["'self'"],
    
    // Web App Manifest: Only same-origin
    'manifest-src': ["'self'"],
    
    // Base URI: Prevent base tag injection attacks
    'base-uri': ["'self'"],
    
    // Form actions: Only same-origin form submissions
    'form-action': ["'self'"],
    
    // Frame ancestors: Prevent clickjacking
    'frame-ancestors': ["'none'"],
    
    // Force HTTPS for all requests
    'upgrade-insecure-requests': [],
    
    // Block mixed content (HTTP resources on HTTPS pages)
    'block-all-mixed-content': [],
    
    // CSP violation reporting
    'report-uri': ['/api/csp-violations'],
    'report-to': ['csp-endpoint']
  }
};

/**
 * Relaxed production CSP for applications that need external resources
 * Use this only if the strict policy breaks essential functionality
 */
export const relaxedProductionCSP: CSPConfig = {
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
      // Still no 'unsafe-inline' - nonce required for all scripts
    ],
    'style-src': [
      "'self'",
      // Allow trusted external stylesheets if absolutely necessary
      'https://fonts.googleapis.com'
    ],
    'img-src': [
      "'self'",
      'data:',
      'https:' // Allow HTTPS images from any source
    ],
    'connect-src': [
      "'self'"
      // Add specific external APIs if needed
    ],
    'font-src': [
      "'self'",
      'https://fonts.gstatic.com', // Google Fonts
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
    'upgrade-insecure-requests': [],
    'report-uri': ['/api/csp-violations'],
    'report-to': ['csp-endpoint']
  }
};

/**
 * Get the appropriate production CSP configuration
 * @param strict - Whether to use the strictest possible policy
 */
export function getProductionCSPConfig(strict: boolean = true): CSPConfig {
  return strict ? strictProductionCSP : relaxedProductionCSP;
}

/**
 * Validate CSP configuration for production readiness
 * @param config - CSP configuration to validate
 * @returns Array of security warnings/issues
 */
export function validateProductionCSP(config: CSPConfig): string[] {
  const warnings: string[] = [];
  
  if (!config.enabled) {
    warnings.push('CSP is disabled - this is a security risk in production');
  }
  
  if (config.reportOnly) {
    warnings.push('CSP is in report-only mode - violations will not be blocked');
  }
  
  if (!config.nonce.enabled) {
    warnings.push('Nonce generation is disabled - inline scripts may be allowed');
  }
  
  if (config.nonce.length < 16) {
    warnings.push('Nonce length is too short - use at least 16 bytes for security');
  }
  
  // Check for unsafe directives
  const scriptSrc = config.directives['script-src'];
  if (scriptSrc.includes("'unsafe-inline'")) {
    warnings.push("script-src contains 'unsafe-inline' - this defeats CSP protection");
  }
  
  if (scriptSrc.includes("'unsafe-eval'")) {
    warnings.push("script-src contains 'unsafe-eval' - this allows dangerous eval() usage");
  }
  
  const styleSrc = config.directives['style-src'];
  if (styleSrc.includes("'unsafe-inline'")) {
    warnings.push("style-src contains 'unsafe-inline' - this allows inline styles");
  }
  
  // Check for overly permissive directives
  if (config.directives['object-src'].length > 0 && !config.directives['object-src'].includes("'none'")) {
    warnings.push("object-src should be set to 'none' to block plugins");
  }
  
  if (!config.directives['frame-ancestors'] || !config.directives['frame-ancestors'].includes("'none'")) {
    warnings.push("frame-ancestors should be set to 'none' to prevent clickjacking");
  }
  
  return warnings;
}