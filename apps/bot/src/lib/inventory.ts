import { prisma, type Item } from '@idletime/db';

export interface InventoryEntry {
  item: Item;
  quantity: number;
}

/** 取得使用者背包中所有 quantity > 0 的物品。依 category + itemId 排序。 */
export async function getInventory(userId: string): Promise<InventoryEntry[]> {
  const items = await prisma.inventoryItem.findMany({
    where: { userId, quantity: { gt: 0 } },
    include: { item: true },
    orderBy: [{ item: { category: 'asc' } }, { itemId: 'asc' }],
  });
  return items.map(({ item, quantity }) => ({ item, quantity }));
}

export type SellResult =
  | {
      ok: true;
      itemName: string;
      itemEmoji: string;
      sold: number;
      remaining: number;
      unitPrice: number;
      goldGained: number;
      goldBefore: number;
      goldAfter: number;
    }
  | { ok: false; reason: string };

/**
 * 賣物。quantity = 0 表示「全賣」。
 * 邊界:無此物 / 不可賣 / 數量超過 / character 不存在,都會回 { ok: false, reason }
 */
export async function sellItem(
  userId: string,
  itemId: string,
  quantity: number,
): Promise<SellResult> {
  const inv = await prisma.inventoryItem.findUnique({
    where: { userId_itemId: { userId, itemId } },
    include: { item: true },
  });

  if (!inv || inv.quantity === 0) {
    return { ok: false, reason: '你的背包沒有這個物品' };
  }
  if (inv.item.sellPrice <= 0) {
    return { ok: false, reason: `${inv.item.name} 沒辦法賣` };
  }

  // 0 = 全部
  const actualQuantity = quantity === 0 ? inv.quantity : Math.min(quantity, inv.quantity);
  if (actualQuantity <= 0) {
    return { ok: false, reason: '數量必須 ≥ 0(0 = 全賣)' };
  }

  const goldGained = actualQuantity * inv.item.sellPrice;

  const character = await prisma.character.findUnique({ where: { userId } });
  if (!character) return { ok: false, reason: '找不到角色' };
  const goldBefore = character.gold;

  const updated = await prisma.$transaction(async (tx) => {
    if (inv.quantity === actualQuantity) {
      // 全賣:刪掉那筆 row
      await tx.inventoryItem.delete({
        where: { userId_itemId: { userId, itemId } },
      });
    } else {
      await tx.inventoryItem.update({
        where: { userId_itemId: { userId, itemId } },
        data: { quantity: { decrement: actualQuantity } },
      });
    }

    return tx.character.update({
      where: { userId },
      data: { gold: { increment: goldGained } },
    });
  });

  return {
    ok: true,
    itemName: inv.item.name,
    itemEmoji: inv.item.emoji ?? '',
    sold: actualQuantity,
    remaining: inv.quantity - actualQuantity,
    unitPrice: inv.item.sellPrice,
    goldGained,
    goldBefore,
    goldAfter: updated.gold,
  };
}
