# OpenGravity

A personal, locally-hosted AI agent using Telegram as the sole interface. 
It uses an SQLite memory layer, customizable tools, and LLM providers via OpenAI-compatible endpoints (Groq primary, OpenRouter fallback).

## Prerequisites

1. Install [Node.js](https://nodejs.org/) (Download the LTS version for Windows).
2. Obtain API keys for Telegram and Groq.

## Setup Instructions

1. **Install Dependencies:**
   Open a terminal in this directory and run:
   ```bash
   npm install
   ```

2. **Configure Environment:**
   Open the `.env` file and replace the `SUTITUYE POR EL TUYO` strings with your actual API keys and Telegram User ID. You can find your Telegram User ID using bots like `@userinfobot`.

3. **Start the Agent:**
   Use the dev script to run the project via `tsx`:
   ```bash
   npm run dev
   ```

4. **Chat!**
   Open Telegram, message your bot, and ask it questions like "What time is it?".

## Scaling and Future Additions

OpenGravity's modular structure (`src/config`, `src/tools`, `src/bot`, `src/agent`) allows for:
- Connecting to text-to-speech services (ElevenLabs) via new Tool definitions.
- Running inside Docker containers or Cloud providers easily.
- Extending memory abstraction (`src/memory/db.ts`) to use Firebase if requested.

## Deploy to Render (24/7 Cloud)

To run this agent in the cloud so it's always online:

1. Create a repository on **GitHub** and push this folder's contents.
   *(Make sure `.env` and `service-account.json` are in your `.gitignore` and **NEVER** uploaded to GitHub).*
2. Create an account on [Render.com](https://render.com).
3. Click "New +" -> **"Web Service"** (or Background Worker).
4. Connect your GitHub account and select the OpenGravity repository.
5. Configuration:
   - **Environment:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
6. Scroll down to **Environment Variables** and add all the keys from your local `.env`:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_ALLOWED_USER_IDS`
   - `GROQ_API_KEY`
   - `OPENROUTER_API_KEY`
   - `OPENROUTER_MODEL`
   - `GOOGLE_APPLICATION_CREDENTIALS` (Since Render doesn't allow uploading files easily for free tiers, the bot logic should ideally read the JSON from an environment variable directly, or you can use a base64 encoded string. See alternative instructions below if Firebase fails).
   
> **Firebase Note for Render**: Since `service-account.json` cannot be pushed to Github, instead of using `GOOGLE_APPLICATION_CREDENTIALS` on Render, you should paste the *entire* raw JSON content of your `service-account.json` into a single Render Environment Variable called `FIREBASE_SERVICE_ACCOUNT`, and update your `src/memory/db.ts` to parse it like this: `admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))`.
