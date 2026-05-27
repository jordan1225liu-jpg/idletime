import { prisma } from '@idletime/db';
import { grantEnergy } from './energy.js';
import type { CharacterWithGuild } from './character.js';

/** 每次接受拜訪雙方各得多少體力 */
export const VISIT_ENERGY_GAIN = 20;

/** per-pair 拜訪 CD:對同一位玩家 1 天(24 小時)只能拜訪 1 次 */
export const VISIT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** 邀請過期時間(發出後 30 分鐘沒人接就過期)*/
export const VISIT_EXPIRES_MS = 30 * 60 * 1000;

/**
 * 把兩個 user ID 排成 [small, large](lex 順序),用於以 pair 為主鍵的 query。
 * 純函式,可單獨測試。
 */
export function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export type VisitInitiateResult =
  | { ok: true; visitId: number }
  | { ok: false; reason: string };

/** 發起拜訪。檢查雙方都有角色、不是自己、不在 CD、沒 pending 邀請。 */
export async function initiateVisit(
  visitorId: string,
  visiteeId: string,
): Promise<VisitInitiateResult> {
  if (visitorId === visiteeId) {
    return { ok: false, reason: '你不能拜訪自己 😅' };
  }

  // 雙方都要有角色
  const visitor = await prisma.character.findUnique({ where: { userId: visitorId } });
  if (!visitor) {
    return { ok: false, reason: '你還沒建立角色,先用 /start' };
  }
  const visitee = await prisma.character.findUnique({ where: { userId: visiteeId } });
  if (!visitee) {
    return {
      ok: false,
      reason: '對方還沒開始玩 idletime,叫他先打 /start 建立角色',
    };
  }

  const [a, b] = canonicalPair(visitorId, visiteeId);

  // CD 檢查:最近 24 小時內有沒有跟這位玩家完成過拜訪(1 天 1 次)
  const cdThreshold = new Date(Date.now() - VISIT_COOLDOWN_MS);
  const recentAccepted = await prisma.visit.findFirst({
    where: {
      userIdA: a,
      userIdB: b,
      acceptedAt: { gte: cdThreshold },
    },
    orderBy: { acceptedAt: 'desc' },
  });

  if (recentAccepted && recentAccepted.acceptedAt) {
    const remainingMs = recentAccepted.acceptedAt.getTime() + VISIT_COOLDOWN_MS - Date.now();
    const hours = Math.floor(remainingMs / 3_600_000);
    const minutes = Math.ceil((remainingMs % 3_600_000) / 60_000);
    return {
      ok: false,
      reason: `你今天已經拜訪過這位玩家了,${hours} 小時 ${minutes} 分後可再拜訪(其他玩家不受影響)`,
    };
  }

  // pending 檢查:是否已有未過期的邀請
  const pending = await prisma.visit.findFirst({
    where: {
      userIdA: a,
      userIdB: b,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (pending) {
    return {
      ok: false,
      reason: '已有一個拜訪邀請正在等回應,先處理它',
    };
  }

  const visit = await prisma.visit.create({
    data: {
      userIdA: a,
      userIdB: b,
      initiatorId: visitorId,
      expiresAt: new Date(Date.now() + VISIT_EXPIRES_MS),
    },
  });

  return { ok: true, visitId: visit.id };
}

export type VisitAcceptResult =
  | {
      ok: true;
      visitor: CharacterWithGuild;
      visitee: CharacterWithGuild;
      visitorGain: number;
      visiteeGain: number;
    }
  | { ok: false; reason: string };

/** 接受拜訪。接受者必須是被邀請的一方,不能是發起人。 */
export async function acceptVisit(
  visitId: number,
  accepterId: string,
): Promise<VisitAcceptResult> {
  const visit = await prisma.visit.findUnique({ where: { id: visitId } });
  if (!visit) return { ok: false, reason: '找不到此拜訪' };
  if (visit.acceptedAt) return { ok: false, reason: '這個拜訪已經結束' };
  if (visit.expiresAt < new Date()) {
    return { ok: false, reason: '拜訪邀請已過期(超過 30 分鐘)' };
  }
  if (visit.initiatorId === accepterId) {
    return { ok: false, reason: '邀請發起人不能自己接受' };
  }
  if (visit.userIdA !== accepterId && visit.userIdB !== accepterId) {
    return { ok: false, reason: '只有被邀請者可以接受這次拜訪' };
  }

  // 標記為已接受
  await prisma.visit.update({
    where: { id: visitId },
    data: { acceptedAt: new Date() },
  });

  // 雙方各加體力(內部已 settle + cap at max)
  const initiatorResult = await grantEnergy(visit.initiatorId, VISIT_ENERGY_GAIN);
  const accepterResult = await grantEnergy(accepterId, VISIT_ENERGY_GAIN);

  return {
    ok: true,
    visitor: initiatorResult.character,
    visitee: accepterResult.character,
    visitorGain: initiatorResult.gained,
    visiteeGain: accepterResult.gained,
  };
}

/** 婉拒拜訪(或發起人取消自己的)。直接刪除記錄,因為沒接受 = 沒 CD。 */
export async function declineVisit(
  visitId: number,
  declinerId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const visit = await prisma.visit.findUnique({ where: { id: visitId } });
  if (!visit) return { ok: false, reason: '找不到此拜訪' };
  if (visit.acceptedAt) return { ok: false, reason: '這個拜訪已經結束' };
  // 邀請者可以取消自己的;被邀請者可以婉拒
  if (
    visit.userIdA !== declinerId &&
    visit.userIdB !== declinerId
  ) {
    return { ok: false, reason: '只有相關人士可以拒絕' };
  }
  await prisma.visit.delete({ where: { id: visitId } });
  return { ok: true };
}

/** 找出 (a, b) pair 的非發起人(用於 button click 權限檢查) */
export function getExpectedAccepter(
  userIdA: string,
  userIdB: string,
  initiatorId: string,
): string {
  return userIdA === initiatorId ? userIdB : userIdA;
}
