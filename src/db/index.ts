import { PrismaClient } from '@prisma/client';
import { config } from '../config/index.js';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: config.isDev
      ? ['query', 'warn', 'error']
      : ['warn', 'error'],
  });

if (config.isDev) {
  global.__prisma = prisma;
}

export type Tx = Omit<
  PrismaClient,
  '$on' | '$connect' | '$disconnect' | '$use' | '$transaction' | '$extends'
>;
