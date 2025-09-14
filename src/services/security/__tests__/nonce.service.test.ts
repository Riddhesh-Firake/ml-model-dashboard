import { NonceService, NonceConfig } from '../nonce.service';

describe('NonceService', () => {
  let nonceService: NonceService;

  const testConfig: NonceConfig = {
    length: 16,
    algorithm: 'base64',
    regenerateOnRequest: true
  };

  beforeEach(() => {
    nonceService = new NonceService(testConfig);
  });

  describe('generateNonce', () => {
    it('should generate a base64 nonce of correct approximate length', () => {
      const nonce = nonceService.generateNonce();
      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBeGreaterThan(0);
      // Base64 encoded 16 bytes should be around 22 characters (without padding)
      expect(nonce.length).toBeGreaterThanOrEqual(20);
      expect(nonce.length).toBeLessThanOrEqual(25);
    });

    it('should generate hex nonce when algorithm is hex', () => {
      const hexConfig = { ...testConfig, algorithm: 'hex' as const };
      const hexService = new NonceService(hexConfig);
      const nonce = hexService.generateNonce();
      
      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBe(32); // 16 bytes * 2 hex chars per byte
      expect(/^[a-f0-9]+$/i.test(nonce)).toBe(true);
    });

    it('should generate different nonces on each call', () => {
      const nonce1 = nonceService.generateNonce();
      const nonce2 = nonceService.generateNonce();
      expect(nonce1).not.toBe(nonce2);
    });

    it('should generate URL-safe base64 nonces', () => {
      const nonce = nonceService.generateNonce();
      // Should not contain +, /, or = characters
      expect(nonce).not.toMatch(/[+/=]/);
      // Should only contain URL-safe characters
      expect(/^[A-Za-z0-9\-_]+$/.test(nonce)).toBe(true);
    });
  });

  describe('getNonce', () => {
    it('should generate new nonce when regenerateOnRequest is true', () => {
      const nonce1 = nonceService.getNonce();
      const nonce2 = nonceService.getNonce();
      expect(nonce1).not.toBe(nonce2);
    });

    it('should cache nonce when regenerateOnRequest is false', () => {
      const cachingConfig = { ...testConfig, regenerateOnRequest: false };
      const cachingService = new NonceService(cachingConfig);
      
      const nonce1 = cachingService.getNonce();
      const nonce2 = cachingService.getNonce();
      expect(nonce1).toBe(nonce2);
    });

    it('should regenerate cached nonce after TTL expires', (done) => {
      const cachingConfig = { ...testConfig, regenerateOnRequest: false };
      const cachingService = new NonceService(cachingConfig);
      
      // Mock the cache TTL to be very short for testing
      const originalTTL = (cachingService as any).CACHE_TTL;
      (cachingService as any).CACHE_TTL = 10; // 10ms
      
      const nonce1 = cachingService.getNonce();
      
      setTimeout(() => {
        const nonce2 = cachingService.getNonce();
        expect(nonce1).not.toBe(nonce2);
        
        // Restore original TTL
        (cachingService as any).CACHE_TTL = originalTTL;
        done();
      }, 15);
    });
  });

  describe('validateNonce', () => {
    it('should validate correct base64 nonce', () => {
      const nonce = nonceService.generateNonce();
      expect(nonceService.validateNonce(nonce)).toBe(true);
    });

    it('should validate correct hex nonce', () => {
      const hexConfig = { ...testConfig, algorithm: 'hex' as const };
      const hexService = new NonceService(hexConfig);
      const nonce = hexService.generateNonce();
      expect(hexService.validateNonce(nonce)).toBe(true);
    });

    it('should reject invalid nonce formats', () => {
      expect(nonceService.validateNonce('')).toBe(false);
      expect(nonceService.validateNonce('invalid!')).toBe(false);
      expect(nonceService.validateNonce('too+short')).toBe(false);
      expect(nonceService.validateNonce(null as any)).toBe(false);
      expect(nonceService.validateNonce(undefined as any)).toBe(false);
    });

    it('should reject nonces with wrong length', () => {
      expect(nonceService.validateNonce('short')).toBe(false);
      expect(nonceService.validateNonce('a'.repeat(100))).toBe(false);
    });

    it('should reject hex nonce with invalid characters for hex algorithm', () => {
      const hexConfig = { ...testConfig, algorithm: 'hex' as const };
      const hexService = new NonceService(hexConfig);
      expect(hexService.validateNonce('invalid-hex-chars!')).toBe(false);
      expect(hexService.validateNonce('GHIJKLMNOP')).toBe(false); // G-P are not hex
    });
  });

  describe('cache management', () => {
    it('should clear cache', () => {
      const cachingConfig = { ...testConfig, regenerateOnRequest: false };
      const cachingService = new NonceService(cachingConfig);
      
      const nonce1 = cachingService.getNonce();
      cachingService.clearCache();
      const nonce2 = cachingService.getNonce();
      
      expect(nonce1).not.toBe(nonce2);
    });

    it('should clear cache when config is updated', () => {
      const cachingConfig = { ...testConfig, regenerateOnRequest: false };
      const cachingService = new NonceService(cachingConfig);
      
      const nonce1 = cachingService.getNonce();
      cachingService.updateConfig({ length: 24 });
      const nonce2 = cachingService.getNonce();
      
      expect(nonce1).not.toBe(nonce2);
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const newConfig = { length: 24, algorithm: 'hex' as const };
      nonceService.updateConfig(newConfig);
      
      const config = nonceService.getConfig();
      expect(config.length).toBe(24);
      expect(config.algorithm).toBe('hex');
      expect(config.regenerateOnRequest).toBe(testConfig.regenerateOnRequest); // Should preserve
    });

    it('should return current configuration', () => {
      const config = nonceService.getConfig();
      expect(config).toEqual(testConfig);
      expect(config).not.toBe(testConfig); // Should be a copy
    });
  });
});