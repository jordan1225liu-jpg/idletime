import { EmbedBuilder } from 'discord.js';
import { expForNextLevel, levelProgress } from './leveling.js';
import { formatEnergyStatus } from './energy.js';
import { unlockedCrops, nextLockedCrops } from './crops.js';
import type { PlotState } from './farm.js';
import type { CharacterWithGuild } from './character.js';
import type { CombatStats } from './equipment.js';

/**
 * 主題色,跟 STYLE_GUIDE.md §1 一致。
 * 修改前先看風格指南,確保跨 command 一致。
 */
export const COLORS = {
  PRIMARY: 0x8b4513, // 中世紀棕 — 角色面板、身分
  GOLD: 0xd4af37, // 古銅金 — 邀請、歡迎、節慶
  GREEN: 0x3cb371, // 草地綠 — 農場、成功
  RED: 0xcc3333, // 警告紅 — 錯誤、拒絕
  BLUE: 0x4682b4, // 資訊藍 — 純資訊(預留)
} as const;

/**
 * 全遊戲共用的「系統 emoji 字典」。新增時務必同步 STYLE_GUIDE.md §2。
 * 作物/怪物等資料相關的 emoji 不放這 —— 留在自己的 data 檔(如 crops.ts)
 */
export const EMOJI = {
  // 系統狀態
  success: '🎉',
  ready: '✨',
  warning: '⚠️',
  error: '❌',
  locked: '🔒',
  pending: '⏳',
  refresh: '🔄',

  // 資源 / 數值
  energy: '⚡',
  gold: '💰',
  exp: '🎯',
  level: '⚔️',

  // 動作
  harvest: '🚜',
  plant: '🌱',
  visit: '🤝',

  // 實體 / 標題
  character: '🛡️',
  farm: '🌿',
  brand: '🌿',
  bot: '🤖',
  location: '📍',
  empty: '⬜',
} as const;

/** 產生 ▰▰▰▱▱▱▱▱▱▱ 樣式的進度條 */
export function makeProgressBar(percentage: number, width = 10): string {
  const clamped = Math.max(0, Math.min(100, percentage));
  const filled = Math.floor((clamped / 100) * width);
  return '▰'.repeat(filled) + '▱'.repeat(width - filled);
}

/** 把毫秒/秒轉成「X 天 Y 小時 Z 分」字串 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} 分`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小時 ${m % 60} 分`;
  const d = Math.floor(h / 24);
  return `${d} 天 ${h % 24} 小時`;
}

/** 角色面板 embed(共用於 /me 與 /start)。傳入 combat 會多顯示戰力與裝備。 */
export function buildCharacterEmbed(
  character: CharacterWithGuild,
  combat?: CombatStats | null,
): EmbedBuilder {
  const needed = expForNextLevel(character.level);
  const progress = levelProgress(character.level, character.exp);
  const progressBar = makeProgressBar(progress);

  const guildLine = character.activeGuild
    ? `📍 目前公會:**${character.activeGuild.name}**`
    : `📍 尚未加入任何公會`;

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`🛡️ ${character.name}`)
    .setDescription(guildLine)
    .addFields(
      {
        name: '⚔️ 等級',
        value: `**Lv ${character.level}**\n${progressBar}\n${character.exp.toLocaleString()} / ${needed.toLocaleString()} XP`,
        inline: true,
      },
      {
        name: '💰 金幣',
        value: `**${character.gold.toLocaleString()}** 銅幣`,
        inline: true,
      },
      {
        name: '❤️ 體力',
        value: formatEnergyStatus(character),
        inline: true,
      },
    );

  if (combat) {
    embed.addFields(
      {
        name: '💪 戰力',
        value: `⚔️ ATK **${combat.attack.toLocaleString()}**\n🛡️ DEF **${combat.defense.toLocaleString()}**\n❤️ HP **${combat.maxHealth.toLocaleString()}**`,
        inline: true,
      },
      {
        name: '🎽 裝備',
        value:
          `${combat.weapon ? `${combat.weapon.emoji} ${combat.weapon.name}` : '🗡️ _無武器_'}\n` +
          `${combat.armor ? `${combat.armor.emoji} ${combat.armor.name}` : '🛡️ _無護甲_'}`,
        inline: true,
      },
    );
  }

  return embed.setFooter({
    text: `加入於 ${new Date(character.createdAt).toLocaleDateString('zh-TW')}`,
  });
}

