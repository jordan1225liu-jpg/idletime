/**
 * 自動生成遊戲美術圖(Phase 1)。使用 Pollinations(Flux)免金鑰圖片 API,
 * 直接把圖片下載進 apps/bot/assets/。實際副檔名由回應 content-type 決定
 * (Pollinations 多半回 JPEG),embed 端用 lib/assets.ts 的 tryImage 自動探測,不在乎 jpg/png。
 *
 * 執行:pnpm --filter @idletime/bot gen:art               (只補缺的)
 *      pnpm --filter @idletime/bot gen:art --force        (全部重生)
 *      pnpm --filter @idletime/bot gen:art prologue npcs/mayor  (只生指定幾張)
 *
 * 風格統一靠 STYLE 後綴 + 固定 seed(可重現)。想換風格改 STYLE 即可。
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(__dirname, '..', 'assets'); // apps/bot/assets

const STYLE =
  'cozy storybook digital painting, warm medieval fantasy, soft painterly lighting, ' +
  'gentle saturated colors, highly detailed, no text, no watermark, no UI, no signature';

const BANNER = { w: 1280, h: 720 };
const PORTRAIT = { w: 768, h: 768 };
const PROBE_EXTS = ['.jpg', '.png', '.jpeg', '.webp'];

interface Spec {
  path: string; // 不含副檔名
  prompt: string;
  w: number;
  h: number;
  seed: number;
}

const SPECS: Spec[] = [
  {
    path: 'prologue',
    ...BANNER,
    seed: 101,
    prompt:
      'a lone hooded traveler standing before the ruins of a once-prosperous frontier village at dawn, ' +
      'crumbled stone walls, a single thin trail of chimney smoke rising, misty distant mountains, melancholic yet hopeful',
  },
  {
    path: 'town',
    ...BANNER,
    seed: 102,
    prompt:
      'a cozy rebuilt medieval frontier town square on a golden autumn afternoon, warm timber cottages, ' +
      'market stalls, hanging lanterns, villagers chatting, welcoming and lively',
  },
  {
    path: 'npcs/mayor',
    ...PORTRAIT,
    seed: 201,
    prompt:
      'character portrait of a kind but weary elderly town mayor, grey beard, warm brown cloak, ' +
      'gentle tired smile, medieval village background, head and shoulders',
  },
  {
    path: 'npcs/tom',
    ...PORTRAIT,
    seed: 202,
    prompt:
      'character portrait of a cheerful old farmer wearing a straw hat and suspenders, sun-tanned wrinkled face, ' +
      'holding a wooden hoe, green fields behind, head and shoulders',
  },
  {
    path: 'npcs/marina',
    ...PORTRAIT,
    seed: 203,
    prompt:
      'character portrait of a friendly young fisherwoman, wide-brim sun hat, apron, freckles, ' +
      'holding a fishing net by a calm river, head and shoulders',
  },
  {
    path: 'npcs/borin',
    ...PORTRAIT,
    seed: 204,
    prompt:
      'character portrait of a stout silent blacksmith, leather apron, soot-smudged muscular arms, thick beard, ' +
      'holding a hammer, glowing forge behind, head and shoulders',
  },
  {
    path: 'npcs/sage',
    ...PORTRAIT,
    seed: 205,
    prompt:
      'character portrait of a mysterious hooded alchemist, arcane robe, holding a glowing bubbling potion, ' +
      'shelves of herbs and vials, soft magical glow, head and shoulders',
  },
  {
    path: 'regions/plains',
    ...BANNER,
    seed: 301,
    prompt:
      'lush green rolling beginner plains under a bright blue sky, scattered wildflowers, gentle hills, ' +
      'a few sparse trees, peaceful sunny landscape',
  },
  {
    path: 'regions/forest',
    ...BANNER,
    seed: 302,
    prompt:
      'a dark mysterious ancient forest, towering twisted trees, thick drifting mist, pale shafts of light, eerie and quiet',
  },
  {
    path: 'regions/ruins',
    ...BANNER,
    seed: 303,
    prompt:
      'ancient crumbling stone ruins overgrown with green vines, toppled pillars, scattered rubble, ' +
      'mysterious overcast atmosphere',
  },
  {
    path: 'regions/dragonlair',
    ...BANNER,
    seed: 304,
    prompt:
      'a volcanic dragon lair deep in a dark cavern, rivers of glowing lava, jagged black rocks, ' +
      'ominous red glow, scattered golden treasure',
  },
  {
    path: 'regions/divine',
    ...BANNER,
    seed: 305,
    prompt:
      'a celestial divine realm above the clouds, floating islands, radiant golden light, marble temple, ' +
      'heavenly ethereal atmosphere',
  },
  // ─── Phase 2 — 生活活動場景橫幅 ───────────────────────────────
  {
    path: 'activities/farm',
    ...BANNER,
    seed: 401,
    prompt:
      'a cozy medieval farm in golden autumn, neat tilled rows of crops growing, a small wooden barn, ' +
      'split-rail fence, scarecrow, gentle rolling hills, warm sunlight',
  },
  {
    path: 'activities/fish',
    ...BANNER,
    seed: 402,
    prompt:
      'a peaceful medieval river bank with a wooden fishing dock, fishing rods leaning, lily pads, ' +
      'reeds, a small rowboat, sunset reflections',
  },
  {
    path: 'activities/brew',
    ...BANNER,
    seed: 403,
    prompt:
      "a cozy medieval alchemist's workshop interior, bubbling green cauldron, glass vials with colored potions, " +
      'shelves stuffed with herbs and roots, soft magical glow, warm candlelight',
  },
  {
    path: 'activities/shop',
    ...BANNER,
    seed: 404,
    prompt:
      "a cozy medieval blacksmith's shop interior, glowing red forge, anvil with a hammer, " +
      'walls hung with swords shields and armor, sparks, warm orange light',
  },
];

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));

function extFor(contentType: string | null): string {
  if (!contentType) return '.jpg';
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('webp')) return '.webp';
  return '.jpg';
}

async function genOne(s: Spec): Promise<boolean> {
  if (!force && PROBE_EXTS.some((e) => existsSync(resolve(ASSETS, s.path + e)))) {
    console.log(`  • skip (已存在) ${s.path}`);
    return true;
  }
  const prompt = `${s.prompt}, ${STYLE}`;
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${s.w}&height=${s.h}&nologo=true&model=flux&seed=${s.seed}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 150_000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 8000) throw new Error(`回傳太小 (${buf.length}b),可能是錯誤圖`);
      const out = resolve(ASSETS, s.path + extFor(res.headers.get('content-type')));
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, buf);
      console.log(`  ✓ ${s.path} (${(buf.length / 1024).toFixed(0)} KB)`);
      return true;
    } catch (e) {
      console.warn(`  … 重試 ${attempt}/3 ${s.path}:${e instanceof Error ? e.message : e}`);
      await new Promise((r) => setTimeout(r, 2500 * attempt));
    }
  }
  console.error(`  ✗ 失敗 ${s.path}`);
  return false;
}

async function main() {
  const todo = only.length > 0 ? SPECS.filter((s) => only.includes(s.path)) : SPECS;
  console.log(`🎨 生成 ${todo.length} 張圖 → ${ASSETS}${force ? ' (--force 重生)' : ''}`);
  let ok = 0;
  for (const s of todo) if (await genOne(s)) ok++; // 序列跑,避免被限流
  console.log(`\n完成:${ok}/${todo.length} 成功`);
  if (ok < todo.length) process.exitCode = 1;
}

void main();
