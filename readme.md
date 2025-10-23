# nom-bot

A tiny Discord bot that replies to **any message containing "nom"** with a random reply from **1,000 unique responses**. Built with Node 20 and discord.js v14. Designed for easy deployment on **Render** as a Worker service.

## Quick Start (Local)

1. **Create bot & token**
   - Go to https://discord.com/developers/applications → New Application.
   - Add a **Bot**. Copy the **Token**.
   - Under **Privileged Gateway Intents**, enable:
     - MESSAGE CONTENT INTENT (required)
     - (Guilds/Guild Messages are enabled via code)
2. **Invite it to your server**
   - OAuth2 → URL Generator:
     - Scopes: `bot`
     - Bot Permissions: `Send Messages`, `Read Message History`
   - Visit the generated URL to add the bot.
3. **Run**
   ```bash
   cp .env.example .env
   # paste your token into .env
   npm ci
   npm start
