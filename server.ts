import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Client, GatewayIntentBits, Partials, ChannelType, TextChannel } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Path to persist local bot database (mappings, logs, config)
const DB_DIR = path.join(process.cwd(), "src", "data");
const DB_FILE = path.join(DB_DIR, "db.json");

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// In-memory fallback and state cache
interface DbState {
  config: {
    token: string;
    channel: string;
    botEnabled?: boolean;
  };
  guildChannels?: Record<string, string>;
  mappings: Array<{
    userId: string;
    userTag: string;
    anonId: string;
    createdAt: string;
    lastActive: string;
    activeGuildId?: string;
  }>;
  messages: Array<{
    id: string;
    timestamp: string;
    anonId: string;
    content: string;
    isSimulated?: boolean;
    userTag?: string;
  }>;
}

const defaultDbState: DbState = {
  config: {
    token: process.env.DISCORD_TOKEN || "",
    channel: process.env.DISCORD_CHANNEL || "r1gi-ngl",
    botEnabled: true,
  },
  guildChannels: {},
  mappings: [],
  messages: [],
};

let db: DbState = { ...defaultDbState };

// Load database from file if exists
function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(data);
      db = {
        config: {
          token: parsed.config?.token || process.env.DISCORD_TOKEN || "",
          channel: parsed.config?.channel || process.env.DISCORD_CHANNEL || "r1gi-ngl",
          botEnabled: parsed.config?.botEnabled !== undefined ? parsed.config.botEnabled : true,
        },
        guildChannels: parsed.guildChannels || {},
        mappings: parsed.mappings || [],
        messages: parsed.messages || [],
      };
    }
  } catch (err) {
    console.error("Error loading db.json, using defaults:", err);
  }
}

// Save database to file
function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing to db.json:", err);
  }
}

loadDb();

// Express Body Parsers
app.use(express.json());

// Cooldown engine to prevent spam from users
// Spam protection is disabled / bypassed as per user request ("spam no protection")
function checkSpam(userId: string): { isSpam: boolean; waitSeconds?: number } {
  // Always return false to allow unlimited confessions
  return { isSpam: false };
}

// Discord Bot Instance
let discordClient: Client | null = null;
let botStatus: "connected" | "disconnected" | "connecting" | "error" = "disconnected";
let lastError: string | null = null;

