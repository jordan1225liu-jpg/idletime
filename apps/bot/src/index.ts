import {
  Client,
  Collection,
  GatewayIntentBits,
  REST,
  Routes,
  type ChatInputCommandInteraction,
  type SlashCommandBuilder,
} from 'discord.js';
import { env, isDev } from './lib/env.js';
import * as pingCommand from './commands/ping.js';

// ─── 指令註冊 ──────────────────────────────────────────────────
interface Command {
  data: SlashCommandBuilder | ReturnType<SlashCommandBuilder['addSubcommand']>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

const commands = new Collection<string, Command>();
commands.set(pingCommand.data.name, pingCommand as Command);

async function registerSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  const body = commands.map((cmd) => cmd.data.toJSON());

  try {
    console.log('📦 註冊 slash commands...');
    if (isDev && env.DISCORD_DEV_GUILD_ID) {
      // Guild commands: 即時更新,適合開發
      await rest.put(
        Routes.applicationGuildCommands(
          env.DISCORD_APPLICATION_ID,
          env.DISCORD_DEV_GUILD_ID,
        ),
        { body },
      );
      console.log(
        `✅ 已註冊 ${body.length} 個 guild commands 到 dev server (${env.DISCORD_DEV_GUILD_ID})`,
      );
    } else {
      // Global commands: 上線用,最多要等 1 小時生效
      await rest.put(Routes.applicationCommands(env.DISCORD_APPLICATION_ID), {
        body,
      });
      console.log(`✅ 已註冊 ${body.length} 個 global commands`);
    }
  } catch (error) {
    console.error('❌ 註冊 slash commands 失敗:', error);
  }
}

// ─── Discord client 設定 ───────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once('clientReady', (readyClient) => {
  console.log(`🤖 已登入 Discord:${readyClient.user.tag}`);
  console.log(`📍 加入 ${readyClient.guilds.cache.size} 個伺服器`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) {
    console.warn(`⚠️ 收到未知指令:${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`❌ 執行 /${interaction.commandName} 出錯:`, error);
    const errorReply = {
      content: '⚠️ 出錯了,請稍後再試。',
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorReply);
    } else {
      await interaction.reply(errorReply);
    }
  }
});

// ─── 啟動流程 ──────────────────────────────────────────────────
async function main() {
  await registerSlashCommands();
  await client.login(env.DISCORD_TOKEN);
}

// 優雅關閉
process.on('SIGINT', () => {
  console.log('\n👋 收到 SIGINT,關閉 bot...');
  client.destroy();
  process.exit(0);
});

main().catch((error) => {
  console.error('💥 啟動失敗:', error);
  process.exit(1);
});
