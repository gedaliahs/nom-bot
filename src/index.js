// src/index.js
import {
    Client,
    GatewayIntentBits,
    Partials,
    Events,
    SlashCommandBuilder,
    REST,
    Routes,
    EmbedBuilder,
    PermissionFlagsBits
  } from "discord.js";
  import { getRandomResponse, initResponses } from "./responses.js";
  import {
    bumpUserNom,
    incrTotalNom,
    getCounter,
    setNextDrop,
    getSetting,
    upsertSetting,
    topToday,
    topAll,
    resetMarathon,
    addWin,
    topWinners
  } from "./db.js";
  import { nomTranslate } from "./translator.js";
  import { seasonalTag } from "./seasonal.js";
  import { maybeRunRareEvent } from "./rareEvents.js"; // keep your rare events file
  
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error("DISCORD_TOKEN missing");
    process.exit(1);
  }
  
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
  });
  
  const RESPONSES = initResponses(1000);
  
  // ---- Slash command definitions ----
  const commands = [
    new SlashCommandBuilder()
      .setName("stats")
      .setDescription("Show nom stats (global/today/you)."),
    new SlashCommandBuilder()
      .setName("leaderboard")
      .setDescription("Show nom leaderboard (today & all-time)."),
    new SlashCommandBuilder()
      .setName("setchannel")
      .setDescription("Set the announcements/channel for nom posts.")
      .addChannelOption((o) =>
        o.setName("channel").setDescription("Target channel").setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder()
      .setName("marathon")
      .setDescription("Control Nom Marathon.")
      .addStringOption((o) =>
        o
          .setName("action")
          .setDescription("start/stop")
          .setRequired(true)
          .addChoices({ name: "start", value: "start" }, { name: "stop", value: "stop" })
      ),
    new SlashCommandBuilder()
      .setName("countdown")
      .setDescription("Tease a golden drop after X minutes.")
      .addIntegerOption((o) =>
        o
          .setName("minutes")
          .setDescription("Minutes (1-120)")
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("translate")
      .setDescription("Translate text to actually good nom.")
      .addStringOption((o) =>
        o.setName("text").setDescription("Text to translate").setRequired(true)
      ),
    new SlashCommandBuilder().setName("fortune").setDescription("Receive a nom fortune."),
    new SlashCommandBuilder().setName("lore").setDescription("Generate a piece of Nom Lore.")
  ].map((c) => c.toJSON());
  
  client.once(Events.ClientReady, async (c) => {
    console.log(`✅ Logged in as ${c.user.tag}`);
    const rest = new REST({ version: "10" }).setToken(token);
    try {
      await rest.put(Routes.applicationCommands(c.user.id), { body: commands });
      console.log("✅ Slash commands registered");
    } catch (e) {
      console.error("Slash command registration failed:", e);
    }
  });
  
  // --- Nom Party detector (burst detection) ---
  const partyWindowMs = 10_000; // 10s window
  const partyThreshold = 5;      // 5 msgs with 'nom' in window
  const recentByChannel = new Map(); // channelId -> timestamps[]
  const activeTasks = new Map();     // guildId -> {messageId,type,expiresAt,answer,channelId}
  
  // fortunes & lore
  const FORTUNES = [
    "Your next nom will open a door.",
    "Beware the stale cookie.",
    "Two noms today prevent one grump tomorrow.",
    "Golden nom approaches when least expected.",
    "Ask not why the nom—be the nom."
  ];
  const LORE = [
    "In the beginning there was hunger; then came the First Nom.",
    "Ancient crumbs foretold a chosen nommer who would balance the snacks.",
    "The Nomsmiths forged three sauces: Sweet, Spicy, and Secret.",
    "When the moon is crescent, the quiet nom echoes the loudest.",
    "He who hoards the noms finds only emptiness… and ants."
  ];
  
  function randomOf(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }
  
  function maybeNomParty(message) {
    const id = message.channel.id;
    const now = Date.now();
    const arr = recentByChannel.get(id) || [];
    const pruned = arr.filter((ts) => now - ts <= partyWindowMs);
    pruned.push(now);
    recentByChannel.set(id, pruned);
    if (pruned.length >= partyThreshold) {
      recentByChannel.set(id, []); // reset
      message.channel.send("🎉 **NOM PARTY ACTIVATED!** Everyone grab a crumb! 🍪");
      try {
        message.react("🍪");
        message.react("🔥");
        message.react("💫");
      } catch {}
    }
  }
  
  // Mini-game drop every 30–40 noms
  async function maybeDropTask(message, totalGuildNom) {
    const row = getCounter.get ? getCounter.get(message.guild.id) : getCounter(message.guild.id);
    if (!row) return;
  
    // trigger when total % next_drop_at === 0
    if (totalGuildNom % row.next_drop_at !== 0) return;
  
    const kind = Math.random() < 0.5 ? "react" : "code";
    const ttl = (20 + Math.floor(Math.random() * 11)) * 1000; // 20–30s
    const expiresAt = Date.now() + ttl;
  
    if (kind === "react") {
      const emoji = randomOf(["🍪", "🔥", "🥐", "💫", "🍩"]);
      const embed = new EmbedBuilder()
        .setTitle("⚡ Quick Nom Challenge")
        .setDescription(`First to **react with ${emoji}** to **this embed** wins!`)
        .setColor(0xf4c430)
        .setFooter({ text: `Time limit: ${Math.round(ttl / 1000)}s • ${seasonalTag()}` });
      const sent = await message.channel.send({ embeds: [embed] });
      try {
        await sent.react(emoji);
      } catch {}
      activeTasks.set(message.guild.id, {
        messageId: sent.id,
        type: "react",
        emoji,
        expiresAt,
        channelId: message.channel.id
      });
    } else {
      const code = "NOM" + (100 + ((Math.random() * 900) | 0));
      const embed = new EmbedBuilder()
        .setTitle("⚡ Quick Nom Challenge")
        .setDescription(`First to **type** the code below wins:\n\n\`\`\`\n${code}\n\`\`\``)
        .setColor(0xf4c430)
        .setFooter({ text: `Time limit: ${Math.round(ttl / 1000)}s • ${seasonalTag()}` });
      const sent = await message.channel.send({ embeds: [embed] });
      activeTasks.set(message.guild.id, {
        messageId: sent.id,
        type: "code",
        answer: code,
        expiresAt,
        channelId: message.channel.id
      });
    }
  
    // schedule next drop
    setNextDrop(message.guild.id, 30, 40);
  }
  
  function isMarathonOn(guildId) {
    const row = getCounter.get ? getCounter.get(guildId) : getCounter(guildId);
    return !!row?.marathon_active;
  }
  
  // --- Core responder: reply to ANY message containing "nom" ---
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author?.bot) return;
    const content = message.content ?? "";
    if (!/nom/i.test(content)) return;
  
    // seasonal flavor sometimes
    const prefix = Math.random() < 0.15 ? `${seasonalTag()} — ` : "";
    const replyText = prefix + getRandomResponse(RESPONSES);
    await message
      .reply({ content: replyText, allowedMentions: { repliedUser: false } })
      .catch(() => {});
  
    // stats & totals
    bumpUserNom(message.guild.id, message.author.id);
    const totalGuildNom = incrTotalNom(message.guild.id);
  
    // party detector
    maybeNomParty(message);
  
    // drop mini-game if threshold reached
    await maybeDropTask(message, totalGuildNom);
  
    // marathon ping occasionally
    if (isMarathonOn(message.guild.id) && Math.random() < 0.1) {
      const row = getCounter.get ? getCounter.get(message.guild.id) : getCounter(message.guild.id);
      message.channel.send(`🏁 Marathon count: **${row.marathon_count}** noms so far!`);
    }
  
    // rare events (if you included rareEvents.js)
    await maybeRunRareEvent(client, message).catch(() => {});
  });
  
  // --- Mini-game resolvers ---
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author?.bot) return;
    const task = activeTasks.get(message.guild.id);
    if (!task) return;
    if (Date.now() > task.expiresAt) {
      activeTasks.delete(message.guild.id);
      return;
    }
    if (task.type === "code" && message.channel.id === task.channelId) {
      if (message.content.trim() === task.answer) {
        activeTasks.delete(message.guild.id);
        (addWin.run ? addWin.run(message.guild.id, message.author.id) : addWin(message.guild.id, message.author.id));
        message.channel.send(`🏅 **Winner:** <@${message.author.id}> — +1 win!`);
      }
    }
  });
  
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;
    const message = reaction.message;
    if (!message.guild) return;
    const task = activeTasks.get(message.guild.id);
    if (!task || task.type !== "react") return;
    if (Date.now() > task.expiresAt) {
      activeTasks.delete(message.guild.id);
      return;
    }
    if (message.id !== task.messageId) return;
    if (reaction.emoji.name === task.emoji) {
      activeTasks.delete(message.guild.id);
      (addWin.run ? addWin.run(message.guild.id, user.id) : addWin(message.guild.id, user.id));
      message.channel.send(`🏅 **Winner:** <@${user.id}> — +1 win!`);
    }
  });
  
  // --- Interactions (slash commands) ---
  client.on(Events.InteractionCreate, async (itx) => {
    if (!itx.isChatInputCommand()) return;
    const name = itx.commandName;
  
    if (name === "stats") {
      const today = new Date().toISOString().slice(0, 10);
      const topT = topToday.all ? topToday.all(itx.guildId, today) : topToday(itx.guildId);
      const topA = topAll.all ? topAll.all(itx.guildId) : topAll(itx.guildId);
      const embed = new EmbedBuilder()
        .setTitle("📊 Nom Stats")
        .addFields(
          {
            name: "Today",
            value: (topT && topT.length)
              ? topT.map((r, i) => `${i + 1}. <@${r.user_id}> — ${r.daily_nom}`).join("\n")
              : "No data"
          },
          {
            name: "All-time",
            value: (topA && topA.length)
              ? topA.map((r, i) => `${i + 1}. <@${r.user_id}> — ${r.total_nom}`).join("\n")
              : "No data"
          }
        )
        .setColor(0x3b4756)
        .setFooter({ text: seasonalTag() });
      await itx.reply({ embeds: [embed] });
    }
  
    if (name === "leaderboard") {
      const winners = topWinners.all ? topWinners.all(itx.guildId) : topWinners(itx.guildId);
      const value = (winners && winners.length)
        ? winners.map((r, i) => `${i + 1}. <@${r.user_id}> — ${r.wins} wins`).join("\n")
        : "No wins yet.";
      const embed = new EmbedBuilder()
        .setTitle("🏆 Mini-Game Winners")
        .setDescription(value)
        .setColor(0xbfd7ea);
      await itx.reply({ embeds: [embed] });
    }
  
    if (name === "setchannel") {
      const ch = itx.options.getChannel("channel", true);
      await (upsertSetting.run ? upsertSetting.run(itx.guildId, ch.id) : upsertSetting(itx.guildId, ch.id));
      await itx.reply({ content: `✅ Announce channel set to ${ch}.`, ephemeral: true });
    }
  
    if (name === "marathon") {
      const action = itx.options.getString("action", true);
      const start = action === "start";
      resetMarathon(itx.guildId, start);
      await itx.reply(
        start
          ? "🏁 **Nom Marathon STARTED!** Type 'nom' to contribute."
          : "🏁 **Nom Marathon STOPPED.** Good run!"
      );
    }
  
    if (name === "countdown") {
      const minutes = itx.options.getInteger("minutes", true);
      if (minutes < 1 || minutes > 120)
        return itx.reply({ content: "Pick 1–120 minutes.", ephemeral: true });
      await itx.reply(`⏳ Golden Nom arriving in **${minutes}** minutes…`);
      setTimeout(async () => {
        const setting = (getSetting.get ? getSetting.get(itx.guildId) : getSetting(itx.guildId));
        const ch = setting
          ? await itx.guild.channels.fetch(setting.announce_channel_id).catch(() => null)
          : itx.channel;
        ch?.send("🎁 **Golden Nom Drop!** Say `nom` now!");
      }, minutes * 60 * 1000);
    }
  
    if (name === "translate") {
      const text = itx.options.getString("text", true);
      const out = nomTranslate(text);
      await itx.reply(out.slice(0, 1900));
    }
  
    if (name === "fortune") {
      await itx.reply(`🔮 ${randomOf(FORTUNES)}`);
    }
  
    if (name === "lore") {
      await itx.reply(`📜 ${randomOf(LORE)}`);
    }
  });
  
  client.login(token);
  