// Initialize or Reconnect Discord Bot
async function initDiscordBot() {
  // If we already have a client, destroy it first to avoid duplicate listeners
  if (discordClient) {
    try {
      discordClient.destroy();
    } catch (e) {
      console.error("Error destroying existing bot client:", e);
    }
    discordClient = null;
  }

  if (db.config.botEnabled === false) {
    botStatus = "disconnected";
    lastError = "Bot connection is disabled on the dashboard.";
    console.log("Discord Bot: Bot connection is disabled on the dashboard.");
    return;
  }

  const token = db.config.token;
  if (!token || token === "YOUR_DISCORD_BOT_TOKEN") {
    botStatus = "disconnected";
    lastError = "Discord Token is empty or not configured. Please supply a valid bot token.";
    console.log("Discord Bot: Waiting for a valid token...");
    return;
  }

  botStatus = "connecting";
  lastError = null;

  try {
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel, Partials.Message, Partials.User],
    });

    discordClient.on("ready", () => {
      botStatus = "connected";
      lastError = null;
      console.log(`Discord Bot: Logged in successfully as ${discordClient?.user?.tag}`);
    });

    discordClient.on("error", (err) => {
      console.error("Discord Bot error event:", err);
      botStatus = "error";
      lastError = err.message;
    });

    // Main DM Anonymous Forwarding and Guild Commands logic
    discordClient.on("messageCreate", async (message) => {
      // Ignore bot messages to prevent infinite loops or spam
      if (message.author.bot) return;

      // Check if message is a Direct Message (DM)
      const isDM = message.channel.type === ChannelType.DM || !message.guild;

      if (isDM) {
        console.log(`Discord Bot: Received DM from ${message.author.tag} (${message.author.id}): ${message.content}`);

        try {
          // 1. Resolve or assign ANON ID
          let mapping = db.mappings.find((m) => m.userId === message.author.id);
          if (!mapping) {
            const nextIndex = db.mappings.length + 1;
            const anonId = `ANON${String(nextIndex).padStart(4, "0")}`;
            mapping = {
              userId: message.author.id,
              userTag: message.author.tag,
              anonId,
              createdAt: new Date().toISOString(),
              lastActive: new Date().toISOString(),
            };
            db.mappings.push(mapping);
          } else {
            mapping.lastActive = new Date().toISOString();
          }

          // Fetch mutual guilds sharing this bot with the user
          const mutualGuilds: any[] = [];
          for (const [_, guild] of discordClient!.guilds.cache) {
            const member = await guild.members.fetch(message.author.id).catch(() => null);
            if (member) {
              mutualGuilds.push(guild);
            }
          }

          const rawContent = message.content.trim();
          const lowerRaw = rawContent.toLowerCase();

          // Handle ?status and ?info commands in DM
          if (lowerRaw === "?status" || lowerRaw === "!status" || lowerRaw === "?info" || lowerRaw === "!info") {
            if (lowerRaw.includes("status")) {
              const latency = discordClient?.ws.ping ?? 0;
              const guildsCount = discordClient?.guilds.cache.size ?? 0;
              const uptimeSeconds = Math.floor(process.uptime());
              const hours = Math.floor(uptimeSeconds / 3600);
              const minutes = Math.floor((uptimeSeconds % 3600) / 60);
              const seconds = uptimeSeconds % 60;
              
              await message.channel.send({
                content: `🟢 **Bot Status:**\n` +
                         `• **Latency:** \`${latency}ms\`\n` +
                         `• **Active Servers:** \`${guildsCount}\`\n` +
                         `• **Uptime:** \`${hours}h ${minutes}m ${seconds}s\`\n\n` +
                         `*Watermark: Created by Rohan #bralex11*`
              });
            } else {
              await message.channel.send({
                content: `ℹ️ **R1gi NGL Discord Bot Info:**\n` +
                         `This bot allows members to send completely anonymous confessions/messages directly to designated server channels.\n\n` +
                         `**How to use:**\n` +
                         `1. Send any direct message (DM) to this bot.\n` +
                         `2. The bot will automatically forward it anonymously to the configured channel in your shared server.\n` +
                         `3. If you share multiple servers, use \`/select\` in DM to switch servers.\n\n` +
                         `**Commands:**\n` +
                         `• \`?status\` - View bot status & uptime\n` +
                         `• \`?info\` - View info and usage\n` +
                         `• \`/select\` - Select server (DM only) or confession channel (Server only)\n\n` +
                         `*Watermark: Created by Rohan #bralex11*`
              });
            }
            return;
          }

          // Check if DM is a configuration command (/select, /server, !select, !server)
          if (
            lowerRaw.startsWith("/select") || 
            lowerRaw.startsWith("/server") ||
            lowerRaw.startsWith("!select") || 
            lowerRaw.startsWith("!server")
          ) {
            if (mutualGuilds.length === 0) {
              await message.channel.send({
                content: "❌ **Error:** You do not share any servers with this bot. Please join a server where the bot is installed!",
              });
              return;
            }

            const args = rawContent.split(/\s+/).slice(1);
            if (args.length === 0) {
              // List shared servers and their active confession channels
              const list = mutualGuilds.map((g, idx) => {
                const targetCh = db.guildChannels?.[g.id] || db.config.channel || "r1gi-ngl";
                const isCurrent = mapping.activeGuildId === g.id ? " (⭐ Active)" : "";
                return `**${idx + 1}. ${g.name}**${isCurrent}\n   • Confession Channel: \`#${targetCh}\``;
              }).join("\n\n");

              await message.channel.send({
                content: `🌐 **Select Confession Server:**\nYou share **${mutualGuilds.length}** servers with this bot. Your confessions will go to whichever server is currently active.\n\n${list}\n\nTo switch servers, reply in this DM with:\n\`\`\`\n/select <number>\n\`\`\`\n*(e.g., \`/select 1\` to set the first server as active)*`,
              });
              return;
            }

            // User provided an argument to select server index or name
            const selection = parseInt(args[0], 10);
            if (!isNaN(selection) && selection >= 1 && selection <= mutualGuilds.length) {
              const chosenGuild = mutualGuilds[selection - 1];
              mapping.activeGuildId = chosenGuild.id;
              saveDb();
              await message.channel.send({
                content: `🎯 **Active Server Selected!** All your future anonymous confessions will now be sent to **${chosenGuild.name}**.`,
              });
              return;
            } else {
              // Try searching by server name (case insensitive match)
              const searchName = args.join(" ").toLowerCase();
              const chosenGuild = mutualGuilds.find((g) => g.name.toLowerCase().includes(searchName));
              if (chosenGuild) {
                mapping.activeGuildId = chosenGuild.id;
                saveDb();
                await message.channel.send({
                  content: `🎯 **Active Server Selected!** All your future anonymous confessions will now be sent to **${chosenGuild.name}**.`,
                });
                return;
              } else {
                await message.channel.send({
                  content: `❌ **Invalid Selection:** Please enter a valid server number or part of its name. Type \`/select\` to see the list of available servers.`,
                });
                return;
              }
            }
          }

          // 2. Validate empty message loophole
          const hasContent = !!(message.content && message.content.trim());
          const hasAttachments = message.attachments.size > 0;
          if (!hasContent && !hasAttachments) {
            await message.channel.send({
              content: "⚠️ **Empty Message:** Please provide some text content or an attachment to confess! White spaces are ignored.",
            });
            return;
          }

          // 3. Resolve destination guild
          if (mutualGuilds.length === 0) {
            await message.channel.send({
              content: "⚠️ **No Shared Servers:** You do not share any servers with this bot. Please join a server where the bot is installed first!",
            });
            return;
          }

          let targetGuild = null;
          if (mapping.activeGuildId) {
            targetGuild = mutualGuilds.find((g) => g.id === mapping.activeGuildId);
          }

          // Fallback: If only sharing one mutual guild, auto-select it
          if (!targetGuild) {
            if (mutualGuilds.length === 1) {
              targetGuild = mutualGuilds[0];
              mapping.activeGuildId = targetGuild.id;
              saveDb();
            } else {
              // Share multiple guilds but none is active yet, prompt to choose
              const list = mutualGuilds.map((g, idx) => `**${idx + 1}. ${g.name}**`).join("\n");
              await message.channel.send({
                content: `🌐 **Select Target Server:**\nYou share **${mutualGuilds.length}** servers with this bot. Please specify where your anonymous confession should be delivered by replying in this DM with:\n\`\`\`\n/select <number>\n\`\`\`\n**Available servers:**\n${list}`,
              });
              return;
            }
          }

          // 4. Resolve destination channel inside the target guild
          const guildConfiguredChannel = db.guildChannels?.[targetGuild.id] || db.config.channel || "r1gi-ngl";
          let channelFound: TextChannel | null = null;

          // Fetch all channels in the guild to ensure the cache is fully populated (highly recommended for serverless/ephemeral environments like Render)
          try {
            await targetGuild.channels.fetch();
          } catch (fetchChannelsErr) {
            console.warn(`Could not fetch all channels for guild ${targetGuild.name}:`, fetchChannelsErr);
          }

          // Attempt to find channel by ID or name
          let ch = null;

          // If the configured channel is a numeric ID, fetch it directly from the Discord API for maximum reliability
          if (/^\d+$/.test(guildConfiguredChannel)) {
            try {
              ch = await targetGuild.channels.fetch(guildConfiguredChannel);
            } catch (fetchErr) {
              console.warn(`Could not fetch channel by ID ${guildConfiguredChannel} via API, trying cache lookup...`);
            }
          }

          if (!ch) {
            ch = targetGuild.channels.cache.get(guildConfiguredChannel);
          }

          if (!ch) {
            // Otherwise search cache by name (case-insensitive)
            ch = targetGuild.channels.cache.find(
              (c) =>
                c.type === ChannelType.GuildText &&
                (c.name.toLowerCase() === guildConfiguredChannel.toLowerCase() ||
                  c.name.toLowerCase() === guildConfiguredChannel.toLowerCase().replace(/^#/, ""))
            );
          }

          if (ch && ch.type === ChannelType.GuildText) {
            channelFound = ch as TextChannel;
          }

          // 5. Prepare forward content
          let forwardText = `**${mapping.anonId}** :- ${message.content || ""}`;
          
          if (hasAttachments) {
            const attachmentUrls = message.attachments.map((a) => a.url).join("\n");
            forwardText += `\n[Attachments]:\n${attachmentUrls}`;
          }

          if (forwardText.length > 1950) {
            forwardText = forwardText.substring(0, 1920) + "... [Truncated due to length limit]";
          }

          if (channelFound) {
            await channelFound.send({ content: forwardText });
            console.log(`Discord Bot: Forwarded message to guild "${targetGuild.name}" channel #${channelFound.name} (${channelFound.id})`);
            
            // Add message to internal dashboard logs
            db.messages.unshift({
              id: message.id,
              timestamp: new Date().toISOString(),
              anonId: mapping.anonId,
              content: `[To ${targetGuild.name} #${channelFound.name}] ${message.content || "[Media/Attachment]"}`,
              userTag: message.author.tag,
            });

            if (db.messages.length > 100) {
              db.messages = db.messages.slice(0, 100);
            }
            saveDb();

            await message.channel.send({
              content: `✨ **Anonymous confession forwarded!** Your message was sent to **${targetGuild.name}** anonymously as **${mapping.anonId}**.\n\nKeep confessions coming! 🤫`,
            });
          } else {
            console.warn(`Discord Bot: Target channel "${guildConfiguredChannel}" was not found in guild "${targetGuild.name}".`);
            
            db.messages.unshift({
              id: "err_" + Date.now(),
              timestamp: new Date().toISOString(),
              anonId: mapping.anonId,
              content: `⚠️ (Failed to forward to ${targetGuild.name} #${guildConfiguredChannel} - Channel not found) Message: ${message.content || "[Media/Attachment]"}`,
              userTag: message.author.tag,
            });
            saveDb();

            // Find all text channels that the bot actually has access to see
            const visibleTextChannels = targetGuild.channels.cache
              .filter((c) => c.type === ChannelType.GuildText)
              .map((c) => `• \`#${c.name}\` (ID: \`${c.id}\`)`)
              .slice(0, 10);

            let helpMsg = `⚠️ **Delivery Failed:** The bot is online, but the target channel \`#${guildConfiguredChannel}\` does not exist, or the bot lacks permissions to read/write in it inside server **${targetGuild.name}**.\n\n`;
            if (visibleTextChannels.length > 0) {
              helpMsg += `📋 **Channels the bot can currently see in "${targetGuild.name}":**\n${visibleTextChannels.join("\n")}\n\n`;
              helpMsg += `💡 *To fix this, please make sure the bot has "View Channel" and "Send Messages" permissions in your preferred channel, or configure the bot to forward to one of the visible channels listed above.*`;
            } else {
              helpMsg += `💡 *Please make sure the bot has "View Channel" and "Send Messages" permissions for at least one text channel in your server.*`;
            }

            await message.channel.send({
              content: helpMsg,
            });
          }

        } catch (forwardErr) {
          console.error("Error processing forwarded message:", forwardErr);
          try {
            await message.channel.send({
              content: "❌ Sorry, an error occurred while trying to forward your anonymous message. Please notify the administrator.",
            });
          } catch (replyErr) {
            console.error("Could not reply to DM:", replyErr);
          }
        }
      } else {
        // Handle Server commands: /select, !select, ?status, ?info, !status, !info
        const content = message.content.trim();
        const lowerContent = content.toLowerCase();

        // Handle ?status and ?info commands in Server
        if (lowerContent === "?status" || lowerContent === "!status" || lowerContent === "?info" || lowerContent === "!info") {
          try {
            if (lowerContent.includes("status")) {
              const latency = discordClient?.ws.ping ?? 0;
              const guildsCount = discordClient?.guilds.cache.size ?? 0;
              const uptimeSeconds = Math.floor(process.uptime());
              const hours = Math.floor(uptimeSeconds / 3600);
              const minutes = Math.floor((uptimeSeconds % 3600) / 60);
              const seconds = uptimeSeconds % 60;
              
              await message.reply({
                content: `🟢 **Bot Status:**\n` +
                         `• **Latency:** \`${latency}ms\`\n` +
                         `• **Active Servers:** \`${guildsCount}\`\n` +
                         `• **Uptime:** \`${hours}h ${minutes}m ${seconds}s\`\n\n` +
                         `*Watermark: Created by Rohan #bralex11*`
              });
            } else {
              await message.reply({
                content: `ℹ️ **R1gi NGL Discord Bot Info:**\n` +
                         `This bot allows members to send completely anonymous confessions/messages directly to designated server channels.\n\n` +
                         `**How to use:**\n` +
                         `1. Send any direct message (DM) to this bot.\n` +
                         `2. The bot will automatically forward it anonymously to the configured channel in your shared server.\n` +
                         `3. If you share multiple servers, use \`/select\` in DM to switch servers.\n\n` +
                         `**Commands:**\n` +
                         `• \`?status\` - View bot status & uptime\n` +
                         `• \`?info\` - View info and usage\n` +
                         `• \`/select\` - Select server (DM only) or confession channel (Server only)\n\n` +
                         `*Watermark: Created by Rohan #bralex11*`
              });
            }
          } catch (cmdErr) {
            console.error("Error executing status/info command:", cmdErr);
          }
          return;
        }

        if (lowerContent.startsWith("/select") || lowerContent.startsWith("!select")) {
          try {
            const member = message.member;
            if (!member) return;

            // Enforce Administrator or ManageChannels authorization
            const hasPermission = member.permissions.has("Administrator") || member.permissions.has("ManageChannels");
            if (!hasPermission) {
              await message.reply({
                content: "❌ **Access Denied:** Only server administrators or managers with `Manage Channels` permissions can configure the target confession channel.",
              });
              return;
            }

            const args = content.split(/\s+/).slice(1);
            let selectedCh = null;

            if (args.length === 0) {
              // INTUITIVE SELECTION: Select current channel automatically!
              if (message.channel.type === ChannelType.GuildText) {
                selectedCh = message.channel;
              }
            } else {
              const targetChannelSearch = args.join(" ");

              // 1. Search by ID first
              selectedCh = message.guild.channels.cache.get(targetChannelSearch);

              // 2. Search by exact name, then clean/lower-case name
              if (!selectedCh) {
                selectedCh = message.guild.channels.cache.find(
                  (c) =>
                    c.type === ChannelType.GuildText &&
                    (c.name.toLowerCase() === targetChannelSearch.toLowerCase() ||
                      c.name.toLowerCase() === targetChannelSearch.toLowerCase().replace(/^#/, ""))
                );
              }
            }

            if (!selectedCh || selectedCh.type !== ChannelType.GuildText) {
              // List available text channels to assist configuration
              const textChannels = message.guild.channels.cache.filter((c) => c.type === ChannelType.GuildText);
              const channelList = textChannels.map((c) => `• **#${c.name}** (ID: \`${c.id}\`)`).join("\n") || "No text channels found.";

              await message.reply({
                content: `❌ **Could not find a text channel.** To select a text channel, run:\n\`\`\`\n/select\n\`\`\` inside that target channel, or use \`/select <channel-name-or-id>\`.\n\n**Available channels in this server:**\n${channelList}`,
              });
              return;
            }

            // Update configuration specifically for this guild
            if (!db.guildChannels) {
              db.guildChannels = {};
            }
            db.guildChannels[message.guild.id] = selectedCh.id; // Save channel ID for high reliability
            saveDb();

            await message.reply({
              content: `🎯 **Configuration Updated Successfully!** Target channel set to <#${selectedCh.id}> in this server.\n\n🤫 Any DMs sent to the bot from members of this server will be forwarded directly to <#${selectedCh.id}>.`,
            });

          } catch (cmdErr) {
            console.error("Error executing guild command:", cmdErr);
            await message.reply({
              content: "❌ An internal error occurred while trying to change the target channel.",
            });
          }
        }
      }
    });

    await discordClient.login(token);

  } catch (err: any) {
    console.error("Failed to login Discord Bot:", err);
    botStatus = "error";
    lastError = err.message || "Unknown login error. Check your token.";
  }
}

// Start bot initially
initDiscordBot();

// Keep-Alive / Health Endpoints
app.get("/ping", (req, res) => {
  res.status(200).json({ status: "alive", timestamp: new Date().toISOString() });
});

app.get("/api/ping", (req, res) => {
  res.status(200).json({ status: "alive", timestamp: new Date().toISOString() });
});

// API Endpoints for Dashboard

// 1. Get complete dashboard status
app.get("/api/status", (req, res) => {
  let activeChannelInfo = null;

  if (discordClient && discordClient.isReady()) {
    const targetChannelSearch = db.config.channel.trim();
    for (const [_, guild] of discordClient.guilds.cache) {
      let ch = guild.channels.cache.get(targetChannelSearch);
      if (!ch) {
        ch = guild.channels.cache.find(
          (c) =>
            c.type === ChannelType.GuildText &&
            (c.name.toLowerCase() === targetChannelSearch.toLowerCase() ||
              c.name.toLowerCase() === targetChannelSearch.toLowerCase().replace(/^#/, ""))
        );
      }
      if (ch && ch.type === ChannelType.GuildText) {
        activeChannelInfo = {
          id: ch.id,
          name: ch.name,
          guildName: guild.name,
        };
        break;
      }
    }
  }

  // Mask token for security when sending to frontend
  const maskedToken = db.config.token 
    ? db.config.token.substring(0, 10) + "..." + db.config.token.substring(Math.max(0, db.config.token.length - 6))
    : "";

  res.json({
    config: {
      token: maskedToken,
      hasRealToken: !!db.config.token && db.config.token !== "YOUR_DISCORD_BOT_TOKEN",
      channel: db.config.channel,
      botEnabled: db.config.botEnabled !== false,
    },
    status: {
      status: botStatus,
      errorMsg: lastError,
      tag: discordClient?.user?.tag || null,
      id: discordClient?.user?.id || null,
      guildsCount: discordClient?.guilds.cache.size || 0,
      latency: discordClient?.ws.ping || 0,
      activeChannel: activeChannelInfo,
    },
    mappings: db.mappings,
    messages: db.messages,
  });
});

// 2. Save dynamic bot configuration (updates token/channel and restarts the bot)
app.post("/api/config", async (req, res) => {
  const { token, channel, botEnabled } = req.body;

  if (token !== undefined) {
    // If the token is masked, don't overwrite it with the masked version!
    if (!token.includes("...")) {
      db.config.token = token.trim();
    }
  }
  
  if (channel !== undefined) {
    db.config.channel = channel.trim() || "r1gi-ngl";
  }

  if (botEnabled !== undefined) {
    db.config.botEnabled = !!botEnabled;
  }

  saveDb();

  const msg = db.config.botEnabled ? "Configuration saved. Connecting bot..." : "Configuration saved. Bot disconnected.";
  res.json({ success: true, message: msg });

  // Fire-and-forget bot re-initialization
  initDiscordBot();
});

// 3. Reset anonymous user mappings
app.post("/api/reset-mappings", (req, res) => {
  db.mappings = [];
  saveDb();
  res.json({ success: true, message: "All anonymous user mappings have been reset!" });
});

// 4. Send an anonymous reply back to a user
app.post("/api/send-reply", async (req, res) => {
  const { anonId, content } = req.body;

  if (!anonId || !content) {
    return res.status(400).json({ success: false, error: "Missing Anon ID or content" });
  }

  const mapping = db.mappings.find((m) => m.anonId === anonId);
  if (!mapping) {
    return res.status(404).json({ success: false, error: `User with Anon ID ${anonId} not found.` });
  }

  if (!discordClient || !discordClient.isReady()) {
    return res.status(503).json({ success: false, error: "Discord Bot is not currently online." });
  }

  try {
    const user = await discordClient.users.fetch(mapping.userId);
    await user.send({
      content: `💬 **Reply from Admin:**\n${content}\n\n*Reply to this message to continue the anonymous confession thread.*`,
    });

    // Save reply to logs too
    db.messages.unshift({
      id: "reply_" + Date.now(),
      timestamp: new Date().toISOString(),
      anonId: "ADMIN_REPLY",
      content: `Replied to ${mapping.anonId}: ${content}`,
      userTag: "Admin",
    });
    saveDb();

    res.json({ success: true, message: `Reply sent successfully to ${anonId}!` });
  } catch (err: any) {
    console.error(`Error sending reply to ${anonId} (${mapping.userId}):`, err);
    res.status(500).json({ success: false, error: `Could not deliver DM to user: ${err.message}` });
  }
});

// 5. Simulate receiving a DM (for zero-setup testing & rich playground inside AI Studio UI!)
app.post("/api/simulate", (req, res) => {
  const { senderName, content } = req.body;
  const username = (senderName || "Rohan").trim();
  const simulatedUserId = `sim_${username.toLowerCase()}`;

  // 1. Resolve ANON ID
  let mapping = db.mappings.find((m) => m.userId === simulatedUserId);
  if (!mapping) {
    const nextIndex = db.mappings.length + 1;
    const anonId = `ANON${String(nextIndex).padStart(4, "0")}`;
    mapping = {
      userId: simulatedUserId,
      userTag: username,
      anonId,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    };
    db.mappings.push(mapping);
  } else {
    mapping.lastActive = new Date().toISOString();
  }

  // 2. Add message as a simulated forward
  db.messages.unshift({
    id: "sim_" + Date.now(),
    timestamp: new Date().toISOString(),
    anonId: mapping.anonId,
    content: `${content || "hi"}`,
    isSimulated: true,
    userTag: username,
  });

  if (db.messages.length > 100) {
    db.messages = db.messages.slice(0, 100);
  }
  saveDb();

  res.json({
    success: true,
    message: `Simulated DM received from ${username} as ${mapping.anonId}`,
    anonId: mapping.anonId,
  });
});

// Vite Server Setup for Full-Stack Hot Reload and Asset Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
