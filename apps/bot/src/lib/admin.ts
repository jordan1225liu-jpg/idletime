import { env } from './env.js';

/**
 * 遊戲管理員判定。目前以 .env 的 DISCORD_OWNER_ID 為唯一管理員(全域遊戲擁有者)。
 * 未設定 DISCORD_OWNER_ID 時一律回 false(沒人是 admin,管理指令全部擋下)。
 *
 * 注意:這是「遊戲層級」的權限,跟 Discord 伺服器的管理員權限無關 ——
 * 即使別的伺服器管理員看得到 /mailsend,也只有 owner 能真正送出。
 */
export function isAdmin(userId: string): boolean {
  return !!env.DISCORD_OWNER_ID && userId === env.DISCORD_OWNER_ID;
}
