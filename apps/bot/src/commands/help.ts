import {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { COLORS } from '../lib/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('📖 查看所有指令與玩法');

/** 指令分類表 — 新增指令時記得更新這裡 */
const SECTIONS: { name: string; commands: { cmd: string; desc: string }[] }[] = [
  {
    name: '🧑 角色基礎',
    commands: [
      { cmd: '/start', desc: '第一次玩,建立角色' },
      { cmd: '/me', desc: '角色面板:等級、金幣、體力、戰力、裝備' },
      { cmd: '/quests', desc: '每日任務 — 完成領金幣 + 經驗(每天重置)' },
      { cmd: '/help', desc: '顯示這個指令列表' },
      { cmd: '/ping', desc: '檢查 bot 在線與延遲' },
    ],
  },
  {
    name: '🌾 生活技能',
    commands: [
      { cmd: '/farm', desc: '農場 — 種 16 種作物、收成、升農場技能' },
      { cmd: '/fish', desc: '釣魚 — 1 分 CD,等級越高越易釣到稀有魚' },
    ],
  },
  {
    name: '🎒 物品 / 經濟',
    commands: [
      { cmd: '/inventory', desc: '查看背包' },
      { cmd: '/sell', desc: '賣物品換金幣(數量填 0 = 全賣)' },
      { cmd: '/brew', desc: '藥水鋪 — 用作物 + 金幣合成回血藥' },
      { cmd: '/shop', desc: '鐵匠鋪 — 買武器與護甲' },
    ],
  },
  {
    name: '⚔️ 裝備 / 戰鬥',
    commands: [
      { cmd: '/equipment', desc: '查看 / 切換武器與護甲' },
      { cmd: '/hunt', desc: '1-3 人組隊狩獵(region 必填,partner 可選)' },
    ],
  },
  {
    name: '🤝 社交 / 競爭',
    commands: [
      { cmd: '/visit', desc: '拜訪好友,雙方各得 +20⚡(同一人每天 1 次)' },
      { cmd: '/leaderboard', desc: '排行榜(等級/金幣/農場/釣魚,全球或本伺服器)' },
    ],
  },
];

const GAMEPLAY_LOOP = [
  '`/start` 建角色',
  '↓',
  '`/farm` `/fish` 累積資源 + 練技能',
  '↓',
  '`/sell` 換金幣 → `/brew` 做藥水 → `/shop` 買裝備 → `/equipment` 裝上',
  '↓',
  '`/hunt` 組隊打怪賺主等級 + 大量金幣',
  '↓',
  '`/visit` 日常互動拿體力',
].join('\n');

function buildHelpEmbed(): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle('📖 idletime 指令大全')
    .setDescription('一款可愛中世紀風的合作掛機遊戲。以下是所有指令:');

  for (const section of SECTIONS) {
    const value = section.commands.map((c) => `**${c.cmd}** — ${c.desc}`).join('\n');
    embed.addFields({ name: section.name, value, inline: false });
  }

  embed.addFields({ name: '🔄 典型遊玩循環', value: GAMEPLAY_LOOP, inline: false });
  embed.setFooter({ text: '不知道從哪開始?先 /start,再 /farm 種田試試!' });

  return embed;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.reply({
    embeds: [buildHelpEmbed()],
    flags: MessageFlags.Ephemeral, // 只有自己看得到,不洗頻道
  });
}
