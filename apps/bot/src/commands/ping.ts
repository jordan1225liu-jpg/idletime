import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('檢查 bot 是否在線、回應延遲多少');

export async function execute(interaction: ChatInputCommandInteraction) {
  const sent = await interaction.reply({
    content: '🏓 測量中...',
    withResponse: true,
  });

  // discord.js v14.16+ uses withResponse instead of fetchReply
  const message = sent.resource?.message;
  const roundtrip = message
    ? message.createdTimestamp - interaction.createdTimestamp
    : 0;
  const wsLatency = Math.round(interaction.client.ws.ping);

  await interaction.editReply(
    `🏓 **Pong!**\n` +
      `• 訊息往返:**${roundtrip}ms**\n` +
      `• WebSocket 心跳:**${wsLatency}ms**\n` +
      `• Bot 已上線 ⏱️ ${formatUptime(interaction.client.uptime ?? 0)}`,
  );
}

function formatUptime(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d} 天 ${h % 24} 小時`;
  if (h > 0) return `${h} 小時 ${m % 60} 分`;
  if (m > 0) return `${m} 分 ${sec % 60} 秒`;
  return `${sec} 秒`;
}
