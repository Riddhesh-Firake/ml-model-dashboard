import * as crypto from 'crypto';

export interface NonceConfig {
  length: number;
  algorithm: 'base64' | 'hex';
  regenerateOnRequest: boolean;
}

export class NonceService {
  private config: NonceConfig;
  private cachedNonce?: string;
  private cacheTimestamp?: number;
  private readonly CACHE_TTL = 60000; // 1 minute cache TTL

  constructor(config: NonceConfig) {
    this.config = config;
  }

  /**
   * Generate a cryptographically secure nonce
   */
  public generateNonce(): string {
    const bytes = crypto.randomBytes(this.config.length);
    
    if (this.config.algorithm === 'hex') {
      return bytes.toString('hex');
    }
    
    return bytes.toString('base64').replace(/[+/=]/g, (match) => {
      switch (match) {
        case '+': return '-';
        case '/': return '_';
        case '=': return '';
        default: return match;
      }
    });
  }

  /**
   * Get nonce - either generate new one or return cached based on config
   */
  public getNonce(): string {
    if (this.config.regenerateOnRequest) {
      return this.generateNonce();
    }

    const now = Date.now();
    
    // Check if cached nonce is still valid
    if (this.cachedNonce && this.cacheTimestamp && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.cachedNonce;
    }

    // Generate new nonce and cache it
    this.cachedNonce = this.generateNonce();
    this.cacheTimestamp = now;
    
    return this.cachedNonce;
  }

  /**
   * Validate nonce format
   */
  public validateNonce(nonce: string): boolean {
    if (!nonce || typeof nonce !== 'string') {
      return false;
    }

    // Check length (base64 encoded length should be roughly 4/3 of byte length)
    const expectedLength = this.config.algorithm === 'base64' 
      ? Math.ceil(this.config.length * 4 / 3)
      : this.config.length * 2;

    if (Math.abs(nonce.length - expectedLength) > 2) {
      return false;
    }

    // Check character set
    if (this.config.algorithm === 'base64') {
      return /^[A-Za-z0-9\-_]*$/.test(nonce);
    } else {
      return /^[a-f0-9]*$/i.test(nonce);
    }
  }

  /**
   * Clear cached nonce
   */
  public clearCache(): void {
    this.cachedNonce = undefined;
    this.cacheTimestamp = undefined;
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<NonceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    // Clear cache when config changes
    this.clearCache();
  }

  /**
   * Get current configuration
   */
  public getConfig(): NonceConfig {
    return { ...this.config };
  }
}