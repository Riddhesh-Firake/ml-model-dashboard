import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

export interface CSPDirectives {
  'default-src': string[];
  'script-src': string[];
  'style-src': string[];
  'img-src': string[];
  'connect-src': string[];
  'font-src': string[];
  'object-src': string[];
  'media-src': string[];
  'frame-src': string[];
  'worker-src': string[];
  'manifest-src': string[];
  'base-uri'?: string[];
  'form-action'?: string[];
  'frame-ancestors'?: string[];
  'upgrade-insecure-requests'?: string[];
  'block-all-mixed-content'?: string[];
  'report-uri'?: string[];
  'report-to'?: string[];
}

export interface CSPConfig {
  enabled: boolean;
  reportOnly: boolean;
  directives: CSPDirectives;
  nonce: {
    enabled: boolean;
    length: number;
    algorithm: 'base64' | 'hex';
  };
}

export interface CSPViolationReport {
  'document-uri': string;
  referrer: string;
  'violated-directive': string;
  'effective-directive': string;
  'original-policy': string;
  disposition: 'enforce' | 'report';
  'blocked-uri': string;
  'line-number': number;
  'column-number': number;
  'source-file': string;
  'status-code': number;
  'script-sample': string;
}

export class CSPMiddleware {
  private config: CSPConfig;

  constructor(config: CSPConfig) {
    this.config = config;
  }

  /**
   * Generate a cryptographically secure nonce
   */
  public generateNonce(): string {
    const bytes = crypto.randomBytes(this.config.nonce.length);
    
    if (this.config.nonce.algorithm === 'hex') {
      return bytes.toString('hex');
    }
    
    return bytes.toString('base64');
  }

  /**
   * Build CSP header string from configuration
   */
  public buildCSPHeader(nonce?: string): string {
    const directives: string[] = [];

    Object.entries(this.config.directives).forEach(([directive, values]) => {
      // Handle directives that don't need values (like upgrade-insecure-requests)
      if (values !== undefined) {
        if (values.length === 0) {
          // Directive without values (e.g., upgrade-insecure-requests, block-all-mixed-content)
          directives.push(directive);
        } else {
          let directiveValues = [...values];
          
          // Add nonce to script-src and style-src if enabled
          if (nonce && this.config.nonce.enabled) {
            if (directive === 'script-src' || directive === 'style-src') {
              directiveValues.push(`'nonce-${nonce}'`);
            }
          }
          
          directives.push(`${directive} ${directiveValues.join(' ')}`);
        }
      }
    });

    return directives.join('; ');
  }

  /**
   * Express middleware for CSP header injection
   */
  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enabled) {
        return next();
      }

      let nonce: string | undefined;
      
      if (this.config.nonce.enabled) {
        nonce = this.generateNonce();
        // Store nonce in response locals for template access
        res.locals.cspNonce = nonce;
      }

      const cspHeader = this.buildCSPHeader(nonce);
      const headerName = this.config.reportOnly 
        ? 'Content-Security-Policy-Report-Only' 
        : 'Content-Security-Policy';

      res.setHeader(headerName, cspHeader);

      // Add Report-To header for modern browsers
      if (this.config.directives['report-to']) {
        const reportToConfig = this.buildReportToHeader();
        res.setHeader('Report-To', reportToConfig);
      }

      next();
    };
  }

  /**
   * Build Report-To header for modern browsers
   */
  public buildReportToHeader(): string {
    const reportToGroups = [
      {
        group: 'csp-endpoint',
        max_age: 86400, // 24 hours
        endpoints: [
          {
            url: '/api/csp-violations'
          }
        ],
        include_subdomains: true
      }
    ];

    return JSON.stringify(reportToGroups);
  }

  /**
   * Handle CSP violation reports
   */
  public handleViolationReport() {
    return (req: Request, res: Response) => {
      try {
        const report: CSPViolationReport = req.body;
        
        // Validate required fields
        if (!report || typeof report !== 'object') {
          res.status(400).json({ error: 'Invalid violation report format' });
          return;
        }

        if (!report['document-uri'] || !report['violated-directive']) {
          res.status(400).json({ error: 'Missing required violation report fields' });
          return;
        }
        
        // Log the violation
        console.warn('CSP Violation Report:', {
          timestamp: new Date().toISOString(),
          documentUri: report['document-uri'],
          violatedDirective: report['violated-directive'],
          blockedUri: report['blocked-uri'],
          sourceFile: report['source-file'],
          lineNumber: report['line-number'],
          columnNumber: report['column-number'],
          scriptSample: report['script-sample'],
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });

        // TODO: In production, you might want to store these in a database
        // or send to a monitoring service like Sentry

        res.status(204).send();
      } catch (error) {
        console.error('Error processing CSP violation report:', error);
        res.status(400).json({ error: 'Invalid violation report' });
      }
    };
  }

  /**
   * Update CSP configuration
   */
  public updateConfig(newConfig: Partial<CSPConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current CSP configuration
   */
  public getConfig(): CSPConfig {
    return { ...this.config };
  }
}