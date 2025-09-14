import { TemplateNonceConfig } from '../services/security/template-nonce.middleware';

export const templateNonceConfig: Record<string, TemplateNonceConfig> = {
  development: {
    templateDir: 'public',
    cacheEnabled: false, // Disable cache in development for easier debugging
    cacheTTL: 0,
    noncePattern: /\{\{CSP_NONCE\}\}/g,
    styleNoncePattern: /\{\{CSP_STYLE_NONCE\}\}/g
  },

  test: {
    templateDir: 'public',
    cacheEnabled: false, // Disable cache in test environment
    cacheTTL: 0,
    noncePattern: /\{\{CSP_NONCE\}\}/g,
    styleNoncePattern: /\{\{CSP_STYLE_NONCE\}\}/g
  },

  production: {
    templateDir: 'public',
    cacheEnabled: true, // Enable cache in production for performance
    cacheTTL: 300000, // 5 minutes cache TTL
    noncePattern: /\{\{CSP_NONCE\}\}/g,
    styleNoncePattern: /\{\{CSP_STYLE_NONCE\}\}/g
  }
};

/**
 * Get template nonce configuration for current environment
 */
export function getTemplateNonceConfig(): TemplateNonceConfig {
  const env = process.env.NODE_ENV || 'development';
  const config = templateNonceConfig[env];
  
  if (!config) {
    console.warn(`Template nonce configuration not found for environment: ${env}, using development config`);
    return templateNonceConfig['development']!;
  }
  
  return config;
}