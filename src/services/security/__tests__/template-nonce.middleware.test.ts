import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { TemplateNonceMiddleware, TemplateNonceConfig } from '../template-nonce.middleware';
import { NonceService } from '../nonce.service';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('TemplateNonceMiddleware', () => {
  let middleware: TemplateNonceMiddleware;
  let nonceService: NonceService;
  let config: TemplateNonceConfig;
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

    // Setup config
    config = {
      templateDir: 'public',
      cacheEnabled: false,
      cacheTTL: 300000,
      noncePattern: /\{\{CSP_NONCE\}\}/g,
      styleNoncePattern: /\{\{CSP_STYLE_NONCE\}\}/g
    };

    middleware = new TemplateNonceMiddleware(nonceService, config);

    // Setup request/response mocks
    req = {
      path: '/',
      get: jest.fn()
    } as any;

    res = {
      locals: { cspNonce: 'test-nonce-123' },
      setHeader: jest.fn(),
      send: jest.fn()
    };

    next = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('middleware()', () => {
    it('should process HTML requests', () => {
      const mockTemplate = '<script src="app.js" nonce="{{CSP_NONCE}}"></script>';
      
      (req.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'Accept') return 'text/html,application/xhtml+xml';
        if (header === 'User-Agent') return 'Mozilla/5.0';
        return '';
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ mtime: new Date() } as any);
      mockFs.readFileSync.mockReturnValue(mockTemplate);

      const middlewareFn = middleware.middleware();
      middlewareFn(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
      expect(res.send).toHaveBeenCalledWith('<script src="app.js" nonce="test-nonce-123"></script>');
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass through non-HTML requests', () => {
      (req.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'Accept') return 'application/json';
        return '';
      });

      const middlewareFn = middleware.middleware();
      middlewareFn(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    });

    it('should handle file not found errors', () => {
      (req.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'Accept') return 'text/html';
        return '';
      });

      mockFs.existsSync.mockReturnValue(false);

      const middlewareFn = middleware.middleware();
      middlewareFn(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('nonce injection', () => {
    it('should inject nonces into script tags', () => {
      const template = '<script src="app.js" nonce="{{CSP_NONCE}}"></script>';
      const expected = '<script src="app.js" nonce="test-nonce-123"></script>';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ mtime: new Date() } as any);
      mockFs.readFileSync.mockReturnValue(template);

      (req.get as jest.Mock).mockReturnValue('text/html');

      const middlewareFn = middleware.middleware();
      middlewareFn(req as Request, res as Response, next);

      expect(res.send).toHaveBeenCalledWith(expected);
    });

    it('should inject nonces into style tags', () => {
      const template = '<style nonce="{{CSP_STYLE_NONCE}}">body { color: red; }</style>';
      const expected = '<style nonce="test-nonce-123">body { color: red; }</style>';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ mtime: new Date() } as any);
      mockFs.readFileSync.mockReturnValue(template);

      (req.get as jest.Mock).mockReturnValue('text/html');

      const middlewareFn = middleware.middleware();
      middlewareFn(req as Request, res as Response, next);

      expect(res.send).toHaveBeenCalledWith(expected);
    });

    it('should handle multiple nonce placeholders', () => {
      const template = `
        <script src="app.js" nonce="{{CSP_NONCE}}"></script>
        <script src="utils.js" nonce="{{CSP_NONCE}}"></script>
        <style nonce="{{CSP_STYLE_NONCE}}">body { margin: 0; }</style>
      `;
      
      const expected = `
        <script src="app.js" nonce="test-nonce-123"></script>
        <script src="utils.js" nonce="test-nonce-123"></script>
        <style nonce="test-nonce-123">body { margin: 0; }</style>
      `;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ mtime: new Date() } as any);
      mockFs.readFileSync.mockReturnValue(template);

      (req.get as jest.Mock).mockReturnValue('text/html');

      const middlewareFn = middleware.middleware();
      middlewareFn(req as Request, res as Response, next);

      expect(res.send).toHaveBeenCalledWith(expected);
    });

    it('should generate nonce if not provided in res.locals', () => {
      res.locals = {}; // No nonce provided
      
      const template = '<script src="app.js" nonce="{{CSP_NONCE}}"></script>';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ mtime: new Date() } as any);
      mockFs.readFileSync.mockReturnValue(template);

      (req.get as jest.Mock).mockReturnValue('text/html');

      const middlewareFn = middleware.middleware();
      middlewareFn(req as Request, res as Response, next);

      // Should have called send with some nonce (we can't predict the exact value)
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('nonce="'));
      expect(res.send).not.toHaveBeenCalledWith(expect.stringContaining('{{CSP_NONCE}}'));
    });
  });

  describe('path resolution', () => {
    it('should resolve root path to index.html', () => {
      (req as any).path = '/';
      
      const template = '<html><body>Home</body></html>';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ mtime: new Date() } as any);
      mockFs.readFileSync.mockReturnValue(template);

      (req.get as jest.Mock).mockReturnValue('text/html');

      const middlewareFn = middleware.middleware();
      middlewareFn(req as Request, res as Response, next);

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('index.html'),
        'utf-8'
      );
    });

    it('should resolve SPA routes to index.html', () => {
      (req as any).path = '/dashboard';
      
      const template = '<html><body>Dashboard</body></html>';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ mtime: new Date() } as any);
      mockFs.readFileSync.mockReturnValue(template);

      (req.get as jest.Mock).mockReturnValue('text/html');

      const middlewareFn = middleware.middleware();
      middlewareFn(req as Request, res as Response, next);

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('index.html'),
        'utf-8'
      );
    });

    it('should handle direct HTML file requests', () => {
      (req as any).path = '/about.html';
      
      const template = '<html><body>About</body></html>';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ mtime: new Date() } as any);
      mockFs.readFileSync.mockReturnValue(template);

      (req.get as jest.Mock).mockReturnValue('text/html');

      const middlewareFn = middleware.middleware();
      middlewareFn(req as Request, res as Response, next);

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('about.html'),
        'utf-8'
      );
    });
  });

  describe('caching', () => {
    beforeEach(() => {
      config.cacheEnabled = true;
      middleware = new TemplateNonceMiddleware(nonceService, config);
    });

    it('should cache templates when enabled', () => {
      const template = '<script src="app.js" nonce="{{CSP_NONCE}}"></script>';
      const mockStats = { mtime: new Date() };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue(mockStats as any);
      mockFs.readFileSync.mockReturnValue(template);

      (req.get as jest.Mock).mockReturnValue('text/html');

      const middlewareFn = middleware.middleware();
      
      // First request
      middlewareFn(req as Request, res as Response, next);
      
      // Second request
      middlewareFn(req as Request, res as Response, next);

      // Should only read file once due to caching
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache when file is modified', () => {
      const template = '<script src="app.js" nonce="{{CSP_NONCE}}"></script>';
      const oldStats = { mtime: new Date('2023-01-01') };
      const newStats = { mtime: new Date('2023-01-02') };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(template);

      (req.get as jest.Mock).mockReturnValue('text/html');

      const middlewareFn = middleware.middleware();
      
      // First request with old timestamp
      mockFs.statSync.mockReturnValue(oldStats as any);
      middlewareFn(req as Request, res as Response, next);
      
      // Second request with new timestamp
      mockFs.statSync.mockReturnValue(newStats as any);
      middlewareFn(req as Request, res as Response, next);

      // Should read file twice due to cache invalidation
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('utility methods', () => {
    it('should clear cache', () => {
      middleware.clearCache();
      const stats = middleware.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.entries).toEqual([]);
    });

    it('should update configuration', () => {
      const newConfig = { cacheEnabled: true, cacheTTL: 600000 };
      middleware.updateConfig(newConfig);
      
      const currentConfig = middleware.getConfig();
      expect(currentConfig.cacheEnabled).toBe(true);
      expect(currentConfig.cacheTTL).toBe(600000);
    });

    it('should clear cache when template directory changes', () => {
      // Add something to cache first
      const template = '<html></html>';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ mtime: new Date() } as any);
      mockFs.readFileSync.mockReturnValue(template);
      (req.get as jest.Mock).mockReturnValue('text/html');

      config.cacheEnabled = true;
      middleware = new TemplateNonceMiddleware(nonceService, config);
      
      const middlewareFn = middleware.middleware();
      middlewareFn(req as Request, res as Response, next);

      // Verify cache has content
      let stats = middleware.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);

      // Update template directory
      middleware.updateConfig({ templateDir: 'new-public' });

      // Cache should be cleared
      stats = middleware.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });
});