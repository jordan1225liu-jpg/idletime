import { EmbedBuilder } from 'discord.js';
import { expForNextLevel, levelProgress } from './leveling.js';
import { formatEnergyStatus } from './energy.js';
import { CROPS } from './crops.js';
import type { PlotState } from './farm.js';
import type { CharacterWithGuild } from './character.js';

/** 主題色,跟 GDD §8.2 一致 */
export const COLORS = {
  PRIMARY: 0x8b4513, // 中世紀棕
  GOLD: 0xd4af37, // 古銅金
  GREEN: 0x3cb371, // 草地綠
  RED: 0xcc3333, // 警告紅
  BLUE: 0x4682b4, // 資訊藍
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

/** 角色面板 embed(共用於 /me 與 /start) */
export function buildCharacterEmbed(character: CharacterWithGuild): EmbedBuilder {
  const needed = expForNextLevel(character.level);
  const progress = levelProgress(character.level, character.exp);
  const progressBar = makeProgressBar(progress);

  const guildLine = character.activeGuild
    ? `📍 目前公會:**${character.activeGuild.name}**`
    : `📍 尚未加入任何公會`;

  return new EmbedBuilder()
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
    )
    .setFooter({
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
        '• `/farm` 開始種田(尚未開放)',
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
    // growing
    const bar = makeProgressBar(plot.progress ?? 0, 12);
    const remaining = formatDuration(Math.ceil((plot.msUntilReady ?? 0) / 1000));
    return `${num} ${plot.crop!.emoji} ${plot.crop!.name} ${bar} ${plot.progress}% (剩 ${remaining})`;
  });

  // 農場技能進度條
  const xpNeeded = expForNextLevel(farmingSkill.level);
  const xpProgress = Math.floor((farmingSkill.exp / xpNeeded) * 100);
  const xpBar = makeProgressBar(xpProgress, 8);

  // 可種作物清單
  const cropOptions = Object.values(CROPS)
    .map((c) => {
      const locked = c.unlockLevel > farmingSkill.level;
      const lockTag = locked ? ` 🔒 需 Lv ${c.unlockLevel}` : '';
      return `${c.emoji} **${c.name}** — ${formatDuration(c.growSeconds)} / -${c.energyCost} 體力${lockTag}`;
    })
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
      { name: '🌾 可種作物', value: cropOptions, inline: false },
    );
}
