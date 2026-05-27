import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { prisma } from '@idletime/db';
import {
  EQUIPMENT,
  computeCombatStats,
  equipItem,
  type EquipSlot,
} from '../lib/equipment.js';
import { COLORS } from '../lib/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('equipment')
  .setDescription('⚔️ 查看與切換你的裝備');

const SELECT_PREFIX = 'equip:select:';

async function buildEquipmentUI(userId: string, notification?: string) {
  const character = await prisma.character.findUnique({ where: { userId } });
  if (!character) return null;

  const stats = await computeCombatStats(userId);
  if (!stats) return null;

  // 擁有的裝備(含 equipped 狀態)
  const owned = await prisma.playerEquipment.findMany({
    where: { userId },
    orderBy: { slotId: 'asc' },
  });

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`⚔️ ${character.name} 的裝備`)
    .setDescription(notification ?? '')
    .addFields(
      {
        name: '🎽 已裝備',
        value:
          `🗡️ 武器:${stats.weapon ? `${stats.weapon.emoji} ${stats.weapon.name} (+${stats.weapon.attack} ATK)` : '_無_'}\n` +
          `🛡️ 護甲:${stats.armor ? `${stats.armor.emoji} ${stats.armor.name} (+${stats.armor.defense} DEF)` : '_無_'}`,
        inline: false,
      },
      {
        name: '💪 總戰力',
        value: `⚔️ ATK **${stats.attack.toLocaleString()}**  ·  🛡️ DEF **${stats.defense.toLocaleString()}**  ·  ❤️ HP **${stats.maxHealth.toLocaleString()}**`,
        inline: false,
      },
    );

  const rows: ActionRowBuilder<StringSelectMenuBuilder>[] = [];

  for (const slot of ['weapon', 'armor'] as const) {
    const ownedInSlot = owned
      .filter((o) => o.slotId === slot && EQUIPMENT[o.itemId])
      .map((o) => ({ ...o, eq: EQUIPMENT[o.itemId]! }))
      .sort((a, b) => a.eq.tier - b.eq.tier);

    if (ownedInSlot.length === 0) {
      embed.addFields({
        name: slot === 'weapon' ? '📦 擁有的武器' : '📦 擁有的護甲',
        value: '_尚未擁有,去 `/shop` 買_',
        inline: true,
      });
      continue;
    }

    const lines = ownedInSlot.map(
      (o) => `${o.eq.emoji} ${o.eq.name}${o.equipped ? ' ✅ 裝備中' : ''}`,
    );
    embed.addFields({
      name: slot === 'weapon' ? '📦 擁有的武器' : '📦 擁有的護甲',
      value: lines.join('\n'),
      inline: true,
    });

    // 可切換的(擁有但未裝備)
    const switchable = ownedInSlot.filter((o) => !o.equipped);
    if (switchable.length > 0) {
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`${SELECT_PREFIX}${slot}`)
        .setPlaceholder(slot === 'weapon' ? '🗡️ 換上武器' : '🛡️ 換上護甲');
      for (const o of switchable) {
        const stat: string =
          slot === 'weapon' ? `+${o.eq.attack} ATK` : `+${o.eq.defense} DEF`;
        menu.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(`${o.eq.name} (${stat})`.slice(0, 100))
            .setValue(o.eq.id)
            .setEmoji(o.eq.emoji),
        );
      }
      rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
    }
  }

  return { embed, components: rows };
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const ui = await buildEquipmentUI(interaction.user.id);
  if (!ui) {
    await interaction.reply({
      content: '你還沒建立角色!用 `/start` 開始遊戲。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.reply({ embeds: [ui.embed], components: ui.components });
}

export async function handleSelectMenu(
  interaction: StringSelectMenuInteraction,
): Promise<boolean> {
  if (!interaction.customId.startsWith(SELECT_PREFIX)) return false;

  const equipmentId = interaction.values[0];
  if (!equipmentId) {
    await interaction.deferUpdate();
    return true;
  }

  const result = await equipItem(interaction.user.id, equipmentId);
  const notification = result.ok
    ? `✅ 裝備了 ${result.equipment.emoji} **${result.equipment.name}**`
    : `⚠️ ${result.reason}`;

  const ui = await buildEquipmentUI(interaction.user.id, notification);
  if (ui) await interaction.update({ embeds: [ui.embed], components: ui.components });
  return true;
}
