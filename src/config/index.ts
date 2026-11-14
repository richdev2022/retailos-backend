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
    // In production (NODE_ENV=production), default to Secure=true + SameSite=None
    // (required for cross-origin cookie sharing between Render subdomains).
    secure: bool('COOKIE_SECURE', process.env.NODE_ENV === 'production'),
    sameSite: (process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none') || (process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
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

  flutterwave: {
    /// Secret key (server-to-server). Required for charges + tokenization.
    secretKey: process.env.FLW_SECRET_KEY || '',
    /// Public key (client-side tokenization). Sent to the webapp for inline JS SDK.
    publicKey: process.env.FLW_PUBLIC_KEY || '',
    /// Encryption key (only needed for card encryption in v2; optional in v3).
    encryptionKey: process.env.FLW_ENCRYPTION_KEY || '',
    /// Base URL of the Flutterwave API.
    baseUrl: process.env.FLW_BASE_URL || 'https://api.flutterwave.com',
    /// Webhook secret hash header (`verif-hash`) — set this to verify webhook signatures.
    webhookHash: process.env.FLW_WEBHOOK_HASH || '',
    /// Title shown on the Flutterwave payment modal.
    title: process.env.FLW_TITLE || 'RetailOS Subscription',
    /// Logo URL shown on the Flutterwave payment modal.
    logoUrl: process.env.FLW_LOGO_URL || '',
    /// Whether Flutterwave is enabled. When false, charge endpoints return 503.
    enabled: bool('FLW_ENABLED', false),
  },

  email: {
    /// SMTP connection URL (e.g. smtps://user:pass@smtp.host.com:465).
    /// When empty, emails are logged but not actually sent.
    smtpUrl: process.env.SMTP_URL || '',
    /// From address.
    fromAddress: process.env.EMAIL_FROM || 'RetailOS <noreply@retailos.com>',
    /// From name.
    fromName: process.env.EMAIL_FROM_NAME || 'RetailOS',
    /// Reply-To address.
    replyTo: process.env.EMAIL_REPLY_TO || 'support@retailos.com',
    /// Whether SMTP is enabled. When false, emails are written to EmailLog with status=QUEUED
    /// and a debug log is emitted; otherwise they are sent via nodemailer.
    enabled: bool('EMAIL_ENABLED', false),
  },

  brevo: {
    /// Brevo (formerly Sendinblue) API key. Get from https://app.brevo.com/settings/keys/api
    apiKey: process.env.BREVO_API_KEY || '',
    /// API base URL.
    baseUrl: process.env.BREVO_BASE_URL || 'https://api.brevo.com/v3',
    /// Default sender email (must be a verified sender in your Brevo account).
    senderEmail: process.env.BREVO_SENDER_EMAIL || 'noreply@retailos.com',
    /// Default sender name.
    senderName: process.env.BREVO_SENDER_NAME || 'RetailOS',
    /// Default reply-to email.
    replyToEmail: process.env.BREVO_REPLY_TO || 'support@retailos.com',
    /// Brevo SMS sender name (must be a registered sender — typically your business name).
    smsSender: process.env.BREVO_SMS_SENDER || 'RetailOS',
    /// Whether Brevo is enabled. When false, emails are written to email_logs with
    /// status=QUEUED and a debug log is emitted (no real email is sent).
    /// When true, all transactional emails + SMS go through Brevo's REST API.
    enabled: bool('BREVO_ENABLED', false),
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
