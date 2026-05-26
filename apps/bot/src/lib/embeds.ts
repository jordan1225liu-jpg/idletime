import { EmbedBuilder } from 'discord.js';
import { expForNextLevel, levelProgress } from './leveling.js';
import { formatEnergyStatus } from './energy.js';
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