/** 歡迎新玩家的 embed(/start 用) */
export function buildWelcomeEmbed(characterName: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle(`🌿 歡迎來到 idletime,${characterName}!`)
    .setDescription(
      [
        '你來到了一座中世紀小鎮。這裡的生活緩慢但豐富,你可以:',
        '',
        '🌾 種田、釣魚、採集 —— 累積資源',
        '🍞 烹飪、打鐵、裁縫 —— 加工成更有價值的東西',
        '🤝 拜訪朋友、組隊、加入公會 —— 不只一個人玩',
        '',
        '**接下來試試:**',
        '• `/me` 看你的角色資訊',
        '• `/farm` 開始種田',
        '• `/visit @朋友` 拜訪好友(尚未開放)',
      ].join('\n'),
    );
}

/** 通用錯誤 embed */
export function buildErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(COLORS.RED).setDescription(`⚠️ ${message}`);
}

/** /farm 主面板 embed */
export function buildFarmEmbed(params: {
  character: CharacterWithGuild;
  farmingSkill: { level: number; exp: number };
  plots: PlotState[];
  notification?: string;
}): EmbedBuilder {
  const { character, farmingSkill, plots, notification } = params;

  // 田地行
  const plotLines = plots.map((plot, i) => {
    const num = `${i + 1}.`;
    if (plot.status === 'empty') return `${num} ⬜ 空田`;
    if (plot.status === 'ready') {
      return `${num} ${plot.crop!.emoji} **${plot.crop!.name}** ✨ 可收成`;
    }
    const bar = makeProgressBar(plot.progress ?? 0, 12);
    const remaining = formatDuration(Math.ceil((plot.msUntilReady ?? 0) / 1000));
    return `${num} ${plot.crop!.emoji} ${plot.crop!.name} ${bar} ${plot.progress}% (剩 ${remaining})`;
  });

  // 農場技能進度條
  const xpNeeded = expForNextLevel(farmingSkill.level);
  const xpProgress = Math.floor((farmingSkill.exp / xpNeeded) * 100);
  const xpBar = makeProgressBar(xpProgress, 8);

  // 已解鎖作物(顯示最近 6 個,避免過長)
  const allUnlocked = unlockedCrops(farmingSkill.level);
  const showUnlocked = allUnlocked.slice(-6);
  const unlockedLines = showUnlocked.map((c) => {
    return `${c.emoji} **${c.name}** — ${formatDuration(c.growSeconds)} · +${c.xpReward} XP · 售 ${c.sellPrice}💰`;
  });
  const hiddenCount = allUnlocked.length - showUnlocked.length;
  const unlockedText =
    (hiddenCount > 0 ? `_(早期 ${hiddenCount} 種作物已隱藏)_\n` : '') +
    (unlockedLines.length > 0 ? unlockedLines.join('\n') : '_目前無可種作物_');

  // 下個解鎖目標(2 個)
  const nextLocked = nextLockedCrops(farmingSkill.level, 2);
  const nextText =
    nextLocked.length === 0
      ? '🌟 已解鎖全部作物!你是農業大師'
      : nextLocked
          .map((c) => `🔒 ${c.emoji} **${c.name}** — Lv ${c.unlockLevel} · ${formatDuration(c.growSeconds)}`)
          .join('\n');

  let description = `📍 ${character.activeGuild?.name ?? '(未知公會)'}`;
  if (notification) description += `\n\n${notification}`;

  return new EmbedBuilder()
    .setColor(COLORS.GREEN)
    .setTitle(`🌿 ${character.name} 的農場`)
    .setDescription(description)
    .addFields(
      { name: '🌱 田地狀態', value: plotLines.join('\n'), inline: false },
      { name: '❤️ 體力', value: formatEnergyStatus(character), inline: true },
      {
        name: '🎯 農場技能',
        value: `**Lv ${farmingSkill.level}**\n${xpBar}\n${farmingSkill.exp} / ${xpNeeded} XP`,
        inline: true,
      },
      { name: '🌾 已解鎖作物', value: unlockedText, inline: false },
      { name: '🔒 下個解鎖目標', value: nextText, inline: false },
    );
}
