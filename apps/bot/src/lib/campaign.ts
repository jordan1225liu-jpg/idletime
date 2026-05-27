import { prisma } from '@idletime/db';
import { addCharacterExp } from './character.js';
import { NPCS, type NpcId } from './npcs.js';

/**
 * 主線劇情 = 一條有序的章節鏈(CAMPAIGN_STEPS)。每章:NPC 旁白 + 一個「目標」+ 獎勵。
 * 目標採「狀態檢查」即時判定(讀當下的等級/技能/金幣/裝備/背包),所以不需要事件 hook,
 * 也不需要每章計數;玩家在 /story 按「領取」時重新判定 → 達成才發獎並推進到下一章。
 *
 * 設計:角色主等級主要來自狩獵,因此 char_level 目標會自然把玩家推往各地區
 * (Lv 21 = 暗黑森林…),v1 不硬鎖 /hunt 地區,純軟性導流。
 */

export type CampaignObjective =
  | { type: 'char_level'; target: number; label: string }
  | { type: 'skill_level'; skillId: string; target: number; label: string }
  | { type: 'gold'; target: number; label: string }
  | { type: 'own_weapon'; label: string }
  | { type: 'own_armor'; label: string }
  | { type: 'has_potion'; target: number; label: string }
  | { type: 'inventory_item'; itemId: string; target: number; label: string };

export interface CampaignReward {
  gold?: number;
  xp?: number; // 角色主等級經驗(可選,少量輔助)
  items?: { itemId: string; quantity: number }[];
}

export interface CampaignStep {
  step: number; // 1-based
  npc: NpcId;
  title: string;
  narrative: string;
  objective: CampaignObjective;
  reward: CampaignReward;
}

