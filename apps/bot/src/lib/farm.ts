import { prisma } from '@idletime/db';
import { CROPS, computeCropProgress, type Crop } from './crops.js';
import { addExp } from './leveling.js';
import { progressQuests } from './quests.js';

export interface PlotState {
  plotIndex: number;
  status: 'empty' | 'growing' | 'ready';
  crop?: Crop;
  plantedAt?: Date;
  /** 0-100,只有 growing 時有意義 */
  progress?: number;
  /** 還剩多久成熟 (ms),只有 growing 時有意義 */
  msUntilReady?: number;
}

/**
 * 取得玩家所有田地的當前狀態(虛擬地計算 ready/growing,不寫 DB)。
 * 沒種過田的玩家,plot 紀錄是空的,直接用 Farm.plotCount 構造 "empty" 狀態。
 */
export async function getFarmState(userId: string): Promise<PlotState[]> {
  const farm = await prisma.farm.findUnique({ where: { userId } });
  if (!farm) {
    throw new Error(`No farm found for user ${userId}`);
  }

  const plots = await prisma.farmPlot.findMany({
    where: { userId },
    orderBy: { plotIndex: 'asc' },
  });

  const plotMap = new Map(plots.map((p) => [p.plotIndex, p]));
  const now = new Date();
  const result: PlotState[] = [];

  for (let i = 0; i < farm.plotCount; i++) {
    const plot = plotMap.get(i);

    if (!plot || !plot.cropType || !plot.plantedAt) {
      result.push({ plotIndex: i, status: 'empty' });
      continue;
    }

    const crop = CROPS[plot.cropType];
    if (!crop) {
      // 資料庫有未知作物 id(可能升級後 crop 被移除),當空田處理
      result.push({ plotIndex: i, status: 'empty' });
      continue;
    }

    const prog = computeCropProgress(plot.plantedAt, crop.growSeconds, now);
    if (prog.ready) {
      result.push({
        plotIndex: i,
        status: 'ready',
        crop,
        plantedAt: plot.plantedAt,
      });
    } else {
      result.push({
        plotIndex: i,
        status: 'growing',
        crop,
        plantedAt: plot.plantedAt,
        progress: prog.progress,
        msUntilReady: prog.msUntilReady,
      });
    }
  }

  return result;
}

export type PlantResult =
  | { ok: true; plotIndex: number; crop: Crop }
  | { ok: false; reason: string };

/** 種一個作物在第一個空田。會檢查等級、體力、空田。原子操作(spend energy 已有保護)。 */
export async function plantCrop(userId: string, cropId: string): Promise<PlantResult> {
  const crop = CROPS[cropId];
  if (!crop) return { ok: false, reason: '未知作物' };

  // 1. 檢查農場技能等級
  const skill = await prisma.playerSkill.findUnique({
    where: { userId_skillId: { userId, skillId: 'farming' } },
  });
  const farmingLevel = skill?.level ?? 1;
  if (farmingLevel < crop.unlockLevel) {
    return {
      ok: false,
      reason: `需要農場技能 Lv ${crop.unlockLevel} 才能種${crop.emoji}${crop.name}(你目前 Lv ${farmingLevel})`,
    };
  }

  // 2. 找第一個空田
  const state = await getFarmState(userId);
  const emptyPlot = state.find((p) => p.status === 'empty');
  if (!emptyPlot) {
    return { ok: false, reason: '沒有空田!請先收成' };
  }

  // 3. 種下(種田不消耗體力,設計簡化)
  await prisma.farmPlot.upsert({
    where: { userId_plotIndex: { userId, plotIndex: emptyPlot.plotIndex } },
    create: {
      userId,
      plotIndex: emptyPlot.plotIndex,
      cropType: cropId,
      plantedAt: new Date(),
    },
    update: {
      cropType: cropId,
      plantedAt: new Date(),
    },
  });

  return { ok: true, plotIndex: emptyPlot.plotIndex, crop };
}

export type PlantAllResult =
  | { ok: true; crop: Crop; planted: number }
  | { ok: false; reason: string };

