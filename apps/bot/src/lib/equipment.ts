import { prisma } from '@idletime/db';

export type EquipSlot = 'weapon' | 'armor';

export interface Equipment {
  id: string;
  name: string;
  emoji: string;
  slot: EquipSlot;
  tier: number;
  attack: number; // 武器才有,護甲為 0
  defense: number; // 護甲才有,武器為 0
  price: number;
}

/**
 * 裝備型錄(不進 Item 表,獨立系統)。
 * 武俠/古典風命名,數值每 tier 約 2-3x,完全杜絕越級打怪。
 */
export const EQUIPMENT: Record<string, Equipment> = {
  // ─── 武器(加 ATK)──────────────────────────────────────
  weapon_wooden: { id: 'weapon_wooden', name: '木劍', emoji: '🗡️', slot: 'weapon', tier: 1, attack: 5, defense: 0, price: 200 },
  weapon_iron: { id: 'weapon_iron', name: '鐵劍', emoji: '🗡️', slot: 'weapon', tier: 2, attack: 15, defense: 0, price: 1_000 },
  weapon_darkiron: { id: 'weapon_darkiron', name: '玄鐵劍', emoji: '🗡️', slot: 'weapon', tier: 3, attack: 45, defense: 0, price: 5_000 },
  weapon_azure: { id: 'weapon_azure', name: '青鋒寶劍', emoji: '🗡️', slot: 'weapon', tier: 4, attack: 120, defense: 0, price: 25_000 },
  weapon_dragonspring: { id: 'weapon_dragonspring', name: '龍泉劍', emoji: '⚔️', slot: 'weapon', tier: 5, attack: 300, defense: 0, price: 100_000 },
  weapon_taia: { id: 'weapon_taia', name: '太阿神兵', emoji: '⚔️', slot: 'weapon', tier: 6, attack: 700, defense: 0, price: 400_000 },
  weapon_sevenstar: { id: 'weapon_sevenstar', name: '七星寶劍', emoji: '⚔️', slot: 'weapon', tier: 7, attack: 1_500, defense: 0, price: 1_500_000 },
  weapon_xuanyuan: { id: 'weapon_xuanyuan', name: '軒轅古劍', emoji: '⚔️', slot: 'weapon', tier: 8, attack: 3_000, defense: 0, price: 6_000_000 },
  weapon_dragonslayer: { id: 'weapon_dragonslayer', name: '屠龍寶刀', emoji: '⚔️', slot: 'weapon', tier: 9, attack: 5_500, defense: 0, price: 25_000_000 },
  weapon_yitian: { id: 'weapon_yitian', name: '倚天神劍', emoji: '✨', slot: 'weapon', tier: 10, attack: 10_000, defense: 0, price: 100_000_000 },

  // ─── 護甲(加 DEF)──────────────────────────────────────
  armor_cloth: { id: 'armor_cloth', name: '布衣', emoji: '🛡️', slot: 'armor', tier: 1, attack: 0, defense: 5, price: 200 },
  armor_leather: { id: 'armor_leather', name: '皮甲', emoji: '🛡️', slot: 'armor', tier: 2, attack: 0, defense: 15, price: 1_000 },
  armor_chainmail: { id: 'armor_chainmail', name: '鎖子甲', emoji: '🛡️', slot: 'armor', tier: 3, attack: 0, defense: 45, price: 5_000 },
  armor_iron: { id: 'armor_iron', name: '鐵鎧', emoji: '🛡️', slot: 'armor', tier: 4, attack: 0, defense: 120, price: 25_000 },
  armor_darkiron: { id: 'armor_darkiron', name: '玄鐵甲冑', emoji: '🛡️', slot: 'armor', tier: 5, attack: 0, defense: 300, price: 100_000 },
  armor_azuredragon: { id: 'armor_azuredragon', name: '青龍甲', emoji: '🟢', slot: 'armor', tier: 6, attack: 0, defense: 700, price: 400_000 },
  armor_vermilion: { id: 'armor_vermilion', name: '朱雀甲', emoji: '🔴', slot: 'armor', tier: 7, attack: 0, defense: 1_500, price: 1_500_000 },
  armor_whitetiger: { id: 'armor_whitetiger', name: '白虎甲', emoji: '⚪', slot: 'armor', tier: 8, attack: 0, defense: 3_000, price: 6_000_000 },
  armor_blacktortoise: { id: 'armor_blacktortoise', name: '玄武甲', emoji: '⚫', slot: 'armor', tier: 9, attack: 0, defense: 5_500, price: 25_000_000 },
  armor_divine: { id: 'armor_divine', name: '神兵聖甲', emoji: '✨', slot: 'armor', tier: 10, attack: 0, defense: 10_000, price: 100_000_000 },
};

