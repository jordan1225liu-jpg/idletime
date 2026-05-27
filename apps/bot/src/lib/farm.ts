import { prisma } from '@idletime/db';
import { CROPS, computeCropProgress, type Crop } from './crops.js';
import { addExp } from './leveling.js';

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

  return prisma.$transaction(async (tx) => {
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
