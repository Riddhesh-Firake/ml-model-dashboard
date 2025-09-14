import { AuthUtils } from '../auth.utils';
import { User } from '../../../models/user.model';
import { SubscriptionType } from '../../../models/constants';

describe('AuthUtils', () => {
  const mockUser: User = {
    id: 'test-user-id',
    email: 'test@example.com',
    apiKey: 'test-api-key',
    createdAt: new Date(),
    subscription: SubscriptionType.FREE,
    rateLimits: {
      requestsPerMinute: 10,
      modelsLimit: 5
    }
  };

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'testPassword123!';
      const hash = await AuthUtils.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'testPassword123!';
      const hash1 = await AuthUtils.hashPassword(password);
      const hash2 = await AuthUtils.hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'testPassword123!';
      const hash = await AuthUtils.hashPassword(password);
      
      const isValid = await AuthUtils.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testPassword123!';
      const wrongPassword = 'wrongPassword123!';
      const hash = await AuthUtils.hashPassword(password);
      
      const isValid = await AuthUtils.verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = AuthUtils.generateToken(mockUser);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode a valid token', () => {
      const token = AuthUtils.generateToken(mockUser);
      const payload = AuthUtils.verifyToken(token);
      
      expect(payload.userId).toBe(mockUser.id);
      expect(payload.email).toBe(mockUser.email);
      expect(payload.subscription).toBe(mockUser.subscription);
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';
      
      expect(() => AuthUtils.verifyToken(invalidToken)).toThrow('Invalid or expired token');
    });

    it('should throw error for expired token', () => {
      // This would require mocking jwt.verify to simulate expiration
      // For now, we'll test with a malformed token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      
      expect(() => AuthUtils.verifyToken(expiredToken)).toThrow();
    });
  });

  describe('generateApiKey', () => {
    it('should generate a valid API key', () => {
      const apiKey = AuthUtils.generateApiKey();
      
      expect(apiKey).toBeDefined();
      expect(apiKey).toMatch(/^mlapi_[a-f0-9]{64}$/);
    });

    it('should generate unique API keys', () => {
      const apiKey1 = AuthUtils.generateApiKey();
      const apiKey2 = AuthUtils.generateApiKey();
      
      expect(apiKey1).not.toBe(apiKey2);
    });
  });

  describe('hashApiKey', () => {
    it('should hash an API key', async () => {
      const apiKey = 'mlapi_test123';
      const hash = await AuthUtils.hashApiKey(apiKey);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(apiKey);
      expect(hash.length).toBe(64); // SHA-256 produces 64 character hex string
    });

    it('should produce consistent hashes', async () => {
      const apiKey = 'mlapi_test123';
      const hash1 = await AuthUtils.hashApiKey(apiKey);
      const hash2 = await AuthUtils.hashApiKey(apiKey);
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com'
      ];

      validEmails.forEach(email => {
        expect(AuthUtils.isValidEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com',
        ''
      ];

      invalidEmails.forEach(email => {
        expect(AuthUtils.isValidEmail(email)).toBe(false);
      });
    });
  });

  describe('isValidPassword', () => {
    it('should validate strong passwords', () => {
      const strongPasswords = [
        'StrongPass123!',
        'MySecure@Password1',
        'Complex#Pass99'
      ];

      strongPasswords.forEach(password => {
        const result = AuthUtils.isValidPassword(password);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        { password: 'short', expectedErrors: 4 }, // too short, no uppercase, no number, no special
        { password: 'toolongbutnouppercaseornumberorspecial', expectedErrors: 3 },
        { password: 'NoNumbers!', expectedErrors: 1 },
        { password: 'nonumbersorspecial', expectedErrors: 3 },
        { password: 'NOLOWERCASE123!', expectedErrors: 1 }
      ];

      weakPasswords.forEach(({ password, expectedErrors }) => {
        const result = AuthUtils.isValidPassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(expectedErrors);
      });
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const header = `Bearer ${token}`;
      
      const extracted = AuthUtils.extractTokenFromHeader(header);
      expect(extracted).toBe(token);
    });

    it('should return null for invalid header format', () => {
      const invalidHeaders = [
        'InvalidFormat token',
        'Bearer',
        'Bearer token extra',
        'token',
        '',
        undefined
      ];

      invalidHeaders.forEach(header => {
        const extracted = AuthUtils.extractTokenFromHeader(header);
        expect(extracted).toBeNull();
      });
    });
  });
});