// ─── 主線內容(改故事 / 加章節都在這)──────────────────────────
export const CAMPAIGN_STEPS: CampaignStep[] = [
  {
    step: 1,
    npc: 'mayor',
    title: '初來乍到',
    narrative:
      '「終於有人願意來這座被遺忘的小鎮了。」鎮長艾德溫緊緊握住你的手,「灰燼谷曾經繁榮,如今只剩斷垣殘壁。願意幫我們重建嗎?先用 `/me` 看看自己,四處走走吧。」',
    objective: { type: 'char_level', target: 1, label: '抵達灰燼谷(建立角色)' },
    reward: { gold: 200 },
  },
  {
    step: 2,
    npc: 'tom',
    title: '翻土播種',
    narrative:
      '老農湯姆遞給你一把鋤頭:「土地不會辜負努力的人。去 `/farm` 種點田,把農場技能練到 Lv 2,讓我看看你的本事。」',
    objective: { type: 'skill_level', skillId: 'farming', target: 2, label: '農場技能達到 Lv 2' },
    reward: { gold: 150, items: [{ itemId: 'carrot_seed', quantity: 5 }] },
  },
  {
    step: 3,
    npc: 'marina',
    title: '撒下漁網',
    narrative:
      '「河水最近總算清了點。」漁婦瑪琳娜笑著說,「拿 `/fish` 去練練手,釣魚技能到 Lv 2,我就教你看魚汛。」',
    objective: { type: 'skill_level', skillId: 'fishing', target: 2, label: '釣魚技能達到 Lv 2' },
    reward: { gold: 150 },
  },
  {
    step: 4,
    npc: 'mayor',
    title: '第一桶金',
    narrative:
      '「重建什麼都要錢。」艾德溫嘆了口氣,「先想辦法存到 500 金幣吧 —— 賣作物、賣漁獲都行,用 `/sell`。」',
    objective: { type: 'gold', target: 500, label: '金幣達到 500' },
    reward: { gold: 300 },
  },
  {
    step: 5,
    npc: 'borin',
    title: '武裝自己',
    narrative:
      '鐵匠博林敲著鐵砧,頭也不抬:「外頭的野獸可不跟你客氣。去 `/shop` 買把武器,別空著手送死。」',
    objective: { type: 'own_weapon', label: '擁有一把武器(/shop 購買)' },
    reward: { gold: 200 },
  },
  {
    step: 6,
    npc: 'borin',
    title: '披上護甲',
    narrative:
      '「光有武器還不夠。」博林丟給你一塊磨好的皮革,「弄件護甲穿上,用 `/equipment` 裝備好,保命要緊。」',
    objective: { type: 'own_armor', label: '擁有一件護甲(/shop 購買)' },
    reward: { gold: 200 },
  },
  {
    step: 7,
    npc: 'sage',
    title: '藥劑初心',
    narrative:
      '藥師賽吉攪著冒泡的鍋:「受傷時可沒人替你擋刀。去 `/brew` 煉一瓶回血藥傍身吧,狩獵時能保你一命。」',
    objective: { type: 'has_potion', target: 1, label: '背包擁有任意回血藥 ×1' },
    reward: { gold: 250 },
  },
  {
    step: 8,
    npc: 'mayor',
    title: '守護平原',
    narrative:
      '「灰燼谷周圍的平原還不安寧。」艾德溫神色凝重,「去 `/hunt` 狩獵、變強吧。等你到 Lv 5,我才能放心讓村民出門。」',
    objective: { type: 'char_level', target: 5, label: '角色等級達到 Lv 5' },
    reward: { gold: 500, items: [{ itemId: 'potion_small', quantity: 1 }] },
  },
  {
    step: 9,
    npc: 'mayor',
    title: '嶄露頭角',
    narrative:
      '村民開始記得你的名字了。「再強一點,」艾德溫拍拍你的肩,「到 Lv 10,你就是灰燼谷的英雄。」',
    objective: { type: 'char_level', target: 10, label: '角色等級達到 Lv 10' },
    reward: { gold: 1200, items: [{ itemId: 'potion_medium', quantity: 1 }] },
  },
  {
    step: 10,
    npc: 'tom',
    title: '豐收之約',
    narrative:
      '湯姆的田又綠了起來:「跟著我把農場技能練到 Lv 8,我就把祖傳的好種子分你一些。」',
    objective: { type: 'skill_level', skillId: 'farming', target: 8, label: '農場技能達到 Lv 8' },
    reward: { gold: 800, items: [{ itemId: 'tomato_seed', quantity: 5 }] },
  },
  {
    step: 11,
    npc: 'mayor',
    title: '森林的陰影',
    narrative:
      '「暗黑森林傳來不祥的氣息。」艾德溫攤開一張舊地圖,「把自己練到 Lv 21,你就有資格踏進那片樹海了。」',
    objective: { type: 'char_level', target: 21, label: '角色等級達到 Lv 21(可挑戰暗黑森林)' },
    reward: { gold: 3000, items: [{ itemId: 'potion_large', quantity: 1 }] },
  },
  {
    step: 12,
    npc: 'mayor',
    title: '未完待續',
    narrative:
      '炊煙再度升起,孩子們在重建的廣場上奔跑。「灰燼谷因你而重生。」艾德溫望向遠方的群山,「但更大的世界,正在等你 —— 故事,還沒結束。」',
    objective: { type: 'char_level', target: 25, label: '角色等級達到 Lv 25' },
    reward: { gold: 5000 },
  },
];

export interface ObjectiveStatus {
  met: boolean;
  current: number;
  target: number;
  label: string;
}

/** 即時判定某個目標是否達成(讀當下狀態)。 */
export async function evaluateObjective(
  userId: string,
  obj: CampaignObjective,
): Promise<ObjectiveStatus> {
  switch (obj.type) {
    case 'char_level': {
      const c = await prisma.character.findUnique({ where: { userId }, select: { level: true } });
      const cur = c?.level ?? 0;
      return { met: cur >= obj.target, current: cur, target: obj.target, label: obj.label };
    }
    case 'skill_level': {
      const s = await prisma.playerSkill.findUnique({
        where: { userId_skillId: { userId, skillId: obj.skillId } },
        select: { level: true },
      });
      const cur = s?.level ?? 1;
      return { met: cur >= obj.target, current: cur, target: obj.target, label: obj.label };
    }
    case 'gold': {
      const c = await prisma.character.findUnique({ where: { userId }, select: { gold: true } });
      const cur = c?.gold ?? 0;
      return { met: cur >= obj.target, current: cur, target: obj.target, label: obj.label };
    }
    case 'own_weapon':
    case 'own_armor': {
      const slotId = obj.type === 'own_weapon' ? 'weapon' : 'armor';
      const n = await prisma.playerEquipment.count({ where: { userId, slotId } });
      return { met: n > 0, current: n > 0 ? 1 : 0, target: 1, label: obj.label };
    }
    case 'has_potion': {
      const rows = await prisma.inventoryItem.findMany({
        where: { userId, quantity: { gt: 0 }, item: { category: 'consumable' } },
        select: { quantity: true },
      });
      const cur = rows.reduce((s, r) => s + r.quantity, 0);
      return { met: cur >= obj.target, current: cur, target: obj.target, label: obj.label };
    }
    case 'inventory_item': {
      const inv = await prisma.inventoryItem.findUnique({
        where: { userId_itemId: { userId, itemId: obj.itemId } },
        select: { quantity: true },
      });
      const cur = inv?.quantity ?? 0;
      return { met: cur >= obj.target, current: cur, target: obj.target, label: obj.label };
    }
  }
}

