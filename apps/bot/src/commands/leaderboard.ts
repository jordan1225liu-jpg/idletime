import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { getLeaderboard, type LbCategory, type LbScope } from '../lib/leaderboard.js';
import { COLORS } from '../lib/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('🏆 排行榜(等級 / 金幣 / 農場 / 釣魚,全球或本伺服器)');

const CATEGORY_META: Record<LbCategory, { label: string; emoji: string; fmt: (v: number) => string }> = {
  level: { label: '角色等級', emoji: '⚔️', fmt: (v) => `Lv ${v}` },
  gold: { label: '金幣', emoji: '💰', fmt: (v) => `${v.toLocaleString()} 💰` },
  farming: { label: '農場技能', emoji: '🌾', fmt: (v) => `農場 Lv ${v}` },
  fishing: { label: '釣魚技能', emoji: '🎣', fmt: (v) => `釣魚 Lv ${v}` },
};

const SCOPE_META: Record<LbScope, { label: string; emoji: string }> = {
  global: { label: '全球', emoji: '🌍' },
  server: { label: '本伺服器', emoji: '🏰' },
};

const RANK_PREFIX = ['🥇', '🥈', '🥉'];

function parseState(suffix: string): { category: LbCategory; scope: LbScope } {
  const [category, scope] = suffix.split('|');
  return {
    category: (category as LbCategory) ?? 'level',
    scope: (scope as LbScope) ?? 'global',
  };
}

async function buildLeaderboardUI(params: {
  category: LbCategory;
  scope: LbScope;
  guildId?: string;
  requesterId: string;
}) {
  const { category, scope, guildId, requesterId } = params;
  const meta = CATEGORY_META[category];
  const scopeMeta = SCOPE_META[scope];

  const result = await getLeaderboard({ category, scope, guildId, requesterId });

  const lines =
    result.entries.length === 0
      ? '_還沒有人上榜,快來搶頭香!_'
      : result.entries
          .map((e) => {
            const prefix = RANK_PREFIX[e.rank - 1] ?? `**#${e.rank}**`;
            const you = e.userId === requesterId ? ' ◀ 你' : '';
            return `${prefix} ${e.name} — ${meta.fmt(e.value)}${you}`;
          })
          .join('\n');

  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle(`🏆 排行榜 — ${meta.emoji} ${meta.label}`)
    .setDescription(`${scopeMeta.emoji} **${scopeMeta.label}** · 共 ${result.totalPlayers} 人\n\n${lines}`);

  if (result.requesterRank !== null && result.requesterValue !== null) {
    embed.setFooter({
      text: `📍 你的排名:#${result.requesterRank} / ${result.totalPlayers}(${meta.fmt(result.requesterValue)})`,
    });
  } else {
    embed.setFooter({ text: scope === 'server' ? '你不在這個伺服器的榜上(用 /me 在這伺服器啟用)' : '先 /start 建立角色才會上榜' });
  }

  const state = `${category}|${scope}`;
  const otherScope: LbScope = scope === 'global' ? 'server' : 'global';

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`lb:cat:${scope}`)
    .setPlaceholder('切換排行類別');
  for (const cat of Object.keys(CATEGORY_META) as LbCategory[]) {
    const m = CATEGORY_META[cat];
    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(m.label)
        .setValue(cat)
        .setEmoji(m.emoji)
        .setDefault(cat === category),
    );
  }

  const scopeButton = new ButtonBuilder()
    .setCustomId(`lb:scope:${category}|${otherScope}`)
    .setLabel(`切換到 ${SCOPE_META[otherScope].label}`)
    .setEmoji(SCOPE_META[otherScope].emoji)
    .setStyle(ButtonStyle.Secondary);

  return {
    embed,
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(scopeButton),
    ],
    _state: state,
  };
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const ui = await buildLeaderboardUI({
    category: 'level',
    scope: 'global',
    guildId: interaction.guildId ?? undefined,
    requesterId: interaction.user.id,
  });
  await interaction.reply({ embeds: [ui.embed], components: ui.components });
}

export async function handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith('lb:cat:')) return false;
  const scope = (interaction.customId.split(':')[2] as LbScope) ?? 'global';
  const category = (interaction.values[0] as LbCategory) ?? 'level';
  const ui = await buildLeaderboardUI({
    category,
    scope,
    guildId: interaction.guildId ?? undefined,
    requesterId: interaction.user.id,
  });
  await interaction.update({ embeds: [ui.embed], components: ui.components });
  return true;
}

export async function handleButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith('lb:scope:')) return false;
  const { category, scope } = parseState(interaction.customId.slice('lb:scope:'.length));
  // server 範圍但不在伺服器(DM)→ 強制 global
  const effectiveScope: LbScope = scope === 'server' && !interaction.guildId ? 'global' : scope;
  const ui = await buildLeaderboardUI({
    category,
    scope: effectiveScope,
    guildId: interaction.guildId ?? undefined,
    requesterId: interaction.user.id,
  });
  await interaction.update({ embeds: [ui.embed], components: ui.components });
  return true;
}
