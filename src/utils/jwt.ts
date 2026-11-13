import jwt, { JwtPayload } from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface AccessTokenPayload extends JwtPayload {
  sub: string;       // user id
  email?: string;
  phone?: string;
  type: 'access';
  biz?: string;      // active business id (if chosen)
  branch?: string;   // active branch id (if chosen)
  scope?: 'business' | 'admin';
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  sid: string; // session id
  type: 'refresh';
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'type' | 'iat' | 'exp'>) {
  return jwt.sign({ ...payload, type: 'access' } as object, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTtl as any,
  });
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, 'type' | 'iat' | 'exp'>) {
  return jwt.sign({ ...payload, type: 'refresh' } as object, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshTtl as any,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, config.jwt.accessSecret);
  return decoded as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, config.jwt.refreshSecret);
  return decoded as RefreshTokenPayload;
}

export function getAccessTokenTtlSeconds(): number {
  const ttl = config.jwt.accessTtl;
  // Parse "15m" / "1h" / "60s"
  const m = /^(\d+)([smhd])$/.exec(ttl);
  if (!m) return 15 * 60;
  const n = Number(m[1]);
  const u = m[2];
  const factor = { s: 1, m: 60, h: 3600, d: 86400 }[u] || 60;
  return n * factor;
}
