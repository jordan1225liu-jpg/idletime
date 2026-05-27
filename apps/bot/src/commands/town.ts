import {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { COLORS } from '../lib/embeds.js';
import { NPCS, TOWN_NAME } from '../lib/npcs.js';

export const data = new SlashCommandBuilder()
  .setName('town')
  .setDescription(`🏘️ 認識${TOWN_NAME}的居民`);

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`🏘️ ${TOWN_NAME}`)
    .setDescription(
      `一座曾經繁榮、如今正在重建的邊境小鎮。炊煙重新升起,居民們各司其職,等著你一起讓它復甦。\n` +
        `\n用 \`/story\` 跟著他們踏上重建${TOWN_NAME}的旅程。`,
    );

  for (const npc of Object.values(NPCS)) {
    embed.addFields({
      name: `${npc.emoji} ${npc.title} ${npc.name}`,
      value: npc.blurb,
      inline: false,
    });
  }

  embed.setFooter({ text: '更多居民會隨著小鎮成長而加入…' });
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
