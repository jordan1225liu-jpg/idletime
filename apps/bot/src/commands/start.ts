import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';
import { createCharacter, getCharacter } from '../lib/character.js';
import { buildCharacterEmbed, buildPrologueEmbed, buildWelcomeEmbed } from '../lib/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('start')
  .setDescription('🌿 開始你的 idletime 冒險(第一次玩請用這個)');

const MODAL_ID = 'start:character-name';
const NAME_INPUT_ID = 'characterName';

export async function execute(interaction: ChatInputCommandInteraction) {
  const existing = await getCharacter(interaction.user.id);
  if (existing) {
    await interaction.reply({
      content: `你已經有角色了:**${existing.name}** (Lv ${existing.level})。\n用 \`/me\` 看你的資料。`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 跳出 modal 讓玩家取名
  const modal = new ModalBuilder().setCustomId(MODAL_ID).setTitle('🌿 建立你的角色');

  const nameInput = new TextInputBuilder()
    .setCustomId(NAME_INPUT_ID)
    .setLabel('幫你的角色取個名字')
    .setStyle(TextInputStyle.Short)
    .setMinLength(2)
    .setMaxLength(16)
    .setPlaceholder('例如:伊森、小琳、Aragorn')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
  );

  await interaction.showModal(modal);
}

/** Modal submit 處理。回傳 true 表示有處理,false 表示 customId 不符,讓其他 handler 處理 */
export async function handleModalSubmit(
  interaction: ModalSubmitInteraction,
): Promise<boolean> {
  if (interaction.customId !== MODAL_ID) return false;

  const name = interaction.fields.getTextInputValue(NAME_INPUT_ID).trim();
  const guildId = interaction.guildId;
  const guild = interaction.guild;

  if (!guildId || !guild) {
    await interaction.reply({
      content: '⚠️ 請在 Discord 伺服器中使用(不能在 DM 私訊)。',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  // 名稱基本驗證(Discord modal 已經有 length 限制,這裡再 trim 一次)
  if (name.length < 2) {
    await interaction.reply({
      content: '⚠️ 名字太短,至少需要 2 個字。',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  // 防止 race condition:有可能玩家在 modal 開著時用其他指令建了角色
  const existing = await getCharacter(interaction.user.id);
  if (existing) {
    await interaction.reply({
      content: `你已經有角色了 (${existing.name})!用 \`/me\` 看你的資料。`,
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  await interaction.deferReply();

  try {
    const character = await createCharacter({
      userId: interaction.user.id,
      discordUsername: interaction.user.username,
      characterName: name,
      guildId,
      guildName: guild.name,
    });

    await interaction.editReply({
      embeds: [buildPrologueEmbed(name), buildWelcomeEmbed(name), buildCharacterEmbed(character)],
    });
  } catch (error) {
    console.error('createCharacter failed:', error);
    await interaction.editReply({
      content: '⚠️ 建立角色失敗,請稍後再試(或回報 bug)。',
    });
  }

  return true;
}
