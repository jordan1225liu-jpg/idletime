import 'dotenv/config';
import { z } from 'zod';

/**
 * 環境變數的型別與驗證
 * 啟動時自動檢查 .env 是否有缺漏,缺漏直接 crash 比執行中爆炸好
 */
const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_APPLICATION_ID: z.string().min(1, 'DISCORD_APPLICATION_ID is required'),
  DISCORD_DEV_GUILD_ID: z.string().optional(),
  DISCORD_OWNER_ID: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ 環境變數驗證失敗:');
  console.error(parseResult.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parseResult.data;
export const isDev = env.NODE_ENV === 'development';
