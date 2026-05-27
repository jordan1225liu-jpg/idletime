import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AttachmentBuilder } from 'discord.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** apps/bot/assets —— 圖檔放這(由 scripts/generate-art.ts 生成)。 */
const ASSETS_DIR = resolve(__dirname, '..', '..', 'assets');

/** 探測順序;不在乎實際是 jpg 還是 png。 */
const EXTS = ['.jpg', '.png', '.jpeg', '.webp'];

/**
 * 公開 repo 的 raw 圖片網址前綴。用「網址」而非 attachment:// 的場合:
 * 例如 /hunt 戰鬥每回合都會重畫,用網址可避免反覆重傳附件 + 管理 attachments,
 * 且 Discord 會自行快取。圖片需先 push 到 main 才會生效(本來就會 commit)。
 * 若 repo 改名/改私有/換 branch,改這一行即可。
 */
const RAW_BASE = 'https://raw.githubusercontent.com/jordan1225liu-jpg/idletime/main/apps/bot/assets/';

export interface ImageRef {
  files: AttachmentBuilder[];
  url: string; // attachment://...,可丟給 embed.setImage / setThumbnail
}

/**
 * 傳入「不含副檔名」的基底路徑(如 'prologue'、'npcs/mayor'、'regions/forest'),
 * 自動探測 .jpg/.png/... 哪個存在。有就回傳可附加到 embed 的圖片參照,沒有回 null。
 *
 * 這讓「有圖就顯示、沒圖照舊」—— 美術還沒生成時所有指令照常運作。
 */
export function tryImage(baseNoExt: string): ImageRef | null {
  for (const ext of EXTS) {
    const rel = baseNoExt + ext;
    const full = resolve(ASSETS_DIR, rel);
    if (existsSync(full)) {
      const name = rel.replace(/[\\/]/g, '-'); // attachment 檔名不能有路徑分隔
      return { files: [new AttachmentBuilder(full, { name })], url: `attachment://${name}` };
    }
  }
  return null;
}

/**
 * 回傳資產的「公開網址」(若本地存在對應圖檔)。給不方便夾帶附件的場合用
 * (如 /hunt 每回合重畫的 embed)。本地不存在則回 null(graceful fallback)。
 */
export function assetUrl(baseNoExt: string): string | null {
  for (const ext of EXTS) {
    if (existsSync(resolve(ASSETS_DIR, baseNoExt + ext))) {
      return RAW_BASE + baseNoExt + ext;
    }
  }
  return null;
}
