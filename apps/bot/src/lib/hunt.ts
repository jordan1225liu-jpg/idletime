import { randomUUID } from 'node:crypto';
import { prisma } from '@idletime/db';
import { computeCombatStats } from './equipment.js';
import { settleEnergy } from './energy.js';
import { fightMonster, type CombatResult } from './combat.js';
import {
  REGION_BY_ID,
  sampleMonsters,
  type HuntRegion,
  type Monster,
} from './monsters.js';
import { addCharacterExp } from './character.js';
import { consumePotion, POTION_BY_ID } from './potions.js';

export const HUNT_ENERGY_COST = 5;
export const HUNT_MONSTER_COUNT = 10;
const SESSION_TTL_MS = 30 * 60 * 1000;

/** 人數越多,怪物越強(套用在 HP/ATK/DEF)。index = partySize - 1 */
export function difficultyMultiplier(partySize: number): number {
  return [1, 1.8, 2.5][partySize - 1] ?? 1;
}

/** 人數越多,總獎勵越高(之後再 ÷ 人數分給每人)。index = partySize - 1 */
export function rewardMultiplier(partySize: number): number {
  return [1, 2.2, 3.8][partySize - 1] ?? 1;
}

export interface HuntMember {
  userId: string;
  name: string;
}

export interface EncounterResult {
  monster: Monster;
  combat: CombatResult;
  killed: boolean;
}

export type HuntStatus = 'pending' | 'in_progress' | 'completed' | 'defeated';

export interface HuntSession {
  id: string;
  region: HuntRegion;
  leaderId: string;
  memberIds: string[];
  accepted: Set<string>;
  declinedBy: string | null;
  partySize: number;
  difficultyMult: number;
  rewardMult: number;
  // 戰鬥開始後填:
  members: HuntMember[];
  partyAttack: number;
  partyDefense: number;
  partyMaxHp: number;
  partyHp: number;
  monsters: Monster[];
  currentIndex: number;
  encounters: EncounterResult[];
  status: HuntStatus;
  createdAt: number;
}

const sessions = new Map<string, HuntSession>();

function sweep() {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.createdAt > SESSION_TTL_MS) sessions.delete(id);
  }
}

export function getSession(id: string): HuntSession | undefined {
  return sessions.get(id);
}

export function cancelHunt(id: string): void {
  sessions.delete(id);
}

export function createHuntSession(params: {
  leaderId: string;
  partnerIds: string[];
  regionId: string;
}): { ok: true; session: HuntSession } | { ok: false; reason: string } {
  sweep();
  const region = REGION_BY_ID[params.regionId];
  if (!region) return { ok: false, reason: '未知地區' };

  const memberIds = [params.leaderId, ...params.partnerIds];
  if (new Set(memberIds).size !== memberIds.length) {
    return { ok: false, reason: '隊員不能重複(包括你自己)' };
  }
  if (memberIds.length < 1 || memberIds.length > 3) {
    return { ok: false, reason: '隊伍人數必須 1-3 人' };
  }

  const partySize = memberIds.length;
  const session: HuntSession = {
    id: randomUUID().slice(0, 8),
    region,
    leaderId: params.leaderId,
    memberIds,
    accepted: new Set([params.leaderId]), // 發起人自動接受
    declinedBy: null,
    partySize,
    difficultyMult: difficultyMultiplier(partySize),
    rewardMult: rewardMultiplier(partySize),
    members: [],
    partyAttack: 0,
    partyDefense: 0,
    partyMaxHp: 0,
    partyHp: 0,
    monsters: [],
    currentIndex: 0,
    encounters: [],
    status: 'pending',
    createdAt: Date.now(),
  };
  sessions.set(session.id, session);
  return { ok: true, session };
}

