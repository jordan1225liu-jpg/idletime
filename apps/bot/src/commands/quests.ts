import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
} from 'discord.js';
import { getCharacter } from '../lib/character.js';
import {
  getOrCreateDailyQuests,
  claimQuest,
  QUEST_DEFS,
  type QuestType,
} from '../lib/quests.js';
import { COLORS, makeProgressBar } from '../lib/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('quests')
  .setDescription('📋 查看每日任務(每天凌晨重置)');

const CLAIM_PREFIX = 'quest:claim:';

async function buildQuestsUI(userId: string, notification?: string) {
  const character = await getCharacter(userId);
  if (!character) return null;

  const quests = await getOrCreateDailyQuests(userId);

  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle('📋 每日任務')
    .setDescription(
      (notification ? `${notification}\n\n` : '') +
        '完成任務點下方按鈕領獎 · 每天 UTC+8 凌晨重置',
    );

  const claimRow = new ActionRowBuilder<ButtonBuilder>();

  for (const q of quests) {
    const def = QUEST_DEFS[q.type as QuestType];
    const done = q.progress >= q.target;
    const shown = Math.min(q.progress, q.target);
    const bar = makeProgressBar(Math.floor((shown / q.target) * 100), 10);

    let status: string;
    if (q.claimed) status = '✅ 已領取';
    else if (done) status = '🎁 **完成!可領取**';
    else status = `${bar} ${shown}/${q.target} ${def.unit}`;

    embed.addFields({
      name: `${def.emoji} ${def.label} ${q.target} ${def.unit}`,
      value: `${status}\n獎勵:+${q.goldReward}💰 · +${q.xpReward} XP`,
      inline: false,
    });

    if (done && !q.claimed) {
      claimRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`${CLAIM_PREFIX}${q.id}`)
          .setLabel(`領取:${def.label}`)
          .setEmoji('🎁')
          .setStyle(ButtonStyle.Success),
      );
    }
  }

  const allDone = quests.every((q) => q.claimed);
  if (allDone) {
    embed.setFooter({ text: '🎉 今日任務全部完成!明天再來' });
  }

  const components = claimRow.components.length > 0 ? [claimRow] : [];
  return { embed, components };
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const ui = await buildQuestsUI(interaction.user.id);
  if (!ui) {
    await interaction.reply({
      content: '你還沒建立角色!用 `/start` 開始遊戲。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.reply({ embeds: [ui.embed], components: ui.components });
}

export async function handleButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith(CLAIM_PREFIX)) return false;

  const questId = Number.parseInt(interaction.customId.slice(CLAIM_PREFIX.length), 10);
  const result = await claimQuest(interaction.user.id, questId);

  let notification: string;
  if (!result.ok) {
    notification = `⚠️ ${result.reason}`;
  } else {
    notification =
      `🎁 領取成功!+${result.gold}💰 · +${result.xp} XP` +
      (result.levelsGained > 0 ? `\n🎊 **角色升級!Lv ${result.newLevel}**` : '');
  }

  const ui = await buildQuestsUI(interaction.user.id, notification);
  if (ui) await interaction.update({ embeds: [ui.embed], components: ui.components });
  return true;
}