export interface CampaignState {
  currentStep: number; // 1-based;> 總章節數 = 已全部完成
  completedAt: Date | null;
}

/** 取得(或初始化)玩家主線進度。需先有 User row(已 /start)。 */
export async function getOrCreateProgress(userId: string): Promise<CampaignState> {
  const existing = await prisma.campaignProgress.findUnique({ where: { userId } });
  if (existing) return { currentStep: existing.currentStep, completedAt: existing.completedAt };
  const created = await prisma.campaignProgress.create({ data: { userId } });
  return { currentStep: created.currentStep, completedAt: created.completedAt };
}

export function getStep(step: number): CampaignStep | undefined {
  return CAMPAIGN_STEPS[step - 1];
}

export interface GrantedItem {
  emoji: string;
  name: string;
  quantity: number;
}

/** 發放章節獎勵(金幣 + 物品 + 可選經驗),回傳已發物品(含顯示名)。 */
async function grantReward(userId: string, reward: CampaignReward): Promise<GrantedItem[]> {
  if (reward.gold && reward.gold > 0) {
    await prisma.character.update({ where: { userId }, data: { gold: { increment: reward.gold } } });
  }

  const granted: GrantedItem[] = [];
  if (reward.items && reward.items.length > 0) {
    const items = await prisma.item.findMany({
      where: { id: { in: reward.items.map((i) => i.itemId) } },
    });
    const map = new Map(items.map((i) => [i.id, i]));
    for (const it of reward.items) {
      await prisma.inventoryItem.upsert({
        where: { userId_itemId: { userId, itemId: it.itemId } },
        create: { userId, itemId: it.itemId, quantity: it.quantity },
        update: { quantity: { increment: it.quantity } },
      });
      const meta = map.get(it.itemId);
      granted.push({ emoji: meta?.emoji ?? '📦', name: meta?.name ?? it.itemId, quantity: it.quantity });
    }
  }

  if (reward.xp && reward.xp > 0) {
    await addCharacterExp(userId, reward.xp);
  }
  return granted;
}

export type ClaimStepResult =
  | {
      ok: true;
      completed: CampaignStep;
      grantedGold: number;
      grantedItems: GrantedItem[];
      allDone: boolean;
    }
  | { ok: false; reason: string };

/**
 * 領取當前章節獎勵並推進。原子防連點:用 updateMany(where currentStep = step)推進,
 * count===0 代表已被前一次點擊推進過 → 不重複發獎。
 */
export async function claimCurrentStep(userId: string): Promise<ClaimStepResult> {
  const character = await prisma.character.findUnique({ where: { userId } });
  if (!character) return { ok: false, reason: '你還沒建立角色,先用 `/start`' };

  const progress = await getOrCreateProgress(userId);
  const step = progress.currentStep;
  if (step > CAMPAIGN_STEPS.length) return { ok: false, reason: '主線劇情已全部完成!' };

  const stepDef = CAMPAIGN_STEPS[step - 1]!;
  const status = await evaluateObjective(userId, stepDef.objective);
  if (!status.met) {
    return {
      ok: false,
      reason: `目標尚未達成:${stepDef.objective.label}(${status.current}/${status.target})`,
    };
  }

  const allDone = step >= CAMPAIGN_STEPS.length;
  const adv = await prisma.campaignProgress.updateMany({
    where: { userId, currentStep: step },
    data: { currentStep: step + 1, completedAt: allDone ? new Date() : null },
  });
  if (adv.count === 0) return { ok: false, reason: '這個章節剛剛已經領取過了' };

  const grantedItems = await grantReward(userId, stepDef.reward);
  return {
    ok: true,
    completed: stepDef,
    grantedGold: stepDef.reward.gold ?? 0,
    grantedItems,
    allDone,
  };
}
