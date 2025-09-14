import { 
  strictProductionCSP, 
  relaxedProductionCSP, 
  getProductionCSPConfig, 
  validateProductionCSP 
} from '../production-csp.config';
import { CSPConfig } from '../../services/security/csp.middleware';

describe('Production CSP Configuration', () => {
  describe('strictProductionCSP', () => {
    it('should have CSP enabled', () => {
      expect(strictProductionCSP.enabled).toBe(true);
    });

    it('should not be in report-only mode', () => {
      expect(strictProductionCSP.reportOnly).toBe(false);
    });

    it('should have nonce enabled with secure length', () => {
      expect(strictProductionCSP.nonce.enabled).toBe(true);
      expect(strictProductionCSP.nonce.length).toBeGreaterThanOrEqual(32);
      expect(strictProductionCSP.nonce.algorithm).toBe('base64');
    });

    it('should have strict script-src policy', () => {
      const scriptSrc = strictProductionCSP.directives['script-src'];
      expect(scriptSrc).toEqual(["'self'"]);
      expect(scriptSrc).not.toContain("'unsafe-inline'");
      expect(scriptSrc).not.toContain("'unsafe-eval'");
    });

    it('should have strict style-src policy', () => {
      const styleSrc = strictProductionCSP.directives['style-src'];
      expect(styleSrc).toEqual(["'self'"]);
      expect(styleSrc).not.toContain("'unsafe-inline'");
    });

    it('should block all objects', () => {
      expect(strictProductionCSP.directives['object-src']).toEqual(["'none'"]);
    });

    it('should block all frames', () => {
      expect(strictProductionCSP.directives['frame-src']).toEqual(["'none'"]);
      expect(strictProductionCSP.directives['frame-ancestors']).toEqual(["'none'"]);
    });

    it('should have security directives', () => {
      expect(strictProductionCSP.directives['upgrade-insecure-requests']).toEqual([]);
      expect(strictProductionCSP.directives['block-all-mixed-content']).toEqual([]);
      expect(strictProductionCSP.directives['base-uri']).toEqual(["'self'"]);
      expect(strictProductionCSP.directives['form-action']).toEqual(["'self'"]);
    });

    it('should have violation reporting configured', () => {
      expect(strictProductionCSP.directives['report-uri']).toEqual(['/api/csp-violations']);
      expect(strictProductionCSP.directives['report-to']).toEqual(['csp-endpoint']);
    });
  });

  describe('relaxedProductionCSP', () => {
    it('should still be secure but allow some external resources', () => {
      expect(relaxedProductionCSP.enabled).toBe(true);
      expect(relaxedProductionCSP.reportOnly).toBe(false);
      
      // Should still not allow unsafe-inline
      const scriptSrc = relaxedProductionCSP.directives['script-src'];
      expect(scriptSrc).not.toContain("'unsafe-inline'");
      expect(scriptSrc).not.toContain("'unsafe-eval'");
    });

    it('should allow some external stylesheets', () => {
      const styleSrc = relaxedProductionCSP.directives['style-src'];
      expect(styleSrc).toContain('https://fonts.googleapis.com');
    });

    it('should allow HTTPS images', () => {
      const imgSrc = relaxedProductionCSP.directives['img-src'];
      expect(imgSrc).toContain('https:');
    });
  });

  describe('getProductionCSPConfig', () => {
    it('should return strict config by default', () => {
      const config = getProductionCSPConfig();
      expect(config).toEqual(strictProductionCSP);
    });

    it('should return strict config when explicitly requested', () => {
      const config = getProductionCSPConfig(true);
      expect(config).toEqual(strictProductionCSP);
    });

    it('should return relaxed config when requested', () => {
      const config = getProductionCSPConfig(false);
      expect(config).toEqual(relaxedProductionCSP);
    });
  });

  describe('validateProductionCSP', () => {
    it('should pass validation for strict production config', () => {
      const warnings = validateProductionCSP(strictProductionCSP);
      expect(warnings).toHaveLength(0);
    });

    it('should pass validation for relaxed production config', () => {
      const warnings = validateProductionCSP(relaxedProductionCSP);
      expect(warnings).toHaveLength(0);
    });

    it('should warn about disabled CSP', () => {
      const config: CSPConfig = {
        ...strictProductionCSP,
        enabled: false
      };
      const warnings = validateProductionCSP(config);
      expect(warnings).toContain('CSP is disabled - this is a security risk in production');
    });

    it('should warn about report-only mode', () => {
      const config: CSPConfig = {
        ...strictProductionCSP,
        reportOnly: true
      };
      const warnings = validateProductionCSP(config);
      expect(warnings).toContain('CSP is in report-only mode - violations will not be blocked');
    });

    it('should warn about unsafe-inline in script-src', () => {
      const config: CSPConfig = {
        ...strictProductionCSP,
        directives: {
          ...strictProductionCSP.directives,
          'script-src': ["'self'", "'unsafe-inline'"]
        }
      };
      const warnings = validateProductionCSP(config);
      expect(warnings).toContain("script-src contains 'unsafe-inline' - this defeats CSP protection");
    });

    it('should warn about unsafe-eval in script-src', () => {
      const config: CSPConfig = {
        ...strictProductionCSP,
        directives: {
          ...strictProductionCSP.directives,
          'script-src': ["'self'", "'unsafe-eval'"]
        }
      };
      const warnings = validateProductionCSP(config);
      expect(warnings).toContain("script-src contains 'unsafe-eval' - this allows dangerous eval() usage");
    });

    it('should warn about short nonce length', () => {
      const config: CSPConfig = {
        ...strictProductionCSP,
        nonce: {
          ...strictProductionCSP.nonce,
          length: 8
        }
      };
      const warnings = validateProductionCSP(config);
      expect(warnings).toContain('Nonce length is too short - use at least 16 bytes for security');
    });

    it('should warn about permissive object-src', () => {
      const config: CSPConfig = {
        ...strictProductionCSP,
        directives: {
          ...strictProductionCSP.directives,
          'object-src': ["'self'"]
        }
      };
      const warnings = validateProductionCSP(config);
      expect(warnings).toContain("object-src should be set to 'none' to block plugins");
    });
  });
});