export function acceptHunt(
  sessionId: string,
  userId: string,
): { ok: true; allAccepted: boolean; session: HuntSession } | { ok: false; reason: string } {
  const session = sessions.get(sessionId);
  if (!session) return { ok: false, reason: '找不到此狩獵(可能已過期)' };
  if (session.status !== 'pending') return { ok: false, reason: '這個狩獵已經開始或結束了' };
  if (!session.memberIds.includes(userId)) return { ok: false, reason: '你不在這個隊伍裡' };
  session.accepted.add(userId);
  return { ok: true, allAccepted: session.accepted.size === session.memberIds.length, session };
}

export function declineHunt(
  sessionId: string,
  userId: string,
): { ok: true; session: HuntSession } | { ok: false; reason: string } {
  const session = sessions.get(sessionId);
  if (!session) return { ok: false, reason: '找不到此狩獵' };
  if (!session.memberIds.includes(userId)) return { ok: false, reason: '你不在這個隊伍裡' };
  session.declinedBy = userId;
  session.status = 'completed'; // 標記結束(被拒絕)
  return { ok: true, session };
}

/** 全員接受後開始戰鬥:檢查+扣體力、算戰力、抽 10 隻怪、打第一隻 */
export async function startCombat(
  sessionId: string,
): Promise<{ ok: true; session: HuntSession } | { ok: false; reason: string }> {
  const session = sessions.get(sessionId);
  if (!session) return { ok: false, reason: '找不到此狩獵' };
  if (session.status !== 'pending') return { ok: false, reason: '已經開始了' };

  const members: HuntMember[] = [];
  let partyAttack = 0;
  let partyDefenseSum = 0;
  let partyMaxHp = 0;

  for (const userId of session.memberIds) {
    const settled = await settleEnergy(userId);
    if (!settled) return { ok: false, reason: '有隊員還沒建立角色' };
    if (settled.energy < HUNT_ENERGY_COST) {
      return { ok: false, reason: `**${settled.name}** 體力不足(需要 ${HUNT_ENERGY_COST},只有 ${settled.energy})` };
    }
    const stats = await computeCombatStats(userId);
    if (!stats) return { ok: false, reason: '無法計算戰力' };
    members.push({ userId, name: settled.name });
    partyAttack += stats.attack;
    partyDefenseSum += stats.defense;
    partyMaxHp += stats.maxHealth;
  }

  // 扣體力
  for (const userId of session.memberIds) {
    await prisma.character.update({
      where: { userId },
      data: { energy: { decrement: HUNT_ENERGY_COST } },
    });
  }

  session.members = members;
  session.partyAttack = partyAttack;
  session.partyDefense = Math.floor(partyDefenseSum / members.length);
  session.partyMaxHp = partyMaxHp;
  session.partyHp = partyMaxHp;

  // 抽 10 隻怪,依人數套用難度倍率(HP/ATK/DEF;XP/gold 保持基礎,獎勵倍率在結算時算)
  //
  // 重要:monsters.ts 的數值是以「3 人滿隊」設計的(party ATK = 三人總和)。
  // difficultyMultiplier 在 3 人時 = 2.5,所以這裡除以 2.5 作為基準:
  //   3 人 → 2.5/2.5 = ×1.0(原始設計數值)
  //   2 人 → 1.8/2.5 = ×0.72
  //   1 人 → 1.0/2.5 = ×0.4(solo 才打得動)
  // 顯示用的 difficultyMult(1/1.8/2.5)維持不變,代表「相對 solo 的怪物強度」。
  const MONSTER_TUNING_BASELINE = 2.5; // 怪物數值對應的滿難度(= 3 人)
  const mult = session.difficultyMult / MONSTER_TUNING_BASELINE;
  session.monsters = sampleMonsters(session.region, HUNT_MONSTER_COUNT).map((m) => ({
    ...m,
    hp: Math.round(m.hp * mult),
    attack: Math.round(m.attack * mult),
    defense: Math.round(m.defense * mult),
  }));
  session.status = 'in_progress';

  fightNext(session); // 打第一隻
  return { ok: true, session };
}

