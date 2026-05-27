/**
 * Seed 初始道具型錄。idempotent — 可重複跑。
 * 執行:pnpm --filter @idletime/db db:seed
 *
 * 16 種作物 × 2 (種子 + 作物本體) = 32 個道具。
 * 資料對應 apps/bot/src/lib/crops.ts(MVP 階段先複製,未來抽到 packages/shared)。
 */
import { prisma } from './index.js';

interface ItemSeed {
  id: string;
  name: string;
  category: string;
  emoji: string;
  description: string;
  sellPrice: number;
}

// ─── 種子 (32 個之半) ────────────────────────────────────────────
const SEEDS: ItemSeed[] = [
  { id: 'wheat_seed',      name: '小麥種子',     category: 'seed', emoji: '🌱', description: '15 分鐘成熟 · Lv 1', sellPrice: 0 },
  { id: 'carrot_seed',     name: '胡蘿蔔種子',   category: 'seed', emoji: '🌱', description: '30 分鐘成熟 · Lv 3', sellPrice: 0 },
  { id: 'potato_seed',     name: '馬鈴薯種子',   category: 'seed', emoji: '🌱', description: '1 小時成熟 · Lv 5', sellPrice: 0 },
  { id: 'tomato_seed',     name: '番茄種子',     category: 'seed', emoji: '🌱', description: '2 小時成熟 · Lv 8', sellPrice: 0 },
  { id: 'corn_seed',       name: '玉米種子',     category: 'seed', emoji: '🌱', description: '4 小時成熟 · Lv 12', sellPrice: 0 },
  { id: 'pumpkin_seed',    name: '南瓜種子',     category: 'seed', emoji: '🌱', description: '6 小時成熟 · Lv 15', sellPrice: 0 },
  { id: 'chili_seed',      name: '辣椒種子',     category: 'seed', emoji: '🌱', description: '8 小時成熟 · Lv 20', sellPrice: 0 },
  { id: 'cotton_seed',     name: '棉花種子',     category: 'seed', emoji: '🌱', description: '12 小時成熟 · Lv 25', sellPrice: 0 },
  { id: 'strawberry_seed', name: '草莓種子',     category: 'seed', emoji: '🌱', description: '16 小時成熟 · Lv 30', sellPrice: 0 },
  { id: 'grape_seed',      name: '葡萄種子',     category: 'seed', emoji: '🌱', description: '24 小時成熟 · Lv 40', sellPrice: 0 },
  { id: 'watermelon_seed', name: '西瓜種子',     category: 'seed', emoji: '🌱', description: '36 小時成熟 · Lv 50', sellPrice: 0 },
  { id: 'tea_seed',        name: '茶葉種子',     category: 'seed', emoji: '🌱', description: '48 小時成熟 · Lv 60', sellPrice: 0 },
  { id: 'apple_seed',      name: '蘋果種子',     category: 'seed', emoji: '🌱', description: '60 小時成熟 · Lv 70', sellPrice: 0 },
  { id: 'winegrape_seed',  name: '釀酒葡萄種子', category: 'seed', emoji: '🌱', description: '72 小時成熟 · Lv 80,釀酒用', sellPrice: 0 },
  { id: 'herb_seed',       name: '神祕藥草種子', category: 'seed', emoji: '🌱', description: '96 小時成熟 · Lv 90,藥水材料', sellPrice: 0 },
  { id: 'goldwheat_seed',  name: '黃金小麥種子', category: 'seed', emoji: '🌱', description: '144 小時 (6 天) 成熟 · Lv 100 神級作物', sellPrice: 0 },
];

