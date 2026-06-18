// Centralised configuration — loads environment variables with strict requirements for JWT secrets.

import dotenv from 'dotenv';

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL CONFIG ERROR: JWT_SECRET is not defined in environment variables.');
}

if (!process.env.JWT_REFRESH_SECRET) {
  throw new Error('FATAL CONFIG ERROR: JWT_REFRESH_SECRET is not defined in environment variables.');
}

export const config = {
  /** Server port */
  port: parseInt(process.env.PORT || '3001', 10),

  /** Runtime environment */
  nodeEnv: process.env.NODE_ENV || 'development',

  /** Database connection string (Prisma) */
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',

  /** JWT signing secret for access tokens */
  jwtSecret: process.env.JWT_SECRET,

  /** JWT signing secret for refresh tokens */
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,

  /** Access token TTL */
  jwtExpiresIn: '1h',

  /** Refresh token TTL */
  jwtRefreshExpiresIn: '30d',

  /** CORS allowed origins (comma-separated in env) */
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],

  /** Maximum file-upload size in bytes (default 10 MB) */
  maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE || '10485760', 10),

  /** Upload directory */
  uploadDir: process.env.UPLOAD_DIR || 'uploads',

  /** Whether the app is running in production */
  isProduction: process.env.NODE_ENV === 'production',
} as const;

