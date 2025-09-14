// Mock winston before importing logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

jest.mock('winston', () => ({
  createLogger: jest.fn(() => mockLogger),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

jest.mock('winston-daily-rotate-file', () => {
  return jest.fn().mockImplementation(() => ({}));
});

import { logger, SecurityEvent } from '../logger.service';
import winston from 'winston';

describe('LoggerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic logging methods', () => {
    it('should log info messages with context', () => {
      const context = { userId: 'user123', requestId: 'req456' };
      logger.info('Test message', context);
      
      // Verify the underlying logger was called
      expect(mockLogger.info).toHaveBeenCalledWith('Test message', context);
    });

    it('should log error messages with error object and context', () => {
      const error = new Error('Test error');
      const context = { userId: 'user123' };
      
      logger.error('Error occurred', error, context);
      
      expect(mockLogger.error).toHaveBeenCalledWith('Error occurred', expect.objectContaining({
        error: expect.objectContaining({
          message: 'Test error',
          name: 'Error'
        }),
        userId: 'user123'
      }));
    });

    it('should log warning messages', () => {
      logger.warn('Warning message', { userId: 'user123' });
      expect(mockLogger.warn).toHaveBeenCalledWith('Warning message', { userId: 'user123' });
    });

    it('should log debug messages', () => {
      logger.debug('Debug message', { requestId: 'req123' });
      expect(mockLogger.debug).toHaveBeenCalledWith('Debug message', { requestId: 'req123' });
    });
  });

  describe('Audit logging', () => {
    it('should log audit events with proper structure', () => {
      const details = { action: 'model_upload', modelId: 'model123' };
      const context = { userId: 'user123' };
      
      // Test that the method doesn't throw
      expect(() => {
        logger.audit('MODEL_UPLOAD', details, context);
      }).not.toThrow();
    });
  });

  describe('Security logging', () => {
    it('should log security events with proper severity', () => {
      const securityEvent: SecurityEvent = {
        type: 'auth_failure',
        severity: 'high',
        userId: 'user123',
        ip: '192.168.1.1',
        details: { reason: 'invalid_password' }
      };
      
      logger.security(securityEvent);
      
      // Security events with high severity should also log to main logger
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Security Event: auth_failure',
        expect.objectContaining({
          type: 'auth_failure',
          severity: 'high',
          userId: 'user123',
          ip: '192.168.1.1'
        })
      );
    });

    it('should handle critical security events', () => {
      const securityEvent: SecurityEvent = {
        type: 'malicious_file',
        severity: 'critical',
        details: { filename: 'malware.exe' }
      };
      
      logger.security(securityEvent);
      
      // Critical events should log to main logger
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Security Event: malicious_file',
        expect.objectContaining({
          type: 'malicious_file',
          severity: 'critical'
        })
      );
    });
  });

  describe('Request logging', () => {
    it('should log HTTP requests with proper metrics', () => {
      const context = { userId: 'user123', requestId: 'req456' };
      
      logger.logRequest('POST', '/api/models/upload', 200, 1500, context);
      
      expect(mockLogger.info).toHaveBeenCalledWith('HTTP_REQUEST', expect.objectContaining({
        method: 'POST',
        url: '/api/models/upload',
        statusCode: 200,
        responseTime: 1500,
        userId: 'user123',
        requestId: 'req456'
      }));
    });
  });

  describe('Model operation logging', () => {
    it('should log model operations as audit events', () => {
      const context = { userId: 'user123' };
      
      expect(() => {
        logger.logModelOperation('upload', 'model123', true, { size: 1024 }, context);
      }).not.toThrow();
    });

    it('should log failed model operations', () => {
      const context = { userId: 'user123' };
      
      expect(() => {
        logger.logModelOperation('predict', 'model123', false, { error: 'Model not found' }, context);
      }).not.toThrow();
    });
  });

  describe('User operation logging', () => {
    it('should log user operations as audit events', () => {
      const context = { requestId: 'req123' };
      
      expect(() => {
        logger.logUserOperation('login', 'user123', true, { method: 'password' }, context);
      }).not.toThrow();
    });
  });

  describe('Performance logging', () => {
    it('should log performance metrics', () => {
      const context = { userId: 'user123' };
      const metadata = { modelSize: 1024, inputSize: 256 };
      
      logger.logPerformance('model_prediction', 2500, metadata, context);
      
      expect(mockLogger.info).toHaveBeenCalledWith('PERFORMANCE', expect.objectContaining({
        operation: 'model_prediction',
        duration: 2500,
        metadata,
        userId: 'user123'
      }));
    });
  });
});