function fightNext(session: HuntSession): EncounterResult {
  const monster = session.monsters[session.currentIndex]!;
  const combat = fightMonster(session.partyAttack, session.partyDefense, session.partyHp, monster);
  session.partyHp = combat.partyHpAfter;
  const encounter: EncounterResult = { monster, combat, killed: combat.killed };
  session.encounters.push(encounter);
  session.currentIndex += 1;

  if (!combat.killed) {
    session.status = 'defeated';
  } else if (session.currentIndex >= session.monsters.length) {
    session.status = 'completed';
  }
  return encounter;
}

export function continueHunt(
  sessionId: string,
): { ok: true; encounter: EncounterResult; session: HuntSession } | { ok: false; reason: string } {
  const session = sessions.get(sessionId);
  if (!session) return { ok: false, reason: '找不到此狩獵' };
  if (session.status !== 'in_progress') return { ok: false, reason: '狩獵已結束' };
  const encounter = fightNext(session);
  return { ok: true, encounter, session };
}

export async function applyHeal(
  sessionId: string,
  userId: string,
  potionId: string,
): Promise<{ ok: true; healed: number; potionName: string; session: HuntSession } | { ok: false; reason: string }> {
  const session = sessions.get(sessionId);
  if (!session) return { ok: false, reason: '找不到此狩獵' };
  if (session.status !== 'in_progress') return { ok: false, reason: '狩獵已結束,不能補血' };
  if (!session.memberIds.includes(userId)) return { ok: false, reason: '你不在這個隊伍裡' };

  const recipe = POTION_BY_ID[potionId];
  if (!recipe) return { ok: false, reason: '未知藥水' };

  const consumed = await consumePotion(userId, potionId);
  if (!consumed) return { ok: false, reason: '你沒有這個藥水了' };

  const healAmount = Math.floor((session.partyMaxHp * recipe.healPercent) / 100);
  const before = session.partyHp;
  session.partyHp = Math.min(session.partyMaxHp, session.partyHp + healAmount);
  return { ok: true, healed: session.partyHp - before, potionName: recipe.name, session };
}

export interface HuntReward {
  killedCount: number;
  totalXp: number;
  totalGold: number;
  xpEach: number;
  goldEach: number;
  levelUps: { userId: string; name: string; newLevel: number }[];
}

/** 結算並把獎勵分給 3 人(XP→主等級, gold)。回傳獎勵摘要並清掉 session。 */
export async function finalizeHunt(sessionId: string): Promise<HuntReward | null> {
  const session = sessions.get(sessionId);
  if (!session) return null;

  const killed = session.encounters.filter((e) => e.killed);
  const baseXp = killed.reduce((s, e) => s + e.monster.xpReward, 0);
  const baseGold = killed.reduce((s, e) => s + e.monster.goldReward, 0);
  // 套用獎勵倍率(人數越多總量越高),再 ÷ 人數分給每人
  const totalXp = Math.floor(baseXp * session.rewardMult);
  const totalGold = Math.floor(baseGold * session.rewardMult);
  const xpEach = Math.floor(totalXp / session.partySize);
  const goldEach = Math.floor(totalGold / session.partySize);

  const levelUps: { userId: string; name: string; newLevel: number }[] = [];
  for (const member of session.members) {
    if (xpEach > 0) {
      const result = await addCharacterExp(member.userId, xpEach);
      if (result.levelsGained > 0) {
        levelUps.push({ userId: member.userId, name: member.name, newLevel: result.newLevel });
      }
    }
    if (goldEach > 0) {
      await prisma.character.update({
        where: { userId: member.userId },
        data: { gold: { increment: goldEach } },
      });
    }
  }

  sessions.delete(sessionId);
  return { killedCount: killed.length, totalXp, totalGold, xpEach, goldEach, levelUps };
}
