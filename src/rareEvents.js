import { EmbedBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import { RARE } from "./config.js";

const lastGuildProcAt = new Map(); // guildId -> timestamp

function onCooldown(guildId) {
  const now = Date.now();
  const prev = lastGuildProcAt.get(guildId) || 0;
  if (now - prev < RARE.COOLDOWN_MS) return true;
  lastGuildProcAt.set(guildId, now);
  return false;
}

// Weighted picker (lightweight)
function pickWeighted(items) {
  const total = items.reduce((s, i) => s + (i.weight ?? 1), 0);
  let r = Math.random() * total;
  for (const i of items) {
    r -= (i.weight ?? 1);
    if (r <= 0) return i;
  }
  return items.at(-1);
}

async function eventBigEmbed(message) {
  const embed = new EmbedBuilder()
    .setTitle("🌟 GOLDEN NOM EVENT!")
    .setDescription(
      [
        "A rare **NOM PHENOMENON** just occurred.",
        "",
        "You’ve unlocked a **shiny** nom moment. Bask in the crumbs.",
        "Keep chatting — more rare events may drop at any time."
      ].join("\n")
    )
    .setColor(0xF4C430) // gold-ish
    .addFields(
      { name: "Triggered by", value: `<@${message.author.id}>`, inline: true },
      { name: "Odds", value: `1 in ${RARE.CHANCE_DENOMINATOR}`, inline: true }
    )
    .setFooter({ text: "Collect them all. Or don't. I'm just a bot." })
    .setTimestamp();

  await message.channel.send({ embeds: [embed] });
}

async function eventGifReply(message) {
  const url = RARE.GIFS[(Math.random() * RARE.GIFS.length) | 0];
  await message.reply({ content: "GOLDEN NOM DROP 🎁", files: [url], allowedMentions: { repliedUser: false } });
}

async function eventReactionBurst(message) {
  // React with up to 3 random emojis (silently ignore failures)
  const shuffled = [...RARE.REACTIONS].sort(() => Math.random() - 0.5).slice(0, 3);
  for (const emoji of shuffled) {
    try { await message.react(emoji); } catch {}
  }
}

async function eventGoldenRole(message) {
  const roleId = RARE.GOLDEN_ROLE_ID;
  if (!roleId) return; // disabled
  const guild = message.guild;
  if (!guild) return;
  const member = await guild.members.fetch(message.author.id).catch(() => null);
  if (!member) return;

  const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
  if (!role) return;

  const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) return;
  if (role.position >= me.roles.highest.position) return; // cannot assign higher/equal role

  if (!member.roles.cache.has(roleId)) {
    await member.roles.add(roleId).catch(() => null);
    await message.channel.send(`🏅 **Golden Nom** awarded to <@${member.id}>!`);
  } else {
    // Already has it — do something else instead
    await eventReactionBurst(message);
  }
}

async function eventStatusFlare(client) {
  const line = RARE.STATUS_LINES[(Math.random() * RARE.STATUS_LINES.length) | 0];
  try { await client.user.setActivity(line); } catch {}
}

async function eventThreadPop(message) {
  // Create a short-lived thread celebrating the moment
  if (message.channel?.type !== ChannelType.GuildText) return;
  const name = `golden-nom-${(Math.random() * 9999 | 0).toString().padStart(4, "0")}`;
  const thread = await message.startThread({
    name,
    autoArchiveDuration: 60, // minutes until auto-archive
    reason: "Golden nom pop-up thread"
  }).catch(() => null);
  if (thread) {
    await thread.send("🎉 This is a **golden nom** pop-up thread. Say nom to keep it alive!");
  }
}

// Define your rare event pool with basic weights
const EVENT_POOL = [
  { name: "bigEmbed", run: (client, msg) => eventBigEmbed(msg), weight: 3 },
  { name: "gifReply", run: (client, msg) => eventGifReply(msg), weight: 3 },
  { name: "reactionBurst", run: (client, msg) => eventReactionBurst(msg), weight: 2 },
  { name: "goldenRole", run: (client, msg) => eventGoldenRole(msg), weight: 1 },
  { name: "statusFlare", run: (client) => eventStatusFlare(client), weight: 1 },
  { name: "threadPop", run: (client, msg) => eventThreadPop(msg), weight: 1 }
];

export async function maybeRunRareEvent(client, message) {
  const guildId = message.guild?.id;
  if (!guildId) return;

  // Cooldown gate
  if (onCooldown(guildId)) return;

  // RNG gate (1 / CHANCE_DENOMINATOR)
  if (Math.floor(Math.random() * RARE.CHANCE_DENOMINATOR) !== 0) return;

  const picked = pickWeighted(EVENT_POOL);
  try {
    await picked.run(client, message);
  } catch (e) {
    console.error(`[rareEvents] ${picked.name} failed:`, e);
  }
}
