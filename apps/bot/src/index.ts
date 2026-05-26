import {
  Client,
  Collection,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
} from 'discord.js';
import { env, isDev } from './lib/env.js';
import { commands, type Command } from './commands/index.js';

// ─── 指令註冊 ──────────────────────────────────────────────────
const commandMap = new Collection<string, Command>();
for (const cmd of commands) {
  commandMap.set(cmd.data.name, cmd);
}

async function registerSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  const body = commands.map((cmd) => cmd.data.toJSON());

  try {
    console.log(`📦 註冊 ${body.length} 個 slash commands...`);
    if (isDev && env.DISCORD_DEV_GUILD_ID) {
      // Guild commands:即時更新,適合開發
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
      // Global commands:上線用,最多要等 1 小時生效
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
  try {
    if (interaction.isChatInputCommand()) {
      const command = commandMap.get(interaction.commandName);
      if (!command) {
        console.warn(`⚠️ 收到未知指令:${interaction.commandName}`);
        return;
      }
      await command.execute(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      // 依序問每個 command 是否處理此 modal,直到有人接手
      for (const cmd of commands) {
        if (!cmd.handleModalSubmit) continue;
        const handled = await cmd.handleModalSubmit(interaction);
        if (handled) return;
      }
      console.warn(`⚠️ 沒有 handler 處理 modal: ${interaction.customId}`);
      return;
    }
  } catch (error) {
    console.error('❌ interaction 處理失敗:', error);
    const errorReply = {
      content: '⚠️ 出錯了,請稍後再試。',
      flags: MessageFlags.Ephemeral,
    } as const;
    try {
      if (interaction.isRepliable()) {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorReply);
        } else {
          await interaction.reply(errorReply);
        }
      }
    } catch (e) {
      console.error('  也回應失敗:', e);
    }
  }
});

// ─── 啟動 ───────────────────────────────────────────────────────
async function main() {
  await registerSlashCommands();
  await client.login(env.DISCORD_TOKEN);
}

process.on('SIGINT', () => {
  console.log('\n👋 收到 SIGINT,關閉 bot...');
  client.destroy();
  process.exit(0);
});

main().catch((error) => {
  console.error('💥 啟動失敗:', error);
  process.exit(1);
});
