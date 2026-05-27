import {
  Client,
  Collection,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  type Client as ClientType,
} from 'discord.js';
import { env, isDev } from './lib/env.js';
import { commands, type Command } from './commands/index.js';
import { notifyUnreadMail } from './lib/mailNotify.js';

/** 這些指令執行後不提示未讀信件(自己就是信箱 / 純工具 / 管理指令)。 */
const MAIL_NOTIFY_SKIP = new Set(['mail', 'mailsend', 'help', 'ping']);

// ─── 指令查找表 ────────────────────────────────────────────────
const commandMap = new Collection<string, Command>();
for (const cmd of commands) {
  commandMap.set(cmd.data.name, cmd);
}

// ─── Slash command 註冊邏輯 ────────────────────────────────────
const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
const commandBody = commands.map((cmd) => cmd.data.toJSON());

/**
 * 註冊策略:
 * 1. 若有指定 DISCORD_DEV_GUILD_ID → 只註冊那個 guild(單一測試伺服器模式)
 * 2. 否則開發模式 → 註冊到 bot 已加入的所有 guild + 監聽 guildCreate 自動補
 * 3. 正式上線 → 註冊 global commands(最多 1 小時生效)
 */
async function registerSlashCommands(client: ClientType<true>) {
  if (env.DISCORD_DEV_GUILD_ID) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(
          env.DISCORD_APPLICATION_ID,
          env.DISCORD_DEV_GUILD_ID,
        ),
        { body: commandBody },
      );
      console.log(
        `✅ 註冊 ${commandBody.length} 個 commands 到指定 dev guild (${env.DISCORD_DEV_GUILD_ID})`,
      );
    } catch (e) {
      console.error(`❌ 註冊 dev guild 失敗:`, e);
    }
    return;
  }

  if (isDev) {
    const guilds = client.guilds.cache;
    console.log(
      `📦 註冊 ${commandBody.length} 個 commands 到 ${guilds.size} 個伺服器...`,
    );
    for (const [guildId, guild] of guilds) {
      try {
        await rest.put(
          Routes.applicationGuildCommands(env.DISCORD_APPLICATION_ID, guildId),
          { body: commandBody },
        );
        console.log(`  ✓ ${guild.name} (${guildId})`);
      } catch (e) {
        console.error(`  ✗ ${guild.name}:`, e);
      }
    }
    return;
  }

  // 正式上線:全局註冊
  try {
    await rest.put(Routes.applicationCommands(env.DISCORD_APPLICATION_ID), {
      body: commandBody,
    });
    console.log(`✅ 註冊 ${commandBody.length} 個 global commands(最多 1 小時生效)`);
  } catch (e) {
    console.error('❌ 註冊 global commands 失敗:', e);
  }
}

/** Bot 加入新 guild 時,自動把 commands 註冊到那個 guild(僅 dev + 未指定單 guild 時) */
async function autoRegisterOnGuildJoin(guildId: string, guildName: string) {
  if (env.DISCORD_DEV_GUILD_ID || !isDev) return; // 用單 guild 或 prod 模式則跳過
  try {
    await rest.put(
      Routes.applicationGuildCommands(env.DISCORD_APPLICATION_ID, guildId),
      { body: commandBody },
    );
    console.log(`  ✓ 已自動註冊 ${commandBody.length} commands 到 ${guildName}`);
  } catch (e) {
    console.error(`  ✗ 自動註冊失敗 (${guildName}):`, e);
  }
}

// ─── Discord client 設定 ───────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once('clientReady', async (readyClient) => {
  console.log(`🤖 已登入 Discord:${readyClient.user.tag}`);
  console.log(`📍 目前在 ${readyClient.guilds.cache.size} 個伺服器`);
  await registerSlashCommands(readyClient);
});

client.on('guildCreate', async (guild) => {
  console.log(`📥 加入新伺服器:${guild.name} (${guild.id})`);
  await autoRegisterOnGuildJoin(guild.id, guild.name);
});

client.on('guildDelete', (guild) => {
  console.log(`📤 離開伺服器:${guild.name} (${guild.id})`);
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
      // 動作完成後:有未讀信件就提示(頻道 ephemeral + 每波一次私訊)
      if (!MAIL_NOTIFY_SKIP.has(interaction.commandName)) {
        await notifyUnreadMail(interaction);
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      for (const cmd of commands) {
        if (!cmd.handleModalSubmit) continue;
        const handled = await cmd.handleModalSubmit(interaction);
        if (handled) return;
      }
      console.warn(`⚠️ 沒有 handler 處理 modal: ${interaction.customId}`);
      return;
    }

    if (interaction.isButton()) {
      for (const cmd of commands) {
        if (!cmd.handleButton) continue;
        const handled = await cmd.handleButton(interaction);
        if (handled) return;
      }
      console.warn(`⚠️ 沒有 handler 處理 button: ${interaction.customId}`);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      for (const cmd of commands) {
        if (!cmd.handleSelectMenu) continue;
        const handled = await cmd.handleSelectMenu(interaction);
        if (handled) return;
      }
      console.warn(`⚠️ 沒有 handler 處理 select menu: ${interaction.customId}`);
      return;
    }

    if (interaction.isAutocomplete()) {
      // Autocomplete 只給對應 commandName 的 command
      for (const cmd of commands) {
        if (!cmd.handleAutocomplete) continue;
        if (interaction.commandName !== cmd.data.name) continue;
        const handled = await cmd.handleAutocomplete(interaction);
        if (handled) return;
      }
      // 沒人處理就回空清單(避免 Discord 顯示「正在搜尋...」永久)
      await interaction.respond([]);
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
process.on('SIGINT', () => {
  console.log('\n👋 收到 SIGINT,關閉 bot...');
  client.destroy();
  process.exit(0);
});

client.login(env.DISCORD_TOKEN).catch((error) => {
  console.error('💥 登入失敗:', error);
  process.exit(1);
});