/** maxHealth 由角色等級決定:100 + level×30(Lv 1=130, Lv 100=3100)*/
export function maxHealth(level: number): number {
  return 100 + level * 30;
}

/** 取得某 slot 的所有裝備,依 tier 排序 */
export function equipmentBySlot(slot: EquipSlot): Equipment[] {
  return Object.values(EQUIPMENT)
    .filter((e) => e.slot === slot)
    .sort((a, b) => a.tier - b.tier);
}

/** 玩家擁有的裝備 id 集合 */
export async function getOwnedEquipmentIds(userId: string): Promise<Set<string>> {
  const owned = await prisma.playerEquipment.findMany({
    where: { userId },
    select: { itemId: true },
  });
  return new Set(owned.map((o) => o.itemId));
}

/** 玩家目前裝備的武器/護甲 */
export async function getEquipped(
  userId: string,
): Promise<{ weapon: Equipment | null; armor: Equipment | null }> {
  const equipped = await prisma.playerEquipment.findMany({
    where: { userId, equipped: true },
  });
  let weapon: Equipment | null = null;
  let armor: Equipment | null = null;
  for (const e of equipped) {
    const eq = EQUIPMENT[e.itemId];
    if (!eq) continue;
    if (eq.slot === 'weapon') weapon = eq;
    else if (eq.slot === 'armor') armor = eq;
  }
  return { weapon, armor };
}

export interface CombatStats {
  attack: number;
  defense: number;
  maxHealth: number;
  level: number;
  weapon: Equipment | null;
  armor: Equipment | null;
}

/** 算出玩家當前總戰力(base + 已裝備)*/
export async function computeCombatStats(userId: string): Promise<CombatStats | null> {
  const character = await prisma.character.findUnique({ where: { userId } });
  if (!character) return null;
  const { weapon, armor } = await getEquipped(userId);
  return {
    attack: character.baseAttack + (weapon?.attack ?? 0),
    defense: character.baseDefense + (armor?.defense ?? 0),
    maxHealth: maxHealth(character.level),
    level: character.level,
    weapon,
    armor,
  };
}

export type BuyResult =
  | { ok: true; equipment: Equipment; goldAfter: number; autoEquipped: boolean }
  | { ok: false; reason: string };

/** 買裝備。沒裝備在該 slot 的話自動裝上。 */
export async function buyEquipment(userId: string, equipmentId: string): Promise<BuyResult> {
  const eq = EQUIPMENT[equipmentId];
  if (!eq) return { ok: false, reason: '找不到這件裝備' };

  const existing = await prisma.playerEquipment.findUnique({
    where: { userId_itemId: { userId, itemId: equipmentId } },
  });
  if (existing) return { ok: false, reason: '你已經擁有這件裝備了' };

  const character = await prisma.character.findUnique({ where: { userId } });
  if (!character) return { ok: false, reason: '你還沒建立角色' };
  if (character.gold < eq.price) {
    return {
      ok: false,
      reason: `金幣不足:需要 ${eq.price.toLocaleString()}💰,你只有 ${character.gold.toLocaleString()}💰`,
    };
  }

  const currentInSlot = await prisma.playerEquipment.findFirst({
    where: { userId, slotId: eq.slot, equipped: true },
  });
  const autoEquip = !currentInSlot;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.playerEquipment.create({
      data: { userId, itemId: equipmentId, slotId: eq.slot, equipped: autoEquip },
    });
    return tx.character.update({
      where: { userId },
      data: { gold: { decrement: eq.price } },
    });
  });

  return { ok: true, equipment: eq, goldAfter: updated.gold, autoEquipped: autoEquip };
}

export type EquipResult =
  | { ok: true; equipment: Equipment }
  | { ok: false; reason: string };

/** 裝備某件已擁有的裝備(同 slot 舊的會卸下)*/
export async function equipItem(userId: string, equipmentId: string): Promise<EquipResult> {
  const eq = EQUIPMENT[equipmentId];
  if (!eq) return { ok: false, reason: '找不到這件裝備' };

  const owned = await prisma.playerEquipment.findUnique({
    where: { userId_itemId: { userId, itemId: equipmentId } },
  });
  if (!owned) return { ok: false, reason: '你還沒擁有這件裝備(先去 /shop 買)' };
  if (owned.equipped) return { ok: false, reason: '這件已經裝備中了' };

  await prisma.$transaction(async (tx) => {
    await tx.playerEquipment.updateMany({
      where: { userId, slotId: eq.slot, equipped: true },
      data: { equipped: false },
    });
    await tx.playerEquipment.update({
      where: { userId_itemId: { userId, itemId: equipmentId } },
      data: { equipped: true },
    });
  });

  return { ok: true, equipment: eq };
}
