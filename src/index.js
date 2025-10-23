import {
    Client,
    GatewayIntentBits,
    Partials,
    Events,
    SlashCommandBuilder,
    REST,
    Routes,
    EmbedBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
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
    topWinners,
    addCoins,
    getBalance,
    spendCoins,
    setRole,
    getRole,
    listShop,
    addShopItem,
    removeShopItem,
    getShopItem
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
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction]
  });
  
  const RESPONSES = initResponses(1000);
  
  // ---------------- Slash commands ----------------
  const commands = [
    new SlashCommandBuilder().setName("stats").setDescription("Show nom stats."),
    new SlashCommandBuilder().setName("leaderboard").setDescription("Show mini-game winners."),
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
          .addChoices({ name: "start", value: "start" }, { name: "stop", value: "stop" })
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
      .addStringOption(o => o.setName("text").setDescription("Text").setRequired(true)),
    new SlashCommandBuilder().setName("fortune").setDescription("Receive a nom fortune."),
    new SlashCommandBuilder().setName("lore").setDescription("Generate Nom lore."),
  
    // Economy + roles + shop
    new SlashCommandBuilder()
      .setName("balance")
      .setDescription("Show your coin balance"),
    new SlashCommandBuilder()
      .setName("setrole")
      .setDescription("Map a special role key to a role (admin).")
      .addStringOption(o => o.setName("key").setDescription("e.g., golden_nom").setRequired(true))
      .addRoleOption(o => o.setName("role").setDescription("Target role").setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder()
      .setName("shop")
      .setDescription("Shop actions")
      .addSubcommand(sc => sc.setName("list").setDescription("List items (embedded with buttons)"))
      .addSubcommand(sc =>
        sc.setName("add")
          .setDescription("Add item (admin)")
          .addStringOption(o => o.setName("name").setDescription("Item name").setRequired(true))
          .addIntegerOption(o => o.setName("price").setDescription("Price").setRequired(true))
          .addStringOption(o =>
            o
              .setName("type")
              .setDescription("role | consumable")
              .setRequired(true)
              .addChoices({ name: "role", value: "role" }, { name: "consumable", value: "consumable" })
          )
          .addStringOption(o =>
            o
              .setName("payload")
              .setDescription("roleId for type=role, else free-form")
              .setRequired(true)
          )
      )
      .addSubcommand(sc =>
        sc
          .setName("remove")
          .setDescription("Remove item (admin)")
          .addStringOption(o => o.setName("id").setDescription("Item id").setRequired(true))
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder()
      .setName("buy")
      .setDescription("Buy a shop item by id (fallback if buttons fail)")
      .addStringOption(o => o.setName("id").setDescription("Item id").setRequired(true))
  ].map(c => c.toJSON());
  
  // ------------- Register commands -------------
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
        console.log("⚠️  No GUILD_IDS set — registering GLOBAL commands (slower).");
        await rest.put(Routes.applicationCommands(appId), { body: commands });
        console.log("✅ Global commands submitted.");
      } else {
        for (const gid of guildIds) {
          await rest.put(Routes.applicationGuildCommands(appId, gid), { body: commands });
          console.log(`✅ Guild commands registered for ${gid}`);
        }
      }
    } catch (e) {
      console.error("❌ Command registration failed:", e?.data ?? e);
    }
  });
  
  // ---------------- Flavor pools ----------------
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
  
  // ---------------- Party + mini-game state ----------------
  const partyWindowMs = 10_000;
  const partyThreshold = 5;
  const recentByChannel = new Map();
  const activeTasks = new Map();
  
  // ---------------- Core NOM responder ----------------
  client.on(Events.MessageCreate, async (m) => {
    if (!m.guild || m.author?.bot) return;
    if (!/nom/i.test(m.content ?? "")) return;
  
    const prefix = Math.random() < 0.15 ? `${seasonalTag()} — ` : "";
    await m
      .reply({
        content: prefix + getRandomResponse(RESPONSES),
        allowedMentions: { repliedUser: false }
      })
      .catch(() => {});
  
    // stats + totals
    bumpUserNom(m.guild.id, m.author.id);
    const total = incrTotalNom(m.guild.id);
  
    // coins
    addCoins(m.guild.id, m.author.id, 1);
  
    // party trigger
    const arr = recentByChannel.get(m.channel.id) || [];
    const now = Date.now();
    const pruned = arr.filter(t => now - t < partyWindowMs);
    pruned.push(now);
    recentByChannel.set(m.channel.id, pruned);
    if (pruned.length >= partyThreshold) {
      recentByChannel.set(m.channel.id, []);
      const e = new EmbedBuilder()
        .setTitle("🎉 NOM PARTY ACTIVATED!")
        .setDescription("Keep the chain going! Everyone say **nom**!")
        .setColor(0x3b82f6);
      m.channel.send({ embeds: [e] }).catch(() => {});
    }
  
    // mini-game drop every ~30–40 noms
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
          .setColor(0xf59e0b)
          .setFooter({ text: `Time limit: ${Math.round(ttl / 1000)}s • ${seasonalTag()}` });
        const msg = await m.channel.send({ embeds: [e] }).catch(() => null);
        if (!msg) return;
        await msg.react(emoji).catch(() => {});
        activeTasks.set(m.guild.id, {
          messageId: msg.id,
          type: "react",
          emoji,
          expires,
          channelId: m.channel.id
        });
      } else {
        const code = "NOM" + (100 + ((Math.random() * 900) | 0));
        const e = new EmbedBuilder()
          .setTitle("⚡ Quick Nom Challenge")
          .setDescription(`First to type this code:\n\`\`\`\n${code}\n\`\`\``)
          .setColor(0xf59e0b)
          .setFooter({ text: `Time limit: ${Math.round(ttl / 1000)}s • ${seasonalTag()}` });
        const msg = await m.channel.send({ embeds: [e] }).catch(() => null);
        if (!msg) return;
        activeTasks.set(m.guild.id, {
          messageId: msg.id,
          type: "code",
          answer: code,
          expires,
          channelId: m.channel.id
        });
      }
      setNextDrop(m.guild.id, 30, 40);
    }
  
    // 1/200 rare event (embed/gif/role reward)
    await maybeRunRareEvent(client, m).catch(() => {});
  });
  
  // ---------------- Mini-game resolvers ----------------
  client.on(Events.MessageCreate, async (m) => {
    if (!m.guild || m.author?.bot) return;
    const t = activeTasks.get(m.guild.id);
    if (!t || Date.now() > t.expires) return;
  
    if (t.type === "code" && m.channel.id === t.channelId && m.content.trim() === t.answer) {
      activeTasks.delete(m.guild.id);
      addWin(m.guild.id, m.author.id);
      addCoins(m.guild.id, m.author.id, 10);
      const e = new EmbedBuilder()
        .setColor(0x22c55e)
        .setDescription(`🏅 **Winner:** <@${m.author.id}> (+10 coins)`);
      await m.channel.send({ embeds: [e] });
    }
  });
  
  client.on(Events.MessageReactionAdd, async (r, u) => {
    if (u.bot) return;
    if (!r.message.guildId) return;
    const t = activeTasks.get(r.message.guildId);
    if (!t || Date.now() > t.expires) return;
  
    if (t.type === "react" && r.message.id === t.messageId && r.emoji.name === t.emoji) {
      activeTasks.delete(r.message.guildId);
      addWin(r.message.guildId, u.id);
      addCoins(r.message.guildId, u.id, 10);
      const e = new EmbedBuilder()
        .setColor(0x22c55e)
        .setDescription(`🏅 **Winner:** <@${u.id}> (+10 coins)`);
      await r.message.channel.send({ embeds: [e] });
    }
  });
  
  // --------------- SHOP RENDERING (embeds + buttons) ---------------
  const ITEMS_PER_PAGE = 10;
  function renderShopPage(guildId, page = 0) {
    const items = listShop(guildId);
    const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
    const clamped = Math.min(Math.max(0, page), totalPages - 1);
    const start = clamped * ITEMS_PER_PAGE;
    const pageItems = items.slice(start, start + ITEMS_PER_PAGE);
  
    const e = new EmbedBuilder()
      .setTitle("🏪 Nom Shop")
      .setDescription("Earn coins by nomming and winning mini-games. Click a button to buy.")
      .setColor(0x8b5cf6)
      .setFooter({ text: `Page ${clamped + 1}/${totalPages} • ${seasonalTag()}` });
  
    if (pageItems.length === 0) {
      e.addFields({ name: "No items yet", value: "Admins can add items with `/shop add`." });
    } else {
      for (const it of pageItems) {
        e.addFields({
          name: `${it.name} — ${it.price}c`,
          value: `Type: \`${it.type}\` • ID: \`${it.id}\``
        });
      }
    }
  
    // Up to 10 buy buttons → two rows of 5
    const rows = [];
    let cur = new ActionRowBuilder();
    for (let idx = 0; idx < pageItems.length; idx++) {
      if (idx > 0 && idx % 5 === 0) {
        rows.push(cur);
        cur = new ActionRowBuilder();
      }
      const it = pageItems[idx];
      const btn = new ButtonBuilder()
        .setCustomId(`buy:${it.id}`)
        .setLabel(`Buy: ${trimLabel(it.name, 17)}`)
        .setStyle(ButtonStyle.Success);
      cur.addComponents(btn);
    }
    if (pageItems.length) rows.push(cur);
  
    // Nav row
    const nav = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`shopnav:${clamped - 1}`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel("⟵ Prev")
        .setDisabled(clamped <= 0),
      new ButtonBuilder()
        .setCustomId("noop:sep")
        .setStyle(ButtonStyle.Secondary)
        .setLabel("·")
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`shopnav:${clamped + 1}`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel("Next ⟶")
        .setDisabled(clamped >= totalPages - 1)
    );
  
    rows.push(nav);
    return { embed: e, components: rows };
  }
  
  function trimLabel(s, n) {
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }
  
  // ---------------- Slash Handlers ----------------
  client.on(Events.InteractionCreate, async (i) => {
    // BUTTONS: buy + nav
    if (i.isButton()) {
      // Pagination
      if (i.customId.startsWith("shopnav:")) {
        const target = parseInt(i.customId.split(":")[1], 10) || 0;
        const { embed, components } = renderShopPage(i.guildId, target);
        return i.update({ embeds: [embed], components });
      }
      // Ignore separator
      if (i.customId.startsWith("noop:")) {
        return i.deferUpdate().catch(() => {});
      }
      // Buy flow
      if (i.customId.startsWith("buy:")) {
        const itemId = i.customId.split(":")[1];
        const it = getShopItem(i.guildId, itemId);
        if (!it) return i.reply({ content: "Item not found.", ephemeral: true });
  
        if (!spendCoins(i.guildId, i.user.id, it.price)) {
          const bal = getBalance(i.guildId, i.user.id);
          return i.reply({ content: `Not enough coins. You have ${bal}.`, ephemeral: true });
        }
  
        if (it.type === "role") {
          const roleId = it.payload;
          const role = await i.guild.roles.fetch(roleId).catch(() => null);
          const member = await i.guild.members.fetch(i.user.id);
          if (!role) {
            return i.reply({ content: "Role not found. Tell an admin to fix the shop item.", ephemeral: true });
          }
          await member.roles.add(role).catch(() => {});
          return i.reply({ content: `✅ Purchased **${it.name}** — role granted.`, ephemeral: true });
        } else {
          return i.reply({ content: `✅ Purchased **${it.name}** — enjoy!`, ephemeral: true });
        }
      }
      return;
    }
  
    // SLASH COMMANDS
    if (!i.isChatInputCommand()) return;
    const n = i.commandName;
  
    if (n === "stats") {
      const topT = topToday(i.guildId);
      const topA = topAll(i.guildId);
      const e = new EmbedBuilder()
        .setTitle("📊 Nom Stats")
        .addFields(
          {
            name: "Today",
            value: topT.length ? topT.map((r, j) => `${j + 1}. <@${r.user_id}> — **${r.daily_nom}**`).join("\n") : "No data"
          },
          {
            name: "All-time",
            value: topA.length ? topA.map((r, j) => `${j + 1}. <@${r.user_id}> — **${r.total_nom}**`).join("\n") : "No data"
          }
        )
        .setColor(0x3b4756);
      return i.reply({ embeds: [e] });
    }
  
    if (n === "leaderboard") {
      const wins = topWinners(i.guildId);
      const e = new EmbedBuilder()
        .setTitle("🏆 Mini-Game Winners")
        .setDescription(wins.length ? wins.map((r, j) => `${j + 1}. <@${r.user_id}> — **${r.wins}**`).join("\n") : "No wins yet.")
        .setColor(0xbfd7ea);
      return i.reply({ embeds: [e] });
    }
  
    if (n === "setchannel") {
      const ch = i.options.getChannel("channel", true);
      await upsertSetting(i.guildId, ch.id);
      return i.reply({ content: `✅ Announce channel set to ${ch}`, ephemeral: true });
    }
  
    if (n === "marathon") {
      const action = i.options.getString("action", true);
      const start = action === "start";
      resetMarathon(i.guildId, start);
      const e = new EmbedBuilder()
        .setColor(start ? 0x10b981 : 0xef4444)
        .setDescription(start ? "🏁 **Marathon STARTED!**" : "🏁 **Marathon STOPPED.**");
      return i.reply({ embeds: [e] });
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
      return;
    }
  
    if (n === "translate") {
      const text = i.options.getString("text", true);
      return i.reply(nomTranslate(text).slice(0, 1900));
    }
  
    if (n === "fortune") {
      const e = new EmbedBuilder().setColor(0x14b8a6).setDescription(`🔮 ${randomOf(FORTUNES)}`);
      return i.reply({ embeds: [e] });
    }
    if (n === "lore") {
      const e = new EmbedBuilder().setColor(0xa3e635).setDescription(`📜 ${randomOf(LORE)}`);
      return i.reply({ embeds: [e] });
    }
  
    if (n === "balance") {
      const bal = getBalance(i.guildId, i.user.id);
      const e = new EmbedBuilder()
        .setColor(0xf97316)
        .setTitle("💰 Your Balance")
        .setDescription(`**${bal}** coins`);
      return i.reply({ embeds: [e], ephemeral: true });
    }
  
    if (n === "setrole") {
      const key = i.options.getString("key", true); // e.g., golden_nom
      const role = i.options.getRole("role", true);
      await setRole(i.guildId, key, role.id);
      return i.reply({ content: `✅ Set **${key}** → ${role}`, ephemeral: true });
    }
  
    if (n === "shop") {
      const sub = i.options.getSubcommand(true);
      if (sub === "list") {
        const { embed, components } = renderShopPage(i.guildId, 0);
        return i.reply({ embeds: [embed], components });
      }
      if (sub === "add") {
        const name = i.options.getString("name", true);
        const price = i.options.getInteger("price", true);
        const type = i.options.getString("type", true); // role | consumable
        const payload = i.options.getString("payload", true);
        await addShopItem(i.guildId, { name, price, type, payload });
        return i.reply({ content: `✅ Added **${name}** for ${price}c (${type})`, ephemeral: true });
      }
      if (sub === "remove") {
        const id = i.options.getString("id", true);
        await removeShopItem(i.guildId, id);
        return i.reply({ content: `🗑️ Removed item ${id}`, ephemeral: true });
      }
    }
  
    // Fallback buy by id
    if (n === "buy") {
      const itemId = i.options.getString("id", true);
      const it = getShopItem(i.guildId, itemId);
      if (!it) return i.reply({ content: "Item not found.", ephemeral: true });
      if (!spendCoins(i.guildId, i.user.id, it.price)) {
        const bal = getBalance(i.guildId, i.user.id);
        return i.reply({ content: `Not enough coins. You have ${bal}.`, ephemeral: true });
      }
  
      if (it.type === "role") {
        const roleId = it.payload;
        const role = await i.guild.roles.fetch(roleId).catch(() => null);
        const member = await i.guild.members.fetch(i.user.id);
        if (!role) return i.reply({ content: "Role not found. Tell an admin to fix the shop item.", ephemeral: true });
        await member.roles.add(role).catch(() => {});
        return i.reply({ content: `✅ Purchased **${it.name}** — role granted.`, ephemeral: true });
      } else {
        return i.reply({ content: `✅ Purchased **${it.name}** — enjoy!`, ephemeral: true });
      }
    }
  });
  
  client.login(token);
  