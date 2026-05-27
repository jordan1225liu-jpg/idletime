import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AttachmentBuilder } from 'discord.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** apps/bot/assets —— 圖檔放這(由 scripts/generate-art.ts 生成)。 */
const ASSETS_DIR = resolve(__dirname, '..', '..', 'assets');

/** 探測順序;不在乎實際是 jpg 還是 png。 */
const EXTS = ['.jpg', '.png', '.jpeg', '.webp'];

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