// ─── 作物本體 (32 個之半) ─────────────────────────────────────────
const CROPS: ItemSeed[] = [
  { id: 'wheat',      name: '小麥',     category: 'crop', emoji: '🌾',  description: '基礎農作物,可烘烤成麵包',         sellPrice: 2 },
  { id: 'carrot',     name: '胡蘿蔔',   category: 'crop', emoji: '🥕',  description: '營養蔬菜,可入菜',                 sellPrice: 5 },
  { id: 'potato',     name: '馬鈴薯',   category: 'crop', emoji: '🥔',  description: '澱粉主食,多種料理基礎',           sellPrice: 12 },
  { id: 'tomato',     name: '番茄',     category: 'crop', emoji: '🍅',  description: '料理調味重要食材',                 sellPrice: 30 },
  { id: 'corn',       name: '玉米',     category: 'crop', emoji: '🌽',  description: '中期主力作物,產量高',             sellPrice: 75 },
  { id: 'pumpkin',    name: '南瓜',     category: 'crop', emoji: '🎃',  description: '萬聖節限定,瓜類主力',             sellPrice: 130 },
  { id: 'chili',      name: '辣椒',     category: 'crop', emoji: '🌶️', description: 'BUFF 料理必備辛香料',              sellPrice: 200 },
  { id: 'cotton',     name: '棉花',     category: 'crop', emoji: '🤍',  description: '裁縫主原料',                       sellPrice: 350 },
  { id: 'strawberry', name: '草莓',     category: 'crop', emoji: '🍓',  description: '高級水果,釀酒材料',               sellPrice: 550 },
  { id: 'grape',      name: '葡萄',     category: 'crop', emoji: '🍇',  description: '食用葡萄,釀酒可進階',             sellPrice: 1000 },
  { id: 'watermelon', name: '西瓜',     category: 'crop', emoji: '🍉',  description: '中期里程碑,大型水果',             sellPrice: 1800 },
  { id: 'tea',        name: '茶葉',     category: 'crop', emoji: '🍵',  description: '公會宴會專用,提升集合 BUFF',      sellPrice: 3000 },
  { id: 'apple',      name: '蘋果',     category: 'crop', emoji: '🍎',  description: '多年生果樹(收成後留樹)',         sellPrice: 4800 },
  { id: 'winegrape',  name: '釀酒葡萄', category: 'crop', emoji: '🍷',  description: '高級釀酒專用葡萄',                 sellPrice: 7500 },
  { id: 'herb',       name: '神祕藥草', category: 'crop', emoji: '🌿',  description: '稀有藥水材料,功效未明',           sellPrice: 13000 },
  { id: 'goldwheat',  name: '黃金小麥', category: 'crop', emoji: '🌟',  description: '農場 Lv 100 神級作物,極稀有',     sellPrice: 28000 },
];

// ─── 藥水(consumable;sellPrice 0 = 不可賣,只能用)──────────────
const POTIONS: ItemSeed[] = [
  { id: 'potion_minor',  name: '微量回血藥', category: 'consumable', emoji: '🧪', description: '戰鬥中回復 10% 最大生命', sellPrice: 0 },
  { id: 'potion_small',  name: '小型回血藥', category: 'consumable', emoji: '🧪', description: '戰鬥中回復 25% 最大生命', sellPrice: 0 },
  { id: 'potion_medium', name: '中型回血藥', category: 'consumable', emoji: '🧪', description: '戰鬥中回復 50% 最大生命', sellPrice: 0 },
  { id: 'potion_large',  name: '大型回血藥', category: 'consumable', emoji: '🧪', description: '戰鬥中回復 75% 最大生命', sellPrice: 0 },
  { id: 'potion_divine', name: '神級回血藥', category: 'consumable', emoji: '🧪', description: '戰鬥中回復 100% 最大生命', sellPrice: 0 },
];

async function main() {
  const all = [...SEEDS, ...CROPS, ...POTIONS];
  console.log(`🌱 開始 seed ${all.length} 個道具(${SEEDS.length} 種子 + ${CROPS.length} 作物 + ${POTIONS.length} 藥水)...`);

  for (const item of all) {
    await prisma.item.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }

  const total = await prisma.item.count();
  console.log(`✅ Seed 完成,DB 共 ${total} 個道具`);
}

main()
  .catch((e) => {
    console.error('❌ Seed 失敗:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
