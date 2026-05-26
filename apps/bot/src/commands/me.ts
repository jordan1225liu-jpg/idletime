import {
  SlashCommandBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { ensureGuildContext } from '../lib/character.js';
import { settleEnergy } from '../lib/energy.js';
import { buildCharacterEmbed } from '../lib/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('me')
  .setDescription('🛡️ 查看你的角色面板');

export async function execute(interaction: ChatInputCommandInteraction) {
  // 1. 先 settle 體力(就算只是純查看也要,因為玩家想看到最新數字)
  let character = await settleEnergy(interaction.user.id);

  if (!character) {
    await interaction.reply({
      content: '你還沒建立角色!用 `/start` 開始遊戲。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 2. 如果換到別的 Discord 伺服器,更新 active guild
  if (
    interaction.guildId &&
    interaction.guild &&
    character.activeGuildId !== interaction.guildId
  ) {
    await ensureGuildContext({
      userId: interaction.user.id,
      guildId: interaction.guildId,
      guildName: interaction.guild.name,
    });
    // 重抓一次拿到新的 activeGuild
    character = (await settleEnergy(interaction.user.id)) ?? character;
  }

  await interaction.reply({ embeds: [buildCharacterEmbed(character)] });
}
