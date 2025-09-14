import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { NonceService } from './nonce.service';

export interface TemplateCache {
  content: string;
  lastModified: number;
  etag: string;
}

export interface TemplateNonceConfig {
  templateDir: string;
  cacheEnabled: boolean;
  cacheTTL: number; // in milliseconds
  noncePattern: RegExp;
  styleNoncePattern: RegExp;
}

export class TemplateNonceMiddleware {
  private nonceService: NonceService;
  private config: TemplateNonceConfig;
  private templateCache: Map<string, TemplateCache> = new Map();

  constructor(nonceService: NonceService, config: TemplateNonceConfig) {
    this.nonceService = nonceService;
    this.config = config;
  }

  /**
   * Express middleware for template nonce injection
   */
  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Only process HTML files
      if (!this.isHtmlRequest(req)) {
        return next();
      }

      const filePath = this.resolveFilePath(req.path);
      
      if (!filePath || !this.isTemplateFile(filePath)) {
        return next();
      }

      try {
        const processedContent = this.processTemplate(filePath, res.locals.cspNonce);
        
        // Set appropriate headers
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        res.send(processedContent);
      } catch (error) {
        console.error('Error processing template:', error);
        next(error);
      }
    };
  }

  /**
   * Process template file and inject nonces
   */
  private processTemplate(filePath: string, nonce?: string): string {
    const absolutePath = path.resolve(this.config.templateDir, filePath);
    
    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.getCachedTemplate(absolutePath);
      if (cached) {
        return this.injectNonces(cached.content, nonce);
      }
    }

    // Read template file
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Template file not found: ${absolutePath}`);
    }

    const stats = fs.statSync(absolutePath);
    const content = fs.readFileSync(absolutePath, 'utf-8');
    
    // Cache the template
    if (this.config.cacheEnabled) {
      this.cacheTemplate(absolutePath, content, stats.mtime.getTime());
    }

    return this.injectNonces(content, nonce);
  }

  /**
   * Inject nonces into template content
   */
  private injectNonces(content: string, nonce?: string): string {
    if (!nonce) {
      // Generate nonce if not provided
      nonce = this.nonceService.getNonce();
    }

    let processedContent = content;

    // Replace script nonce placeholders
    processedContent = processedContent.replace(
      this.config.noncePattern,
      nonce
    );

    // Replace style nonce placeholders
    processedContent = processedContent.replace(
      this.config.styleNoncePattern,
      nonce
    );

    return processedContent;
  }

  /**
   * Check if request is for HTML content
   */
  private isHtmlRequest(req: Request): boolean {
    // NEVER process API routes
    if (req.path.startsWith('/api/')) {
      return false;
    }
    
    const acceptHeader = req.get('Accept') || '';
    const userAgent = req.get('User-Agent') || '';
    
    // Check if it's a browser request for HTML
    return (
      acceptHeader.includes('text/html') ||
      acceptHeader.includes('*/*') ||
      userAgent.includes('Mozilla')
    );
  }

  /**
   * Resolve file path from request path
   */
  private resolveFilePath(requestPath: string): string {
    // Handle root path
    if (requestPath === '/' || requestPath === '') {
      return 'index.html';
    }

    // Handle paths without extension (SPA routes)
    if (!path.extname(requestPath)) {
      return 'index.html';
    }

    // Remove leading slash
    return requestPath.startsWith('/') ? requestPath.slice(1) : requestPath;
  }

  /**
   * Check if file is a template that needs processing
   */
  private isTemplateFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.html' || ext === '.htm';
  }

  /**
   * Get cached template if valid
   */
  private getCachedTemplate(absolutePath: string): TemplateCache | null {
    const cached = this.templateCache.get(absolutePath);
    
    if (!cached) {
      return null;
    }

    try {
      const stats = fs.statSync(absolutePath);
      const lastModified = stats.mtime.getTime();
      
      // Check if cache is still valid
      if (cached.lastModified >= lastModified) {
        const now = Date.now();
        const cacheAge = now - cached.lastModified;
        
        if (cacheAge < this.config.cacheTTL) {
          return cached;
        }
      }
    } catch (error) {
      // File might have been deleted, remove from cache
      this.templateCache.delete(absolutePath);
    }

    return null;
  }

  /**
   * Cache template content
   */
  private cacheTemplate(absolutePath: string, content: string, lastModified: number): void {
    const etag = this.generateETag(content);
    
    this.templateCache.set(absolutePath, {
      content,
      lastModified,
      etag
    });
  }

  /**
   * Generate ETag for content
   */
  private generateETag(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Clear template cache
   */
  public clearCache(): void {
    this.templateCache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.templateCache.size,
      entries: Array.from(this.templateCache.keys())
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<TemplateNonceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Clear cache if template directory changed
    if (newConfig.templateDir) {
      this.clearCache();
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): TemplateNonceConfig {
    return { ...this.config };
  }
}