/** 一鍵把選定作物種滿所有空田。檢查等級一次,然後 transaction 種下所有空田。 */
export async function plantCropAll(userId: string, cropId: string): Promise<PlantAllResult> {
  const crop = CROPS[cropId];
  if (!crop) return { ok: false, reason: '未知作物' };

  // 1. 檢查農場技能等級
  const skill = await prisma.playerSkill.findUnique({
    where: { userId_skillId: { userId, skillId: 'farming' } },
  });
  const farmingLevel = skill?.level ?? 1;
  if (farmingLevel < crop.unlockLevel) {
    return {
      ok: false,
      reason: `需要農場技能 Lv ${crop.unlockLevel} 才能種${crop.emoji}${crop.name}(你目前 Lv ${farmingLevel})`,
    };
  }

  // 2. 找所有空田
  const state = await getFarmState(userId);
  const emptyPlots = state.filter((p) => p.status === 'empty');
  if (emptyPlots.length === 0) {
    return { ok: false, reason: '沒有空田!請先收成' };
  }

  // 3. 一次種滿(同一個 plantedAt,讓它們同步成熟)
  const now = new Date();
  await prisma.$transaction(
    emptyPlots.map((plot) =>
      prisma.farmPlot.upsert({
        where: { userId_plotIndex: { userId, plotIndex: plot.plotIndex } },
        create: { userId, plotIndex: plot.plotIndex, cropType: cropId, plantedAt: now },
        update: { cropType: cropId, plantedAt: now },
      }),
    ),
  );

  return { ok: true, crop, planted: emptyPlots.length };
}

export interface HarvestResult {
  harvested: Array<{ crop: Crop; quantity: number }>;
  xpGained: number;
  oldLevel: number;
  newLevel: number;
  levelsGained: number;
}

/** 收成所有 ready 的田。回傳獲得的作物與 XP。 */
export async function harvestAll(userId: string): Promise<HarvestResult> {
  const state = await getFarmState(userId);
  const ready = state.filter((p) => p.status === 'ready');

  if (ready.length === 0) {
    return { harvested: [], xpGained: 0, oldLevel: 0, newLevel: 0, levelsGained: 0 };
  }

  const result = await prisma.$transaction(async (tx) => {
    // 取目前農場技能等級
    const skill = await tx.playerSkill.findUnique({
      where: { userId_skillId: { userId, skillId: 'farming' } },
    });
    if (!skill) throw new Error('PlayerSkill (farming) not found');

    // 聚合每種作物的數量,以及總 XP
    const harvestedMap = new Map<string, { crop: Crop; quantity: number }>();
    let xpGained = 0;

    for (const plot of ready) {
      const crop = plot.crop!;
      xpGained += crop.xpReward;

      const existing = harvestedMap.get(crop.id);
      if (existing) {
        existing.quantity += 1;
      } else {
        harvestedMap.set(crop.id, { crop, quantity: 1 });
      }

      // 加入背包(upsert)
      await tx.inventoryItem.upsert({
        where: { userId_itemId: { userId, itemId: crop.id } },
        create: { userId, itemId: crop.id, quantity: 1 },
        update: { quantity: { increment: 1 } },
      });

      // 清空該 plot
      await tx.farmPlot.update({
        where: { userId_plotIndex: { userId, plotIndex: plot.plotIndex } },
        data: { cropType: null, plantedAt: null },
      });
    }

    // 算新的等級
    const { level: newLevel, exp: newExp, levelsGained } = addExp(skill.level, skill.exp, xpGained);

    await tx.playerSkill.update({
      where: { userId_skillId: { userId, skillId: 'farming' } },
      data: { level: newLevel, exp: newExp },
    });

    return {
      harvested: Array.from(harvestedMap.values()),
      xpGained,
      oldLevel: skill.level,
      newLevel,
      levelsGained,
    };
  });

  // 每日任務:收成作物數(總量)
  const totalHarvested = result.harvested.reduce((s, h) => s + h.quantity, 0);
  await progressQuests(userId, 'farm', totalHarvested);

  return result;
}

/**
 * 剷除「生長中」的作物(種錯時立即移除,不給獎勵)。
 * 只清生長中的,**不動已成熟的**(那些應該收成,有價值)。回傳剷除了幾塊。
 */
export async function clearFarm(userId: string): Promise<number> {
  const state = await getFarmState(userId);
  const growing = state.filter((p) => p.status === 'growing');
  if (growing.length === 0) return 0;

  await prisma.$transaction(
    growing.map((p) =>
      prisma.farmPlot.update({
        where: { userId_plotIndex: { userId, plotIndex: p.plotIndex } },
        data: { cropType: null, plantedAt: null },
      }),
    ),
  );
  return growing.length;
}

/** 取得農場技能(若不存在預設 Lv 1, 0 XP) */
export async function getFarmingSkill(
  userId: string,
): Promise<{ level: number; exp: number }> {
  const skill = await prisma.playerSkill.findUnique({
    where: { userId_skillId: { userId, skillId: 'farming' } },
  });
  return skill ?? { level: 1, exp: 0 };
}

// ─── 擴充田地(購買新田) ────────────────────────────────────────

/** 初始田地數量(Farm schema 預設值,這裡作為購買起算的基準) */
export const INITIAL_PLOTS = 5;
/** 每升幾級可以多買一塊田 */
export const PLOT_LEVEL_STEP = 5;
/** 田地數量上限 = 5 初始 + 20 購買 = 25 塊。對應 Lv5..Lv100,每 5 級一塊。 */
export const MAX_PLOTS = INITIAL_PLOTS + 20;

