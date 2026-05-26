import { prisma } from '@idletime/db';
import type { CharacterWithGuild } from './character.js';

/**
 * 體力恢復間隔 — 每 5 分鐘 +1 點。
 * 設計依據 GDD §3.2:預設 100 上限,8 小時離線可滿(50→100 需要 250 分鐘 = 4.2 小時)。
 */
export const ENERGY_REGEN_INTERVAL_MS = 5 * 60 * 1000;

export interface EnergyState {
  energy: number;
  energyMax: number;
  energyLastSettledAt: Date;
}

/**
 * 純函式:給定當前狀態與「現在」時間,回傳新的狀態。
 * 不寫 DB、不副作用。可被測試。
 *
 * 規則:
 * 1. 若已滿,timer 直接推進到 now(防止「滿了 2 小時再用掉一半,瞬間補滿」的 exploit)
 * 2. 經過時間不足一個 tick (5 min),不變
 * 3. 否則加 N 個 tick (capped at max),timer 推進「實際加的點數 × 5 分鐘」
 *    這樣未用完的剩餘秒數會 carry over 到下一次 settle
 */
export function settleFromState<T extends EnergyState>(state: T, now: Date): T {
  if (state.energy >= state.energyMax) {
    return { ...state, energyLastSettledAt: now };
  }

  const elapsedMs = now.getTime() - state.energyLastSettledAt.getTime();
  if (elapsedMs < ENERGY_REGEN_INTERVAL_MS) {
    return state;
  }

  const ticks = Math.floor(elapsedMs / ENERGY_REGEN_INTERVAL_MS);
  const newEnergy = Math.min(state.energyMax, state.energy + ticks);
  const actualTicks = newEnergy - state.energy;

  return {
    ...state,
    energy: newEnergy,
    energyLastSettledAt: new Date(
      state.energyLastSettledAt.getTime() + actualTicks * ENERGY_REGEN_INTERVAL_MS,
    ),
  };
}

/**
 * DB 包裝:抓 Character → 計算 → 寫回(若有變化)。回傳含 activeGuild 的最新狀態。
 * 任何「玩家動作」相關 command 都應該先呼叫這個,確保看到的數值是即時的。
 */
export async function settleEnergy(userId: string): Promise<CharacterWithGuild | null> {
  const character = await prisma.character.findUnique({
    where: { userId },
    include: { activeGuild: true },
  });
  if (!character) return null;

  const next = settleFromState(character, new Date());

  // 沒變化就不寫 DB,節省 updatedAt 跳動 + 寫入成本
  if (
    next.energy === character.energy &&
    next.energyLastSettledAt.getTime() === character.energyLastSettledAt.getTime()
  ) {
    return character;
  }

  return prisma.character.update({
    where: { userId },
    data: {
      energy: next.energy,
      energyLastSettledAt: next.energyLastSettledAt,
    },
    include: { activeGuild: true },
  });
}

/**
 * 嘗試消耗 amount 點體力。先 settle 再扣。
 * 回傳 { ok: true, character } 或 { ok: false, current } 不夠扣。
 */
export async function spendEnergy(
  userId: string,
  amount: number,
): Promise<
  | { ok: true; character: CharacterWithGuild }
  | { ok: false; current: CharacterWithGuild }
> {
  const settled = await settleEnergy(userId);
  if (!settled) throw new Error(`No character for user ${userId}`);

  if (settled.energy < amount) {
    return { ok: false, current: settled };
  }

  const after = await prisma.character.update({
    where: { userId },
    data: { energy: { decrement: amount } },
    include: { activeGuild: true },
  });

  return { ok: true, character: after };
}

/** 距離下一點體力恢復還剩多少毫秒(滿了回 0) */
export function msUntilNextEnergy(state: EnergyState, now: Date = new Date()): number {
  if (state.energy >= state.energyMax) return 0;
  const elapsedMs = now.getTime() - state.energyLastSettledAt.getTime();
  const remainder = elapsedMs % ENERGY_REGEN_INTERVAL_MS;
  return Math.max(0, ENERGY_REGEN_INTERVAL_MS - remainder);
}

/** Embed 用的體力顯示字串(含倒數) */
export function formatEnergyStatus(state: EnergyState): string {
  if (state.energy >= state.energyMax) {
    return `**${state.energy}** / ${state.energyMax}\n✨ 已滿`;
  }
  const minutesNext = Math.ceil(msUntilNextEnergy(state) / 60000);
  return `**${state.energy}** / ${state.energyMax}\n⏳ 下一點 ${minutesNext} 分`;
}
