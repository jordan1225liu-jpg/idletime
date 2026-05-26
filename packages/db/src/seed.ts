/**
 * Seed 初始道具型錄。idempotent — 可重複跑。
 * 執行:pnpm --filter @idletime/db db:seed
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

const ITEMS: ItemSeed[] = [
  // ─── 種子 (seed) ─────────────────────────────────────────────
  {
    id: 'wheat_seed',
    name: '小麥種子',
    category: 'seed',
    emoji: '🌱',
    description: '15 分鐘成熟,新手必備',
    sellPrice: 0,
  },
  {
    id: 'carrot_seed',
    name: '胡蘿蔔種子',
    category: 'seed',
    emoji: '🌱',
    description: '45 分鐘成熟,需要 Lv 3 農場技能',
    sellPrice: 0,
  },
  {
    id: 'pumpkin_seed',
    name: '南瓜種子',
    category: 'seed',
    emoji: '🌱',
    description: '3 小時成熟,Lv 5 解鎖,高報酬',
    sellPrice: 0,
  },

  // ─── 作物 (crop) ─────────────────────────────────────────────
  {
    id: 'wheat',
    name: '小麥',
    category: 'crop',
    emoji: '🌾',
    description: '基礎農作物,可烘烤成麵包',
    sellPrice: 2,
  },
  {
    id: 'carrot',
    name: '胡蘿蔔',
    category: 'crop',
    emoji: '🥕',
    description: '營養蔬菜,可入菜',
    sellPrice: 8,
  },
  {
    id: 'pumpkin',
    name: '南瓜',
    category: 'crop',
    emoji: '🎃',
    description: '產量大的瓜類,萬聖節限定',
    sellPrice: 35,
  },
];

async function main() {
  console.log('🌱 開始 seed 道具型錄...');

  for (const item of ITEMS) {
    await prisma.item.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
    console.log(`  ✓ ${item.emoji} ${item.name} (${item.id})`);
  }

  const total = await prisma.item.count();
  console.log(`✅ Seed 完成,共 ${total} 個道具在型錄`);
}

main()
  .catch((e) => {
    console.error('❌ Seed 失敗:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
