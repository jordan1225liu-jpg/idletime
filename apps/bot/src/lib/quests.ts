import { prisma, type DailyQuest } from '@idletime/db';
import { addCharacterExp } from './character.js';

export type QuestType = 'visit' | 'farm' | 'fish' | 'hunt';

export interface QuestDef {
  type: QuestType;
  label: string;
  emoji: string;
  /** 目標數量範圍 */
  min: number;
  max: number;
  /** 進度單位描述 */
  unit: string;
}

export const QUEST_DEFS: Record<QuestType, QuestDef> = {
  visit: { type: 'visit', label: '拜訪玩家', emoji: '🤝', min: 1, max: 5, unit: '次' },
  farm: { type: 'farm', label: '收成作物', emoji: '🌾', min: 1, max: 10, unit: '個' },
  fish: { type: 'fish', label: '釣魚', emoji: '🎣', min: 20, max: 100, unit: '次' },
  hunt: { type: 'hunt', label: '完成狩獵', emoji: '🏹', min: 3, max: 10, unit: '場' },
};

const QUEST_TYPES = Object.keys(QUEST_DEFS) as QuestType[];

/** 每天產生幾個任務(從 4 種隨機抽不重複)*/
export const QUESTS_PER_DAY = 3;

/** 獎勵範圍 */
const GOLD_MIN = 100;
const GOLD_MAX = 400;
const XP_MIN = 100;
const XP_MAX = 300;

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** UTC+8(台灣)的日期字串 YYYY-MM-DD,作為每日重置基準 */
export function todayStr(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + 8 * 3_600_000);
  return shifted.toISOString().slice(0, 10);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** 取得今天的任務;若還沒產生則隨機產生 QUESTS_PER_DAY 個(不重複類型)。 */
export async function getOrCreateDailyQuests(userId: string): Promise<DailyQuest[]> {
  const date = todayStr();
  const existing = await prisma.dailyQuest.findMany({
    where: { userId, questDate: date },
    orderBy: { id: 'asc' },
  });
  if (existing.length > 0) return existing;

  const types = shuffle(QUEST_TYPES).slice(0, QUESTS_PER_DAY);
  await prisma.dailyQuest.createMany({
    data: types.map((type) => {
      const def = QUEST_DEFS[type];
      return {
        userId,
        questDate: date,
        type,
        target: randInt(def.min, def.max),
        goldReward: randInt(GOLD_MIN, GOLD_MAX),
        xpReward: randInt(XP_MIN, XP_MAX),
      };
    }),
  });

  return prisma.dailyQuest.findMany({
    where: { userId, questDate: date },
    orderBy: { id: 'asc' },
  });
}

/**
 * 對某類型的今日任務累加進度(由 visit/farm/fish/hunt 動作呼叫)。
 * 會先確保今天的任務已產生(這樣動作即使在 /quests 之前做也能被計入)。
 */
export async function progressQuests(
  userId: string,
  type: QuestType,
  amount = 1,
): Promise<void> {
  await getOrCreateDailyQuests(userId);
  await prisma.dailyQuest.updateMany({
    where: { userId, questDate: todayStr(), type, claimed: false },
    data: { progress: { increment: amount } },
  });
}

export type ClaimResult =
  | { ok: true; gold: number; xp: number; levelsGained: number; newLevel: number }
  | { ok: false; reason: string };

/** 領取任務獎勵(progress 必須 >= target 且未領過)。 */
export async function claimQuest(userId: string, questId: number): Promise<ClaimResult> {
  const q = await prisma.dailyQuest.findUnique({ where: { id: questId } });
  if (!q || q.userId !== userId) return { ok: false, reason: '找不到這個任務' };
  if (q.claimed) return { ok: false, reason: '這個任務已經領過獎勵了' };
  if (q.progress < q.target) {
    return { ok: false, reason: `任務還沒完成(${q.progress}/${q.target})` };
  }

  await prisma.$transaction([
    prisma.dailyQuest.update({ where: { id: questId }, data: { claimed: true } }),
    prisma.character.update({
      where: { userId },
      data: { gold: { increment: q.goldReward } },
    }),
  ]);

  const xpResult = await addCharacterExp(userId, q.xpReward);

  return {
    ok: true,
    gold: q.goldReward,
    xp: q.xpReward,
    levelsGained: xpResult.levelsGained,
    newLevel: xpResult.newLevel,
  };
}
