import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function required(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env: ${key}`);
  return v;
}

function int(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(key: string, fallback: boolean): boolean {
  const v = process.env[key]?.toLowerCase();
  if (v === undefined) return fallback;
  return v === '1' || v === 'true' || v === 'yes';
}

function csv(key: string, fallback: string[]): string[] {
  const v = process.env[key];
  if (!v) return fallback;
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isDev: process.env.NODE_ENV !== 'production',
  port: int('PORT', 4000),
  appName: process.env.APP_NAME || 'RetailOS',
  apiPrefix: process.env.API_PREFIX || '/api/v1',

  cors: {
    origins: csv('CORS_ORIGIN', ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000']),
    credentials: true,
  },

  db: {
    url: required('DATABASE_URL', 'file:./dev.db'),
  },

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me-32-chars-min'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me-32-chars'),
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL || '30d',
  },

  cookies: {
    refreshTokenName: process.env.REFRESH_TOKEN_COOKIE_NAME || 'retailos_rt',
    secure: bool('COOKIE_SECURE', false),
    sameSite: (process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none') || 'lax',
  },

  password: {
    hasher: (process.env.PASSWORD_HASHER as 'argon2' | 'bcrypt') || 'bcrypt',
    bcryptRounds: int('BCRYPT_ROUNDS', 12),
  },

  rateLimit: {
    windowMs: int('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    max: int('RATE_LIMIT_MAX', 300),
    authWindowMs: int('AUTH_RATE_LIMIT_WINDOW_MS', 60 * 1000),
    authMax: int('AUTH_RATE_LIMIT_MAX', 20),
  },

  tenant: {
    defaultCurrency: process.env.DEFAULT_CURRENCY || 'NGN',
    defaultCountry: process.env.DEFAULT_COUNTRY || 'NG',
    enableNegativeStock: bool('ENABLE_NEGATIVE_STOCK', false),
  },

  subscription: {
    defaultTrialDays: int('DEFAULT_TRIAL_DAYS', 14),
    defaultGracePeriodDays: int('DEFAULT_GRACE_PERIOD_DAYS', 7),
  },

  storage: {
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    maxUploadMb: int('MAX_UPLOAD_MB', 10),
  },

  redis: {
    url: process.env.REDIS_URL || '',
  },

  urls: {
    webapp: process.env.WEBAPP_BASE_URL || 'http://localhost:5173',
    admin: process.env.ADMIN_BASE_URL || 'http://localhost:5174',
    website: process.env.WEBSITE_BASE_URL || 'http://localhost:3000',
  },

  log: {
    level: process.env.LOG_LEVEL || 'info',
  },
} as const;

export type AppConfig = typeof config;
