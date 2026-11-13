import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';

export async function hashPassword(plain: string): Promise<string> {
  if (config.password.hasher === 'argon2') {
    // Optional dependency; falls back to bcrypt if argon2 binary not available
    try {
      const argon2 = (await import('argon2')).default;
      return argon2.hash(plain, { type: argon2.argon2id });
    } catch {
      return bcrypt.hash(plain, config.password.bcryptRounds);
    }
  }
  return bcrypt.hash(plain, config.password.bcryptRounds);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (hash.startsWith('$argon2')) {
    try {
      const argon2 = (await import('argon2')).default;
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
  return bcrypt.compare(plain, hash);
}
