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
  equipmentBySlot,
  getOwnedEquipmentIds,
  buyEquipment,
  type EquipSlot,
} from '../lib/equipment.js';
import { COLORS } from '../lib/embeds.js';
import { assetUrl } from '../lib/assets.js';

export const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('🏪 鐵匠鋪 — 買武器與護甲');

const SELECT_PREFIX = 'shop:buy:';

function statLabel(slot: EquipSlot, atk: number, def: number): string {
  return slot === 'weapon' ? `+${atk} ATK` : `+${def} DEF`;
}

async function buildShopUI(userId: string, notification?: string) {
  const character = await prisma.character.findUnique({ where: { userId } });
  if (!character) return null;

  const owned = await getOwnedEquipmentIds(userId);

  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle('🏪 鐵匠鋪')
    .setDescription(
      `💰 你的金幣:**${character.gold.toLocaleString()}**` +
        (notification ? `\n\n${notification}` : ''),
    );
  // 鐵匠鋪場景圖 + 鐵匠博林肖像
  const banner = assetUrl('activities/shop');
  if (banner) embed.setImage(banner);
  const npcImg = assetUrl('npcs/borin');
  if (npcImg) embed.setThumbnail(npcImg);

  const rows: ActionRowBuilder<StringSelectMenuBuilder>[] = [];

  for (const slot of ['weapon', 'armor'] as const) {
    const items = equipmentBySlot(slot);
    const lines = items.map((e) => {
      const stat = statLabel(slot, e.attack, e.defense);
      let status = '🆕';
      if (owned.has(e.id)) status = '✅ 已擁有';
      else if (character.gold < e.price) status = '🔒 金幣不足';
      return `${e.emoji} **${e.name}** ${stat} · ${e.price.toLocaleString()}💰 ${status}`;
    });
    embed.addFields({
      name: slot === 'weapon' ? '⚔️ 武器' : '🛡️ 護甲',
      value: lines.join('\n'),
      inline: false,
    });

    // 只把「還沒擁有」的放進可購買 select menu
    const buyable = items.filter((e) => !owned.has(e.id));
    if (buyable.length > 0) {
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`${SELECT_PREFIX}${slot}`)
        .setPlaceholder(slot === 'weapon' ? '⚔️ 選擇要買的武器' : '🛡️ 選擇要買的護甲');
      for (const e of buyable) {
        const affordable = character.gold >= e.price;
        menu.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(`${e.name} (${statLabel(slot, e.attack, e.defense)})`.slice(0, 100))
            .setValue(e.id)
            .setEmoji(e.emoji)
            .setDescription(
              `${e.price.toLocaleString()}💰${affordable ? '' : ' ⚠️金幣不足'}`.slice(0, 100),
            ),
        );
      }
      rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
    }
  }

  return { embed, components: rows };
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const ui = await buildShopUI(interaction.user.id);
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

  const result = await buyEquipment(interaction.user.id, equipmentId);
  let notification: string;
  if (!result.ok) {
    notification = `⚠️ ${result.reason}`;
  } else {
    const eq = result.equipment;
    notification =
      `✅ 購買 ${eq.emoji} **${eq.name}**!花費 ${eq.price.toLocaleString()}💰` +
      (result.autoEquipped ? '(已自動裝備)' : '(用 /equipment 裝備)');
  }

  const ui = await buildShopUI(interaction.user.id, notification);
  if (ui) await interaction.update({ embeds: [ui.embed], components: ui.components });
  return true;
}
