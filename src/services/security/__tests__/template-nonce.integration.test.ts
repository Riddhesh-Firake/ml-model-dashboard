import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { TemplateNonceMiddleware } from '../template-nonce.middleware';
import { NonceService } from '../nonce.service';
import { getTemplateNonceConfig } from '../../../config/template-nonce.config';

describe('TemplateNonceMiddleware Integration', () => {
  let middleware: TemplateNonceMiddleware;
  let nonceService: NonceService;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    // Setup nonce service
    nonceService = new NonceService({
      length: 16,
      algorithm: 'base64',
      regenerateOnRequest: true
    });

    // Use actual config
    const config = getTemplateNonceConfig();
    middleware = new TemplateNonceMiddleware(nonceService, config);

    // Setup request/response mocks
    req = {
      path: '/',
      get: jest.fn()
    } as any;

    res = {
      locals: { cspNonce: 'test-nonce-abc123' },
      setHeader: jest.fn(),
      send: jest.fn()
    };

    next = jest.fn();

    // Mock HTML request
    (req.get as jest.Mock).mockImplementation((header: string) => {
      if (header === 'Accept') return 'text/html,application/xhtml+xml';
      if (header === 'User-Agent') return 'Mozilla/5.0';
      return '';
    });

    jest.clearAllMocks();
  });

  describe('Real HTML Template Processing', () => {
    it('should process the actual index.html template', () => {
      // Check if the actual template exists
      const templatePath = path.resolve('public', 'index.html');
      
      if (!fs.existsSync(templatePath)) {
        console.warn('Skipping integration test: public/index.html not found');
        return;
      }

      const middlewareFn = middleware.middleware();
      middlewareFn(req as Request, res as Response, next);

      // Verify response was sent
      expect(res.send).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();

      // Get the processed content
      const processedContent = (res.send as jest.Mock).mock.calls[0][0];

      // Verify nonces were injected
      expect(processedContent).toContain('nonce="test-nonce-abc123"');
      expect(processedContent).not.toContain('{{CSP_NONCE}}');

      // Verify all script tags have nonces
      const scriptMatches = processedContent.match(/<script[^>]*src="[^"]*"[^>]*>/g);
      if (scriptMatches) {
        scriptMatches.forEach((scriptTag: string) => {
          expect(scriptTag).toContain('nonce="test-nonce-abc123"');
        });
      }

      // Verify proper headers were set
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache, no-store, must-revalidate');
    });

    it('should handle SPA routes by serving index.html', () => {
      (req as any).path = '/dashboard';

      const templatePath = path.resolve('public', 'index.html');
      
      if (!fs.existsSync(templatePath)) {
        console.warn('Skipping integration test: public/index.html not found');
        return;
      }

      const middlewareFn = middleware.middleware();
      middlewareFn(req as Request, res as Response, next);

      expect(res.send).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();

      const processedContent = (res.send as jest.Mock).mock.calls[0][0];
      expect(processedContent).toContain('nonce="test-nonce-abc123"');
      expect(processedContent).toContain('ML Model Dashboard'); // Verify it's the right template
    });

    it('should generate nonce if not provided in res.locals', () => {
      res.locals = {}; // No nonce provided

      const templatePath = path.resolve('public', 'index.html');
      
      if (!fs.existsSync(templatePath)) {
        console.warn('Skipping integration test: public/index.html not found');
        return;
      }

      const middlewareFn = middleware.middleware();
      middlewareFn(req as Request, res as Response, next);

      expect(res.send).toHaveBeenCalled();

      const processedContent = (res.send as jest.Mock).mock.calls[0][0];
      
      // Should have some nonce (we can't predict the exact value)
      expect(processedContent).toMatch(/nonce="[A-Za-z0-9\-_]+"/);
      expect(processedContent).not.toContain('{{CSP_NONCE}}');
    });
  });

  describe('CSP Configuration Validation', () => {
    it('should verify external resources are properly configured', () => {
      const templatePath = path.resolve('public', 'index.html');
      
      if (!fs.existsSync(templatePath)) {
        console.warn('Skipping integration test: public/index.html not found');
        return;
      }

      const templateContent = fs.readFileSync(templatePath, 'utf-8');

      // Check for external stylesheets
      const externalStylesheets = templateContent.match(/href="https?:\/\/[^"]+"/g);
      if (externalStylesheets) {
        console.log('External stylesheets found:', externalStylesheets);
        
        // Verify Font Awesome CDN is used
        const fontAwesome = externalStylesheets.find(href => 
          href.includes('cdnjs.cloudflare.com') && href.includes('font-awesome')
        );
        expect(fontAwesome).toBeDefined();
      }

      // Verify no external scripts (all should be local)
      const externalScripts = templateContent.match(/<script[^>]*src="https?:\/\/[^"]+"/g);
      expect(externalScripts).toBeNull();

      // Verify all local scripts have nonce placeholders
      const localScripts = templateContent.match(/<script[^>]*src="[^"]*"[^>]*>/g);
      if (localScripts) {
        localScripts.forEach(scriptTag => {
          expect(scriptTag).toContain('{{CSP_NONCE}}');
        });
      }
    });
  });

  describe('Performance and Caching', () => {
    it('should cache templates in production mode', () => {
      // Update config to enable caching
      middleware.updateConfig({ cacheEnabled: true, cacheTTL: 300000 });

      const templatePath = path.resolve('public', 'index.html');
      
      if (!fs.existsSync(templatePath)) {
        console.warn('Skipping integration test: public/index.html not found');
        return;
      }

      const middlewareFn = middleware.middleware();
      
      // First request
      middlewareFn(req as Request, res as Response, next);
      
      // Clear mocks
      jest.clearAllMocks();
      
      // Second request
      middlewareFn(req as Request, res as Response, next);

      // Should still process successfully
      expect(res.send).toHaveBeenCalled();
      
      // Verify cache stats
      const cacheStats = middleware.getCacheStats();
      expect(cacheStats.size).toBeGreaterThan(0);
    });
  });
});