/**
 * 完整 16 種作物 (Lv 1-100),依 GDD §5.5 設計。
 *
 * 設計公式:
 * - XP ≈ floor(分鐘數^0.6)  → 對數成長,主動玩 XP/分 較高,長作物 XP/分 較低
 * - 售價 ≈ floor(XP² × 4 ~ 6)→ 指數成長,長作物金幣回報補償時間
 * - 結果:玩家可依「我有多少時間」自主選擇短/長作物
 *
 * 種田不消耗體力(體力留給未來戰鬥/組隊系統)。
 * 自然限制:5 個田 + 各作物生長時間 → 不需要額外的體力 gate。
 */

export interface Crop {
  /** 對應 Item.id(收成物)*/
  id: string;
  /** 對應 Item.id(種子)*/
  seedId: string;
  emoji: string;
  name: string;
  /** 生長秒數 */
  growSeconds: number;
  /** 解鎖此作物所需的農場技能等級 */
  unlockLevel: number;
  /** 收成獲得的農場技能 XP */
  xpReward: number;
  /** 賣給 NPC 商人的單價(銅幣);也用於初始化 Item.sell_price */
  sellPrice: number;
}

const HOUR = 60 * 60;

export const CROPS: Record<string, Crop> = {
  wheat: {
    id: 'wheat',
    seedId: 'wheat_seed',
    emoji: '🌾',
    name: '小麥',
    growSeconds: 5 * 60,
    unlockLevel: 1,
    xpReward: 5,
    sellPrice: 7,
  },
  carrot: {
    id: 'carrot',
    seedId: 'carrot_seed',
    emoji: '🥕',
    name: '胡蘿蔔',
    growSeconds: 15 * 60,
    unlockLevel: 3,
    xpReward: 8,
    sellPrice: 30,
  },
  potato: {
    id: 'potato',
    seedId: 'potato_seed',
    emoji: '🥔',
    name: '馬鈴薯',
    growSeconds: 30 * 60,
    unlockLevel: 5,
    xpReward: 12,
    sellPrice: 85,
  },
  tomato: {
    id: 'tomato',
    seedId: 'tomato_seed',
    emoji: '🍅',
    name: '番茄',
    growSeconds: 1 * HOUR,
    unlockLevel: 8,
    xpReward: 16,
    sellPrice: 240,
  },
  corn: {
    id: 'corn',
    seedId: 'corn_seed',
    emoji: '🌽',
    name: '玉米',
    growSeconds: 2 * HOUR,
    unlockLevel: 12,
    xpReward: 25,
    sellPrice: 650,
  },
  pumpkin: {
    id: 'pumpkin',
    seedId: 'pumpkin_seed',
    emoji: '🎃',
    name: '南瓜',
    growSeconds: 4 * HOUR,
    unlockLevel: 15,
    xpReward: 33,
    sellPrice: 1550,
  },
  chili: {
    id: 'chili',
    seedId: 'chili_seed',
    emoji: '🌶️',
    name: '辣椒',
    growSeconds: 6 * HOUR,
    unlockLevel: 20,
    xpReward: 39,
    sellPrice: 3000,
  },
  cotton: {
    id: 'cotton',
    seedId: 'cotton_seed',
    emoji: '🤍',
    name: '棉花',
    growSeconds: 8 * HOUR,
    unlockLevel: 25,
    xpReward: 51,
    sellPrice: 4850,
  },
  strawberry: {
    id: 'strawberry',
    seedId: 'strawberry_seed',
    emoji: '🍓',
    name: '草莓',
    growSeconds: 12 * HOUR,
    unlockLevel: 30,
    xpReward: 62,
    sellPrice: 8600,
  },
  grape: {
    id: 'grape',
    seedId: 'grape_seed',
    emoji: '🍇',
    name: '葡萄',
    growSeconds: 16 * HOUR,
    unlockLevel: 40,
    xpReward: 80,
    sellPrice: 15000,
  },
  watermelon: {
    id: 'watermelon',
    seedId: 'watermelon_seed',
    emoji: '🍉',
    name: '西瓜',
    growSeconds: 24 * HOUR,
    unlockLevel: 50,
    xpReward: 105,
    sellPrice: 27700,
  },
  tea: {
    id: 'tea',
    seedId: 'tea_seed',
    emoji: '🍵',
    name: '茶葉',
    growSeconds: 36 * HOUR,
    unlockLevel: 60,
    xpReward: 125,
    sellPrice: 49400,
  },
  apple: {
    id: 'apple',
    seedId: 'apple_seed',
    emoji: '🍎',
    name: '蘋果',
    growSeconds: 48 * HOUR,
    unlockLevel: 70,
    xpReward: 144,
    sellPrice: 76300,
  },
  winegrape: {
    id: 'winegrape',
    seedId: 'winegrape_seed',
    emoji: '🍷',
    name: '釀酒葡萄',
    growSeconds: 72 * HOUR,
    unlockLevel: 80,
    xpReward: 161,
    sellPrice: 130000,
  },
  herb: {
    id: 'herb',
    seedId: 'herb_seed',
    emoji: '🌿',
    name: '神祕藥草',
    growSeconds: 96 * HOUR,
    unlockLevel: 90,
    xpReward: 195,
    sellPrice: 195000,
  },
  goldwheat: {
    id: 'goldwheat',
    seedId: 'goldwheat_seed',
    emoji: '🌟',
    name: '黃金小麥',
    growSeconds: 144 * HOUR,
    unlockLevel: 100,
    xpReward: 254,
    sellPrice: 323000,
  },
};

export type CropId = keyof typeof CROPS;

/** 取得所有作物,依解鎖等級排序 */
export function allCropsByLevel(): Crop[] {
  return Object.values(CROPS).sort((a, b) => a.unlockLevel - b.unlockLevel);
}

/** 給定當前農場技能等級,回傳已解鎖的作物 */
export function unlockedCrops(farmingLevel: number): Crop[] {
  return allCropsByLevel().filter((c) => c.unlockLevel <= farmingLevel);
}

/** 給定當前等級,回傳下 N 個還沒解鎖的作物(預設 2 個,給玩家「下個目標」感)*/
export function nextLockedCrops(farmingLevel: number, count = 2): Crop[] {
  return allCropsByLevel()
    .filter((c) => c.unlockLevel > farmingLevel)
    .slice(0, count);
}

/** 純函式:給定種下時間與生長秒數,算出進度狀態 */
export function computeCropProgress(
  plantedAt: Date,
  growSeconds: number,
  now: Date = new Date(),
): { ready: boolean; progress: number; msUntilReady: number } {
  const elapsedMs = now.getTime() - plantedAt.getTime();
  const growMs = growSeconds * 1000;
  if (elapsedMs >= growMs) {
    return { ready: true, progress: 100, msUntilReady: 0 };
  }
  return {
    ready: false,
    progress: Math.min(99, Math.max(0, Math.floor((elapsedMs / growMs) * 100))),
    msUntilReady: growMs - elapsedMs,
  };
}
