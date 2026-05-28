import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
} from 'discord.js';
import { castFish, type CastResult } from '../lib/fishing.js';
import { expForNextLevel } from '../lib/leveling.js';
import { COLORS, makeProgressBar } from '../lib/embeds.js';
import { assetUrl } from '../lib/assets.js';

export const data = new SlashCommandBuilder()
  .setName('fish')
  .setDescription('🎣 釣魚(1 分鐘 CD,等級越高越容易釣到稀有魚)');

const BUTTON_CAST = 'fish:cast';

function buildEmbed(result: CastResult): EmbedBuilder {
  // ── CD 還沒到 ──
  if (!result.ok && result.reason === 'cooldown') {
    const seconds = Math.ceil(result.msRemaining / 1000);
    return new EmbedBuilder()
      .setColor(COLORS.BLUE)
      .setTitle('⏳ 釣竿還在收線')
      .setDescription(`再 **${seconds}** 秒可以再釣。`);
  }

  // ── 沒角色 ──
  if (!result.ok) {
    return new EmbedBuilder()
      .setColor(COLORS.RED)
      .setDescription('⚠️ 你還沒建立角色,先用 `/start`');
  }

  // ── 成功 ──
  const { catch: catchResult, xpGained, goldGained, oldLevel, newLevel, newExp, levelsGained, goldAfter } =
    result;
  const { tier, fish } = catchResult;

  // 雜物(沒收穫)
  if (xpGained === 0 && goldGained === 0) {
    return new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('🎣 釣魚結果')
      .setDescription(
        `你撈起了 ${fish.emoji} **${fish.name}**...\n沒什麼用,丟回去了 😅`,
      )
      .setFooter({ text: `下次再加油 · 1 分鐘後可再釣` });
  }

  // 一般成功 — 用 tier 決定顏色與 vibes
  const isMythical = tier.id === 'mythical';
  const isEpicPlus = ['epic', 'mythical'].includes(tier.id);

  const xpBar = makeProgressBar(
    newExp >= expForNextLevel(newLevel) ? 100 : Math.floor((newExp / expForNextLevel(newLevel)) * 100),
    8,
  );

  const title = isMythical
    ? `✨ 神話降臨! ${fish.emoji} ${fish.name}!`
    : isEpicPlus
      ? `🌟 大豐收! ${fish.emoji} ${fish.name}!`
      : `🎣 釣到 ${fish.emoji} ${fish.name}!`;

  let description = `**${tier.name}** Tier  ·  +${xpGained} XP  ·  +${goldGained}💰`;
  if (levelsGained > 0) {
    description += `\n\n🎊 **釣魚技能升級!Lv ${oldLevel} → Lv ${newLevel}**`;
  }

  return new EmbedBuilder()
    .setColor(isMythical ? COLORS.GOLD : isEpicPlus ? COLORS.GOLD : COLORS.GREEN)
    .setTitle(title)
    .setDescription(description)
    .addFields(
      {
        name: '🎯 釣魚技能',
        value: `**Lv ${newLevel}**\n${xpBar}\n${newExp} / ${expForNextLevel(newLevel)} XP`,
        inline: true,
      },
      {
        name: '💰 金幣',
        value: `${goldAfter.toLocaleString()}\n(+${goldGained})`,
        inline: true,
      },
    )
    .setFooter({ text: '1 分鐘後可再釣' });
}

/** 加上釣魚場景圖 + 漁婦瑪琳娜肖像(有圖才顯示,沒圖照舊) */
function withSceneArt(embed: EmbedBuilder): EmbedBuilder {
  const banner = assetUrl('activities/fish');
  if (banner) embed.setImage(banner);
  const npc = assetUrl('npcs/marina');
  if (npc) embed.setThumbnail(npc);
  return embed;
}

function buildButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BUTTON_CAST)
      .setLabel('再釣一次')
      .setEmoji('🎣')
      .setStyle(ButtonStyle.Primary),
  );
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const result = await castFish(interaction.user.id);

  // 沒角色就 ephemeral 回 hint,不留 button
  if (!result.ok && result.reason === 'no_character') {
    await interaction.reply({
      content: '你還沒建立角色!用 `/start` 開始遊戲。',
      flags: MessageFlags.Ephemeral,
    } satisfies InteractionReplyOptions);
    return;
  }

  await interaction.reply({
    embeds: [withSceneArt(buildEmbed(result))],
    components: [buildButtons()],
  });
}

export async function handleButton(interaction: ButtonInteraction): Promise<boolean> {
  if (interaction.customId !== BUTTON_CAST) return false;

  // 先 ack(castFish 在冷連線下可能 >3 秒,避免 Unknown interaction)
  await interaction.deferUpdate();
  const result = await castFish(interaction.user.id);

  await interaction.editReply({
    embeds: [withSceneArt(buildEmbed(result))],
    components: [buildButtons()],
  } satisfies InteractionEditReplyOptions);

  return true;
}
