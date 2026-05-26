import {
  SlashCommandBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { ensureGuildContext, getCharacter } from '../lib/character.js';
import { buildCharacterEmbed } from '../lib/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('me')
  .setDescription('🛡️ 查看你的角色面板');

export async function execute(interaction: ChatInputCommandInteraction) {
  const character = await getCharacter(interaction.user.id);

  if (!character) {
    await interaction.reply({
      content: '你還沒建立角色!用 `/start` 開始遊戲。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 如果在新的 Discord 伺服器,更新 activeGuild context
  if (interaction.guildId && interaction.guild) {
    if (character.activeGuildId !== interaction.guildId) {
      await ensureGuildContext({
        userId: interaction.user.id,
        guildId: interaction.guildId,
        guildName: interaction.guild.name,
      });
      // 重抓更新後的角色
      const refreshed = await getCharacter(interaction.user.id);
      if (refreshed) {
        await interaction.reply({ embeds: [buildCharacterEmbed(refreshed)] });
        return;
      }
    }
  }

  await interaction.reply({ embeds: [buildCharacterEmbed(character)] });
}
