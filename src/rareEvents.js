import { EmbedBuilder } from "discord.js";
import { getRole } from "./db.js";

// 1/200 chance on each qualifying message
const RARE_CHANCE = 1 / 200;

export async function maybeRunRareEvent(client, message) {
  if (Math.random() > RARE_CHANCE) return;

  const roll = Math.random();
  if (roll < 0.34) {
    // Massive embed
    const e = new EmbedBuilder()
      .setTitle("🌟 RARE NOM EVENT")
      .setDescription("The crumbs align. A rare nom passes through the server.")
      .addFields(
        { name: "Witness", value: `<@${message.author.id}>` },
        { name: "Omen", value: "Seek the Golden Nom." }
      )
      .setColor(0xffd166);
    await message.channel.send({ embeds: [e] }).catch(() => {});
    return;
  }

  if (roll < 0.67) {
    // GIF reaction (just a link; no external API)
    await message.channel.send("https://media.tenor.com/5o0n1kG4N6IAAAAC/cookie-monster-cookies.gif").catch(() => {});
    return;
  }

  // Golden role reward to the author if configured
  const roleId = getRole(message.guild.id, "golden_nom");
  if (!roleId) {
    await message.channel.send("✨ A golden nom drifted by... (no golden_nom role set)").catch(() => {});
    return;
  }
  const role = await message.guild.roles.fetch(roleId).catch(() => null);
  if (!role) {
    await message.channel.send("✨ Golden nom tried to land, but the role is missing.").catch(() => {});
    return;
  }
  const member = await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!member) return;

  await member.roles.add(role).catch(() => {});
  await message.channel.send(`👑 **RARE DROP:** <@${message.author.id}> received ${role}!`).catch(() => {});
}
