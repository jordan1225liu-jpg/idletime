import { prisma } from '@idletime/db';
import { FISHING_COOLDOWN_MS, rollFish, type CatchResult } from './fish.js';
import { addExp } from './leveling.js';
import { progressQuests } from './quests.js';

export type CastResult =
  | {
      ok: true;
      catch: CatchResult;
      xpGained: number;
      goldGained: number;
      oldLevel: number;
      newLevel: number;
      newExp: number;
      levelsGained: number;
      goldAfter: number;
    }
  | { ok: false; reason: 'cooldown'; msRemaining: number }
  | { ok: false; reason: 'no_character' };

/** 對 userId 釣一次魚。原子操作:check CD → roll → 寫入(XP/gold/CD timestamp)*/
export async function castFish(userId: string): Promise<CastResult> {
  const character = await prisma.character.findUnique({ where: { userId } });
  if (!character) return { ok: false, reason: 'no_character' };

  // CD 檢查
  if (character.lastFishingAt) {
    const elapsed = Date.now() - character.lastFishingAt.getTime();
    if (elapsed < FISHING_COOLDOWN_MS) {
      return { ok: false, reason: 'cooldown', msRemaining: FISHING_COOLDOWN_MS - elapsed };
    }
  }

  // 抓技能等級
  const skill = await prisma.playerSkill.findUnique({
    where: { userId_skillId: { userId, skillId: 'fishing' } },
  });
  if (!skill) {
    throw new Error(`PlayerSkill 'fishing' not found for user ${userId}`);
  }

  const result = rollFish(skill.level);
  const xpGained = result.tier.xpReward;
  const goldGained = result.tier.goldReward;

  const { level: newLevel, exp: newExp, levelsGained } = addExp(skill.level, skill.exp, xpGained);

  // 寫 DB(transaction 保證原子性)
  const updated = await prisma.$transaction(async (tx) => {
    if (xpGained > 0) {
      await tx.playerSkill.update({
        where: { userId_skillId: { userId, skillId: 'fishing' } },
        data: { level: newLevel, exp: newExp },
      });
    }

    return tx.character.update({
      where: { userId },
      data: {
        gold: goldGained > 0 ? { increment: goldGained } : undefined,
        lastFishingAt: new Date(),
      },
    });
  });

  await progressQuests(userId, 'fish', 1);

  return {
    ok: true,
    catch: result,
    xpGained,
    goldGained,
    oldLevel: skill.level,
    newLevel,
    newExp,
    levelsGained,
    goldAfter: updated.gold,
  };
}

/** 取得釣魚技能,沒有就回 Lv 1, 0 XP */
export async function getFishingSkill(userId: string): Promise<{ level: number; exp: number }> {
  const skill = await prisma.playerSkill.findUnique({
    where: { userId_skillId: { userId, skillId: 'fishing' } },
  });
  return skill ?? { level: 1, exp: 0 };
}
