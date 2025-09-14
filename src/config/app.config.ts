export interface AppConfig {
  port: number;
  host: string;
  nodeEnv: string;
  apiPrefix: string;
  corsOrigins: string[];
  jwtSecret: string;
  jwtExpiresIn: string;
  logLevel: string;
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };
  security: {
    enableHelmet: boolean;
    enableCors: boolean;
    trustProxy: boolean;
  };
}

export const appConfig: Record<string, AppConfig> = {
  development: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || 'localhost',
    nodeEnv: 'development',
    apiPrefix: '/api',
    corsOrigins: ['http://localhost:3000', 'http://localhost:3001'],
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-key',
    jwtExpiresIn: '24h',
    logLevel: process.env.LOG_LEVEL || 'debug',
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000,
      skipSuccessfulRequests: false,
    },
    security: {
      enableHelmet: true,
      enableCors: true,
      trustProxy: false,
    },
  },
  test: {
    port: parseInt(process.env.PORT || '3001'),
    host: process.env.HOST || 'localhost',
    nodeEnv: 'test',
    apiPrefix: '/api',
    corsOrigins: ['http://localhost:3001'],
    jwtSecret: 'test-secret-key',
    jwtExpiresIn: '1h',
    logLevel: 'error',
    rateLimiting: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100,
      skipSuccessfulRequests: true,
    },
    security: {
      enableHelmet: false,
      enableCors: true,
      trustProxy: false,
    },
  },
  production: {
    port: parseInt(process.env.PORT || '8080'),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: 'production',
    apiPrefix: '/api',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || [],
    jwtSecret: process.env.JWT_SECRET!,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    logLevel: process.env.LOG_LEVEL || 'info',
    rateLimiting: {
      windowMs: 15 * 60 * 1000,
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100'),
      skipSuccessfulRequests: true,
    },
    security: {
      enableHelmet: true,
      enableCors: true,
      trustProxy: true,
    },
  },
};