/**
 * 生成全部 50 隻怪物圖 → apps/bot/assets/monsters/<id>.<ext>。
 * 跟 generate-art.ts 一樣用 Pollinations(Flux)免金鑰 API。怪物 id 直接讀
 * src/lib/monsters.ts 的 REGIONS,確保跟遊戲資料同步;每隻的視覺描述在 PROMPTS。
 *
 * 執行:pnpm --filter @idletime/bot gen:monsters            (只補缺的)
 *      pnpm --filter @idletime/bot gen:monsters --force     (全部重生)
 *      pnpm --filter @idletime/bot gen:monsters m_boar m_demonking  (只生指定幾隻)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGIONS } from '../src/lib/monsters.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(__dirname, '..', 'assets');
const PROBE_EXTS = ['.jpg', '.png', '.jpeg', '.webp'];

const STYLE =
  'storybook creature illustration, warm medieval fantasy, painterly, single full-body creature centered, ' +
  'simple soft background, dynamic, no text, no watermark, no UI, no signature';

/** 每隻怪的英文視覺描述(對應 monsters.ts 的 id)。 */
const PROMPTS: Record<string, string> = {
  // 新手平原
  m_fieldmouse: 'a small cute brown field mouse',
  m_hare: 'a wild brown hare',
  m_smallsnake: 'a small green grass snake',
  m_crow: 'a glossy black crow',
  m_raccoon: 'a curious raccoon',
  m_piglet: 'a baby wild boar piglet',
  m_scorpion: 'a desert scorpion, pincers raised',
  m_wolfpup: 'a fluffy grey wolf pup',
  m_viper: 'a coiled venomous viper, fangs bared',
  m_boar: 'a large fierce adult wild boar with sharp tusks',
  // 暗黑森林
  m_greywolf: 'a snarling grey wolf',
  m_eagle: 'a large eagle with wings spread',
  m_mountainboar: 'a big shaggy mountain boar',
  m_giantspider: 'a giant hairy forest spider',
  m_owl: 'a night owl with glowing yellow eyes',
  m_mushroom: 'a poisonous mushroom creature with a face, releasing spores',
  m_blackbear: 'a black bear standing on hind legs',
  m_treant: 'a treant, a walking tree monster with a wooden face',
  m_sandscorpion: 'a giant armored sand scorpion',
  m_python: 'a huge forest python coiled around a branch',
  // 古遺跡
  m_skeleton: 'a skeleton warrior holding a rusty sword and shield',
  m_zombie: 'a rotting green zombie shambling',
  m_giantbat: 'a giant bat with wings spread, fangs',
  m_skellarcher: 'a skeleton archer drawing a bow',
  m_ghost: 'a translucent pale floating ghost',
  m_swampcroc: 'a large swamp crocodile, jaws open',
  m_spiderqueen: 'a monstrous spider queen with a crown',
  m_vampire: 'a pale aristocratic vampire in a dark cloak, fangs',
  m_shadowmage: 'a hooded shadow mage casting purple dark magic',
  m_guardian: 'a giant ancient stone guardian statue with glowing runes',
  // 龍之巢穴
  m_younddragon: 'a small cute young dragon',
  m_nightmare: 'a demonic nightmare horse with a flaming mane',
  m_rhino: 'a giant armored rhinoceros charging',
  m_warbull: 'a massive armored war bull with iron horns',
  m_minotaur: 'a fierce minotaur wielding a great axe',
  m_seaserpent: 'a giant blue sea serpent rising from water',
  m_firedragon: 'a red fire dragon breathing flames',
  m_icedragon: 'a blue ice dragon wreathed in frost',
  m_winddragon: 'a green wind dragon amid swirling wind',
  m_dragonlord: 'a mighty majestic crowned dragon king',
  // 神之領域
  m_fallenangel: 'a fallen angel with dark tattered wings and a sword',
  m_demon: 'a fearsome red horned demon',
  m_lavagiant: 'a giant lava golem with molten glowing cracks',
  m_stormgiant: 'a colossal storm giant crackling with lightning',
  m_reaper: 'a hooded grim reaper holding a scythe',
  m_watcher: 'a cosmic many-eyed watcher entity, surreal',
  m_ancientdragon: 'an ancient colossal dragon king, epic',
  m_starguardian: 'a celestial guardian made of stars and constellations',
  m_thunderbeast: 'a divine thunder beast crackling with golden lightning',
  m_demonking: 'a towering crowned demon god king, menacing, epic',
};

const ALL = REGIONS.flatMap((r) => r.monsters);

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));

function extFor(ct: string | null): string {
  if (!ct) return '.jpg';
  if (ct.includes('png')) return '.png';
  if (ct.includes('webp')) return '.webp';
  return '.jpg';
}

async function genOne(id: string, prompt: string, seed: number): Promise<boolean> {
  const base = `monsters/${id}`;
  if (!force && PROBE_EXTS.some((e) => existsSync(resolve(ASSETS, base + e)))) {
    console.log(`  • skip (已存在) ${id}`);
    return true;
  }
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(`${prompt}, ${STYLE}`)}` +
    `?width=768&height=768&nologo=true&model=flux&seed=${seed}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 150_000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 8000) throw new Error(`回傳太小 (${buf.length}b)`);
      const out = resolve(ASSETS, base + extFor(res.headers.get('content-type')));
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, buf);
      console.log(`  ✓ ${id} (${(buf.length / 1024).toFixed(0)} KB)`);
      return true;
    } catch (e) {
      console.warn(`  … 重試 ${attempt}/3 ${id}:${e instanceof Error ? e.message : e}`);
      await new Promise((r) => setTimeout(r, 2500 * attempt));
    }
  }
  console.error(`  ✗ 失敗 ${id}`);
  return false;
}

async function main() {
  const todo = ALL.filter((m) => (only.length > 0 ? only.includes(m.id) : true));
  const missing = ALL.filter((m) => !PROMPTS[m.id]);
  if (missing.length > 0) {
    console.warn(`⚠️ 沒有 prompt 的怪:${missing.map((m) => m.id).join(', ')}`);
  }
  console.log(`👹 生成 ${todo.length} 隻怪物圖 → ${ASSETS}/monsters${force ? ' (--force)' : ''}`);
  let ok = 0;
  let seed = 400;
  for (const m of todo) {
    const prompt = PROMPTS[m.id];
    if (!prompt) {
      console.warn(`  ✗ 略過(無 prompt)${m.id}`);
      continue;
    }
    if (await genOne(m.id, prompt, seed++)) ok++;
  }
  console.log(`\n完成:${ok}/${todo.length} 成功`);
  if (ok < todo.length) process.exitCode = 1;
}

void main();
