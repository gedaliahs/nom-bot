import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';
import { getRandomResponse, initResponses } from './responses.js';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('ERROR: DISCORD_TOKEN is not set.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent // REQUIRED to read message text
  ],
  partials: [Partials.Channel]
});

// Precompute the 1,000 unique responses once on startup.
const RESPONSES = initResponses(1000);

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Logged in as ${c.user.tag}. Ready to nom.`);
});

client.on(Events.MessageCreate, async (message) => {
  // Ignore bots and system/webhook messages
  if (!message || message.author?.bot) return;

  const content = message.content ?? '';
  // Case-insensitive match: any occurrence of "nom"
  if (/\bnom\b/i.test(content) || /nom/i.test(content)) {
    try {
      // Avoid infinite loops if the bot’s own message triggers on certain clients
      // (discord.js already ignores our MessageCreate unless webhooks, but we’re cautious)
      const replyText = getRandomResponse(RESPONSES);
      // Prefer replying to keep threads tidy; fallback to channel send if not allowed
      if (message.channel?.type && message.reply) {
        await message.reply({ content: replyText, allowedMentions: { repliedUser: false } });
      } else {
        await message.channel.send({ content: replyText });
      }
    } catch (err) {
      console.error('Failed to send reply:', err);
    }
  }
});

client.login(token);
