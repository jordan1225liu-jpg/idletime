/**
 * 作物資料 — MVP 階段先 3 種,Phase 2 會依 GDD §5.5 路線圖擴充到 16 種。
 * 不放 DB:作物資料 = 遊戲設定,改動需要程式碼版本控制,不適合 runtime 寫入。
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
  /** 種植消耗體力 */
  energyCost: number;
  /** 解鎖此作物所需的農場技能等級 */
  unlockLevel: number;
  /** 收成獲得的農場技能 XP */
  xpReward: number;
}

export const CROPS: Record<string, Crop> = {
  wheat: {
    id: 'wheat',
    seedId: 'wheat_seed',
    emoji: '🌾',
    name: '小麥',
    growSeconds: 15 * 60,
    energyCost: 5,
    unlockLevel: 1,
    xpReward: 5,
  },
  carrot: {
    id: 'carrot',
    seedId: 'carrot_seed',
    emoji: '🥕',
    name: '胡蘿蔔',
    growSeconds: 45 * 60,
    energyCost: 5,
    unlockLevel: 3,
    xpReward: 15,
  },
  pumpkin: {
    id: 'pumpkin',
    seedId: 'pumpkin_seed',
    emoji: '🎃',
    name: '南瓜',
    growSeconds: 3 * 60 * 60,
    energyCost: 5,
    unlockLevel: 5,
    xpReward: 60,
  },
};

export type CropId = keyof typeof CROPS;

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