/**
 * 每個 tier(T1=Lv1-10 ... T10=Lv91-100)購買 1 塊新田的金幣價格。
 * 每個 tier 涵蓋 2 塊田(例:T1 → Lv5、Lv10;T10 → Lv95、Lv100)。
 * 調整數字直接改這個陣列。
 */
export const PLOT_COSTS_BY_TIER: readonly number[] = [
  5_000,      // T1
  12_000,     // T2
  30_000,     // T3
  70_000,     // T4
  150_000,    // T5
  350_000,    // T6
  750_000,    // T7
  1_500_000,  // T8
  3_000_000,  // T9
  6_000_000,  // T10
];

/** 第 N 塊購買田地(N=1 對應第 6 塊)所需的玩家等級 */
export function plotRequiredLevel(purchaseIndex: number): number {
  return purchaseIndex * PLOT_LEVEL_STEP; // 1→5, 2→10, ..., 20→100
}

/** 第 N 塊購買田地的金幣價格(依據要求等級落在哪個 tier) */
export function plotPrice(purchaseIndex: number): number {
  const lvl = plotRequiredLevel(purchaseIndex);
  const tier = Math.min(PLOT_COSTS_BY_TIER.length, Math.max(1, Math.ceil(lvl / 10)));
  return PLOT_COSTS_BY_TIER[tier - 1]!;
}

export type PlotLockedReason = 'cap' | 'level' | 'gold';

export interface NextPlotInfo {
  /** 已購買的田地數(plotCount - INITIAL_PLOTS) */
  purchasesMade: number;
  /** 下一塊要買的編號(1-based)。null = 已達上限 */
  nextIndex: number | null;
  /** 下一塊在田地中的編號(=plotCount + 1)。null = 已達上限 */
  newPlotNumber: number | null;
  /** 下一塊要求的角色等級 */
  requiredLevel: number;
  /** 下一塊的金幣價格 */
  price: number;
  /** 為什麼還不能買 */
  lockedReason?: PlotLockedReason;
}

/** 純運算:給角色等級、金幣、目前田數,回傳「下一塊田」可否購買 + 條件 */
export function nextPlotInfo(charLevel: number, gold: number, plotCount: number): NextPlotInfo {
  const purchasesMade = Math.max(0, plotCount - INITIAL_PLOTS);
  if (plotCount >= MAX_PLOTS) {
    return {
      purchasesMade,
      nextIndex: null,
      newPlotNumber: null,
      requiredLevel: 0,
      price: 0,
      lockedReason: 'cap',
    };
  }
  const nextIndex = purchasesMade + 1;
  const requiredLevel = plotRequiredLevel(nextIndex);
  const price = plotPrice(nextIndex);
  let lockedReason: PlotLockedReason | undefined;
  if (charLevel < requiredLevel) lockedReason = 'level';
  else if (gold < price) lockedReason = 'gold';
  return {
    purchasesMade,
    nextIndex,
    newPlotNumber: plotCount + 1,
    requiredLevel,
    price,
    lockedReason,
  };
}

export type BuyPlotResult =
  | { ok: true; newPlotCount: number; goldAfter: number; price: number }
  | { ok: false; reason: string };

/**
 * 購買下一塊田地。整個檢查 + 扣錢 + 加田在同一個 transaction 裡,
 * 避免雙擊 / 並發造成「超扣 / 超買」。
 */
export async function buyPlot(userId: string): Promise<BuyPlotResult> {
  return prisma.$transaction(async (tx) => {
    const character = await tx.character.findUnique({ where: { userId } });
    if (!character) return { ok: false as const, reason: '你還沒建立角色,先用 `/start`' };
    const farm = await tx.farm.findUnique({ where: { userId } });
    if (!farm) return { ok: false as const, reason: '找不到你的農場' };
    if (farm.plotCount >= MAX_PLOTS) {
      return { ok: false as const, reason: `田地已達上限(${MAX_PLOTS} 塊)` };
    }
    const info = nextPlotInfo(character.level, character.gold, farm.plotCount);
    if (info.lockedReason === 'level') {
      return {
        ok: false as const,
        reason: `需要角色 Lv ${info.requiredLevel}(你 Lv ${character.level})`,
      };
    }
    if (info.lockedReason === 'gold') {
      return {
        ok: false as const,
        reason: `金幣不足:需要 ${info.price.toLocaleString()}💰(你 ${character.gold.toLocaleString()}💰)`,
      };
    }
    const newCharacter = await tx.character.update({
      where: { userId },
      data: { gold: { decrement: info.price } },
    });
    const newFarm = await tx.farm.update({
      where: { userId },
      data: { plotCount: { increment: 1 } },
    });
    return {
      ok: true as const,
      newPlotCount: newFarm.plotCount,
      goldAfter: newCharacter.gold,
      price: info.price,
    };
  });
}
