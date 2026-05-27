import { prisma } from '@idletime/db';

export interface PotionIngredient {
  itemId: string;
  name: string;
  emoji: string;
  quantity: number;
}

export interface PotionRecipe {
  itemId: string; // 對應 Item.id(potion_xxx)
  name: string;
  emoji: string;
  healPercent: number; // 回復 maxHealth 的百分比
  goldCost: number;
  ingredients: PotionIngredient[];
}

/**
 * 5 種回血藥。配方用不同階段作物,讓 farming 各作物都有終點目的。
 * 回血 = maxHealth × healPercent%(卡上限)。
 */
export const POTIONS: PotionRecipe[] = [
  {
    itemId: 'potion_minor',
    name: '微量回血藥',
    emoji: '🧪',
    healPercent: 10,
    goldCost: 20,
    ingredients: [{ itemId: 'wheat', name: '小麥', emoji: '🌾', quantity: 3 }],
  },
  {
    itemId: 'potion_small',
    name: '小型回血藥',
    emoji: '🧪',
    healPercent: 25,
    goldCost: 100,
    ingredients: [
      { itemId: 'wheat', name: '小麥', emoji: '🌾', quantity: 5 },
      { itemId: 'carrot', name: '胡蘿蔔', emoji: '🥕', quantity: 2 },
    ],
  },
  {
    itemId: 'potion_medium',
    name: '中型回血藥',
    emoji: '🧪',
    healPercent: 50,
    goldCost: 500,
    ingredients: [
      { itemId: 'carrot', name: '胡蘿蔔', emoji: '🥕', quantity: 5 },
      { itemId: 'potato', name: '馬鈴薯', emoji: '🥔', quantity: 3 },
    ],
  },
  {
    itemId: 'potion_large',
    name: '大型回血藥',
    emoji: '🧪',
    healPercent: 75,
    goldCost: 2_000,
    ingredients: [
      { itemId: 'tomato', name: '番茄', emoji: '🍅', quantity: 3 },
      { itemId: 'corn', name: '玉米', emoji: '🌽', quantity: 2 },
    ],
  },
  {
    itemId: 'potion_divine',
    name: '神級回血藥',
    emoji: '🧪',
    healPercent: 100,
    goldCost: 5_000,
    ingredients: [
      { itemId: 'pumpkin', name: '南瓜', emoji: '🎃', quantity: 5 },
      { itemId: 'strawberry', name: '草莓', emoji: '🍓', quantity: 2 },
    ],
  },
];

export const POTION_BY_ID: Record<string, PotionRecipe> = Object.fromEntries(
  POTIONS.map((p) => [p.itemId, p]),
);

export type BrewResult =
  | { ok: true; potion: PotionRecipe; quantity: number; goldAfter: number }
  | { ok: false; reason: string };

/** 合成藥水。檢查材料 + 金幣,扣除,產出進背包。 */
export async function brewPotion(
  userId: string,
  potionId: string,
  quantity = 1,
): Promise<BrewResult> {
  const recipe = POTION_BY_ID[potionId];
  if (!recipe) return { ok: false, reason: '找不到這個藥水配方' };
  if (quantity < 1) return { ok: false, reason: '數量必須 ≥ 1' };

  const character = await prisma.character.findUnique({ where: { userId } });
  if (!character) return { ok: false, reason: '你還沒建立角色' };

  const totalGold = recipe.goldCost * quantity;
  if (character.gold < totalGold) {
    return {
      ok: false,
      reason: `金幣不足:需要 ${totalGold.toLocaleString()}💰,你有 ${character.gold.toLocaleString()}💰`,
    };
  }

  // 檢查每樣材料是否足夠
  for (const ing of recipe.ingredients) {
    const inv = await prisma.inventoryItem.findUnique({
      where: { userId_itemId: { userId, itemId: ing.itemId } },
    });
    const have = inv?.quantity ?? 0;
    const need = ing.quantity * quantity;
    if (have < need) {
      return {
        ok: false,
        reason: `${ing.emoji} ${ing.name} 不夠:需要 ${need},你只有 ${have}`,
      };
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const ing of recipe.ingredients) {
      await tx.inventoryItem.update({
        where: { userId_itemId: { userId, itemId: ing.itemId } },
        data: { quantity: { decrement: ing.quantity * quantity } },
      });
    }
    await tx.inventoryItem.upsert({
      where: { userId_itemId: { userId, itemId: potionId } },
      create: { userId, itemId: potionId, quantity },
      update: { quantity: { increment: quantity } },
    });
    return tx.character.update({
      where: { userId },
      data: { gold: { decrement: totalGold } },
    });
  });

  return { ok: true, potion: recipe, quantity, goldAfter: updated.gold };
}

/** 玩家持有的藥水(給 hunt 補血用)*/
export async function getPotionInventory(
  userId: string,
): Promise<{ recipe: PotionRecipe; quantity: number }[]> {
  const result: { recipe: PotionRecipe; quantity: number }[] = [];
  const invItems = await prisma.inventoryItem.findMany({
    where: { userId, itemId: { in: POTIONS.map((p) => p.itemId) }, quantity: { gt: 0 } },
  });
  const qtyById = new Map(invItems.map((i) => [i.itemId, i.quantity]));
  for (const recipe of POTIONS) {
    const qty = qtyById.get(recipe.itemId) ?? 0;
    if (qty > 0) result.push({ recipe, quantity: qty });
  }
  return result;
}

/** 消耗一瓶藥水(hunt 補血用)。回傳 false 表示沒有。 */
export async function consumePotion(userId: string, potionId: string): Promise<boolean> {
  const inv = await prisma.inventoryItem.findUnique({
    where: { userId_itemId: { userId, itemId: potionId } },
  });
  if (!inv || inv.quantity < 1) return false;

  if (inv.quantity === 1) {
    await prisma.inventoryItem.delete({
      where: { userId_itemId: { userId, itemId: potionId } },
    });
  } else {
    await prisma.inventoryItem.update({
      where: { userId_itemId: { userId, itemId: potionId } },
      data: { quantity: { decrement: 1 } },
    });
  }
  return true;
}
