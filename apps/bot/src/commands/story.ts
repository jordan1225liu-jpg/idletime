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
import { prisma } from '@idletime/db';
import { getCharacter } from '../lib/character.js';
import { COLORS, makeProgressBar } from '../lib/embeds.js';
import { NPCS, TOWN_NAME } from '../lib/npcs.js';
import {
  CAMPAIGN_STEPS,
  claimCurrentStep,
  evaluateObjective,
  getOrCreateProgress,
  getStep,
  type CampaignReward,
  type CampaignStep,
  type ObjectiveStatus,
} from '../lib/campaign.js';

export const data = new SlashCommandBuilder()
  .setName('story')
  .setDescription(`📜 主線劇情 — 跟著 NPC 重建${TOWN_NAME},解鎖新地區`);

const STORY_PREFIX = 'story:';
const TOTAL = CAMPAIGN_STEPS.length;

// ─── 顯示工具 ──────────────────────────────────────────────────

/** 把獎勵解析成可讀文字(查型錄拿物品名)。 */
async function resolveRewardText(reward: CampaignReward): Promise<string> {
  const parts: string[] = [];
  if (reward.gold && reward.gold > 0) parts.push(`💰 ${reward.gold.toLocaleString()}`);
  if (reward.xp && reward.xp > 0) parts.push(`🎯 ${reward.xp.toLocaleString()} XP`);
  if (reward.items && reward.items.length > 0) {
    const items = await prisma.item.findMany({
      where: { id: { in: reward.items.map((i) => i.itemId) } },
    });
    const map = new Map(items.map((i) => [i.id, i]));
    for (const it of reward.items) {
      const meta = map.get(it.itemId);
      parts.push(`${meta?.emoji ?? '📦'}${meta?.name ?? it.itemId} ×${it.quantity}`);
    }
  }
  return parts.length > 0 ? parts.join(' · ') : '(無)';
}

function stepEmbed(step: CampaignStep, status: ObjectiveStatus, rewardText: string): EmbedBuilder {
  const npc = NPCS[step.npc];
  const pct = status.target > 0 ? Math.min(100, Math.floor((status.current / status.target) * 100)) : 100;
  const bar = makeProgressBar(pct, 12);
  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle(`📜 主線・第 ${step.step}/${TOTAL} 章:${step.title}`)
    .setDescription(`${npc.emoji} **${npc.title} ${npc.name}**\n\n${step.narrative}`)
    .addFields(
      {
        name: '🎯 目標',
        value: `${status.label}\n${bar} ${status.current.toLocaleString()}/${status.target.toLocaleString()}${status.met ? ' ✅' : ''}`,
        inline: false,
      },
      { name: '🎁 完成獎勵', value: rewardText, inline: false },
    );
  embed.setFooter({
    text: status.met ? '目標達成!點下方按鈕領取獎勵並繼續' : `達成目標後回來打 /story 領取`,
  });
  return embed;
}

function allDoneEmbed(): EmbedBuilder {
  const mayor = NPCS.mayor;
  return new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle('🏆 主線劇情・全部完成!')
    .setDescription(
      `${mayor.emoji} **${mayor.title} ${mayor.name}**\n\n` +
        `「${TOWN_NAME}因你而重生 —— 但更大的世界正在等你。」\n\n` +
        `你已完成目前所有 ${TOTAL} 章主線。新的篇章正在路上,敬請期待 ✨`,
    )
    .setFooter({ text: '感謝你陪這座小鎮走到這裡 ❤️' });
}

function claimRow(step: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${STORY_PREFIX}claim:${step}`)
      .setLabel('領取獎勵並繼續')
      .setEmoji('▶️')
      .setStyle(ButtonStyle.Success),
  );
}

/** 算出目前要顯示的畫面(embed + 是否該給領取鈕)。 */
async function renderCurrent(
  userId: string,
): Promise<{ embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] }> {
  const progress = await getOrCreateProgress(userId);
  if (progress.currentStep > TOTAL) {
    return { embeds: [allDoneEmbed()], components: [] };
  }
  const step = getStep(progress.currentStep)!;
  const status = await evaluateObjective(userId, step.objective);
  const rewardText = await resolveRewardText(step.reward);
  return {
    embeds: [stepEmbed(step, status, rewardText)],
    components: status.met ? [claimRow(step.step)] : [],
  };
}

// ─── 指令 ──────────────────────────────────────────────────────

export async function execute(interaction: ChatInputCommandInteraction) {
  const character = await getCharacter(interaction.user.id);
  if (!character) {
    await interaction.reply({ content: '你還沒建立角色!用 `/start`', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const view = await renderCurrent(interaction.user.id);
  await interaction.editReply(view);
}

export async function handleButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith(STORY_PREFIX)) return false;
  // customId 形如 "story:claim:<step>"。step 只是裝飾,實際以 DB 的 currentStep 為準。
  const action = interaction.customId.slice(STORY_PREFIX.length).split(':')[0];
  if (action !== 'claim') return false;

  // 領獎會寫 DB(金幣/物品/推進),先 deferUpdate 取得 ack
  await interaction.deferUpdate();
  const result = await claimCurrentStep(interaction.user.id);

  const embeds: EmbedBuilder[] = [];
  if (result.ok) {
    const npc = NPCS[result.completed.npc];
    const gained: string[] = [];
    if (result.grantedGold > 0) gained.push(`💰 ${result.grantedGold.toLocaleString()}`);
    for (const g of result.grantedItems) gained.push(`${g.emoji}${g.name} ×${g.quantity}`);
    embeds.push(
      new EmbedBuilder()
        .setColor(COLORS.GREEN)
        .setTitle(`✅ 第 ${result.completed.step} 章完成:${result.completed.title}`)
        .setDescription(
          `${npc.emoji} **${npc.title} ${npc.name}** 向你道謝!\n\n` +
            `🎁 獲得:${gained.length > 0 ? gained.join(' · ') : '(無)'}`,
        ),
    );
  }

  // 接著顯示下一章(或全部完成)
  const view = await renderCurrent(interaction.user.id);
  embeds.push(...view.embeds);

  if (!result.ok) {
    await interaction.followUp({ content: `⚠️ ${result.reason}`, flags: MessageFlags.Ephemeral });
  }
  await interaction.editReply({ embeds, components: view.components });
  return true;
}
