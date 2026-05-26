import { PrismaClient } from '@prisma/client';

/**
 * Prisma client singleton。
 *
 * 注意:此檔不主動載入 .env;假設呼叫端已經把 DATABASE_URL 放進 process.env。
 * - bot 端透過 apps/bot/src/lib/env.ts 載入
 * - CLI 端透過 dotenv-cli 包裝 (見 package.json scripts)
 */

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// Re-export Prisma 型別,bot 端只 import @idletime/db 就夠
export * from '@prisma/client';
