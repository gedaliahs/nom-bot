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
  import { maybeRunRareEvent } from "./rareEvents.js";
  
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error("❌ DISCORD_TOKEN missing");
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
  
  // ---- Slash commands ----
  const commands = [
    new SlashCommandBuilder().setName("stats").setDescription("Show nom stats."),
    new SlashCommandBuilder()
      .setName("leaderboard")
      .setDescription("Show nom leaderboards."),
    new SlashCommandBuilder()
      .setName("setchannel")
      .setDescription("Set channel for announcements.")
      .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder()
      .setName("marathon")
      .setDescription("Start or stop a Nom Marathon.")
      .addStringOption(o =>
        o.setName("action")
          .setDescription("Action")
          .setRequired(true)
          .addChoices(
            { name: "start", value: "start" },
            { name: "stop", value: "stop" }
          )
      ),
    new SlashCommandBuilder()
      .setName("countdown")
      .setDescription("Schedule a Golden Nom drop.")
      .addIntegerOption(o =>
        o.setName("minutes").setDescription("Minutes (1–120)").setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("translate")
      .setDescription("Translate text into Nom language.")
      .addStringOption(o =>
        o.setName("text").setDescription("Text").setRequired(true)
      ),
    new SlashCommandBuilder().setName("fortune").setDescription("Receive a nom fortune."),
    new SlashCommandBuilder().setName("lore").setDescription("Generate Nom lore.")
  ].map(c => c.toJSON());
  
  // ---- Register commands instantly ----
  client.once(Events.ClientReady, async (c) => {
    console.log(`✅ Logged in as ${c.user.tag}`);
    const rest = new REST({ version: "10" }).setToken(token);
    const appId = c.user.id;
    const guildIds = (process.env.GUILD_IDS || "")
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);
  
    try {
      if (guildIds.length === 0) {
        console.log("⚠️  No GUILD_IDS set, registering GLOBAL commands (slow).");
        await rest.put(Routes.applicationCommands(appId), { body: commands });
      } else {
        for (const gid of guildIds) {
          await rest.put(Routes.applicationGuildCommands(appId, gid), { body: commands });
          console.log(`✅ Commands registered for guild ${gid}`);
        }
      }
    } catch (e) {
      console.error("❌ Command registration failed:", e);
    }
  });
  
  // ---- Fortune & Lore pools ----
  const FORTUNES = [
    "Your next nom will open a door.",
    "Beware the stale cookie.",
    "Two noms today prevent one grump tomorrow.",
    "Golden nom approaches when least expected.",
    "Ask not why the nom—be the nom."
  ];
  const LORE = [
    "In the beginning there was hunger; then came the First Nom.",
    "Ancient crumbs foretold a chosen nommer.",
    "The Nomsmiths forged three sauces: Sweet, Spicy, and Secret.",
    "When the moon is crescent, the quiet nom echoes the loudest.",
    "He who hoards the noms finds only emptiness… and ants."
  ];
  const randomOf = a => a[(Math.random() * a.length) | 0];
  
  // ---- Mini state trackers ----
  const partyWindowMs = 10_000;
  const partyThreshold = 5;
  const recentByChannel = new Map();
  const activeTasks = new Map();
  
  // ---- Core NOM responder ----
  client.on(Events.MessageCreate, async (m) => {
    if (!m.guild || m.author?.bot) return;
    if (!/nom/i.test(m.content ?? "")) return;
  
    const prefix = Math.random() < 0.15 ? `${seasonalTag()} — ` : "";
    await m.reply({
      content: prefix + getRandomResponse(RESPONSES),
      allowedMentions: { repliedUser: false }
    }).catch(() => {});
  
    bumpUserNom(m.guild.id, m.author.id);
    const total = incrTotalNom(m.guild.id);
  
    // party trigger
    const arr = recentByChannel.get(m.channel.id) || [];
    const now = Date.now();
    const pruned = arr.filter(t => now - t < partyWindowMs);
    pruned.push(now);
    recentByChannel.set(m.channel.id, pruned);
    if (pruned.length >= partyThreshold) {
      recentByChannel.set(m.channel.id, []);
      m.channel.send("🎉 **NOM PARTY ACTIVATED!** 🍪💫🔥");
    }
  
    // mini-game drop every 30–40 noms
    const row = getCounter(m.guild.id);
    if (total % row.next_drop_at === 0) {
      const ttl = (20 + Math.random() * 10) * 1000;
      const expires = Date.now() + ttl;
      const kind = Math.random() < 0.5 ? "react" : "code";
  
      if (kind === "react") {
        const emoji = randomOf(["🍪", "🔥", "🥐", "💫"]);
        const e = new EmbedBuilder()
          .setTitle("⚡ Quick Nom Challenge")
          .setDescription(`First to **react with ${emoji}** wins!`)
          .setColor(0xf4c430)
          .setFooter({ text: `Time limit: ${Math.round(ttl / 1000)}s • ${seasonalTag()}` });
        const msg = await m.channel.send({ embeds: [e] });
        await msg.react(emoji).catch(() => {});
        activeTasks.set(m.guild.id, { messageId: msg.id, type: "react", emoji, expires, channelId: m.channel.id });
      } else {
        const code = "NOM" + (100 + ((Math.random() * 900) | 0));
        const e = new EmbedBuilder()
          .setTitle("⚡ Quick Nom Challenge")
          .setDescription(`First to type this code:\n\`\`\`\n${code}\n\`\`\``)
          .setColor(0xf4c430)
          .setFooter({ text: `Time limit: ${Math.round(ttl / 1000)}s • ${seasonalTag()}` });
        const msg = await m.channel.send({ embeds: [e] });
        activeTasks.set(m.guild.id, { messageId: msg.id, type: "code", answer: code, expires, channelId: m.channel.id });
      }
      setNextDrop(m.guild.id, 30, 40);
    }
  
    await maybeRunRareEvent(client, m).catch(() => {});
  });
  
  // ---- Mini-game resolvers ----
  client.on(Events.MessageCreate, (m) => {
    if (!m.guild || m.author?.bot) return;
    const t = activeTasks.get(m.guild.id);
    if (!t || Date.now() > t.expires) return;
    if (t.type === "code" && m.channel.id === t.channelId && m.content.trim() === t.answer) {
      activeTasks.delete(m.guild.id);
      addWin(m.guild.id, m.author.id);
      m.channel.send(`🏅 **Winner:** <@${m.author.id}>`);
    }
  });
  client.on(Events.MessageReactionAdd, (r, u) => {
    if (u.bot) return;
    const t = activeTasks.get(r.message.guildId);
    if (!t || Date.now() > t.expires) return;
    if (t.type === "react" && r.message.id === t.messageId && r.emoji.name === t.emoji) {
      activeTasks.delete(r.message.guildId);
      addWin(r.message.guildId, u.id);
      r.message.channel.send(`🏅 **Winner:** <@${u.id}>`);
    }
  });
  
  // ---- Slash Commands ----
  client.on(Events.InteractionCreate, async (i) => {
    if (!i.isChatInputCommand()) return;
    const n = i.commandName;
  
    if (n === "stats") {
      const topT = topToday(i.guildId);
      const topA = topAll(i.guildId);
      const e = new EmbedBuilder()
        .setTitle("📊 Nom Stats")
        .addFields(
          { name: "Today", value: topT.length ? topT.map((r, j) => `${j + 1}. <@${r.user_id}> — ${r.daily_nom}`).join("\n") : "No data" },
          { name: "All-time", value: topA.length ? topA.map((r, j) => `${j + 1}. <@${r.user_id}> — ${r.total_nom}`).join("\n") : "No data" }
        )
        .setColor(0x3b4756);
      await i.reply({ embeds: [e] });
    }
  
    if (n === "leaderboard") {
      const wins = topWinners(i.guildId);
      const e = new EmbedBuilder()
        .setTitle("🏆 Mini-Game Winners")
        .setDescription(wins.length ? wins.map((r, j) => `${j + 1}. <@${r.user_id}> — ${r.wins}`).join("\n") : "No wins yet.")
        .setColor(0xbfd7ea);
      await i.reply({ embeds: [e] });
    }
  
    if (n === "setchannel") {
      const ch = i.options.getChannel("channel", true);
      await upsertSetting(i.guildId, ch.id);
      await i.reply({ content: `✅ Announce channel set to ${ch}`, ephemeral: true });
    }
  
    if (n === "marathon") {
      const action = i.options.getString("action", true);
      const start = action === "start";
      resetMarathon(i.guildId, start);
      await i.reply(start ? "🏁 **Marathon STARTED!**" : "🏁 **Marathon STOPPED.**");
    }
  
    if (n === "countdown") {
      const mins = i.options.getInteger("minutes", true);
      if (mins < 1 || mins > 120) return i.reply({ content: "1–120 only.", ephemeral: true });
      await i.reply(`⏳ Golden Nom in **${mins}m**...`);
      setTimeout(async () => {
        const s = getSetting(i.guildId);
        const ch = s ? await i.guild.channels.fetch(s.announce_channel_id).catch(() => null) : i.channel;
        ch?.send("🎁 **Golden Nom Drop!** Say `nom` now!");
      }, mins * 60 * 1000);
    }
  
    if (n === "translate") {
      const text = i.options.getString("text", true);
      await i.reply(nomTranslate(text).slice(0, 1900));
    }
  
    if (n === "fortune") await i.reply(`🔮 ${randomOf(FORTUNES)}`);
    if (n === "lore") await i.reply(`📜 ${randomOf(LORE)}`);
  });
  
  client.login(token);
  