import { config } from './config/index.js';
import { bot } from './bot/telegram.js';
import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('OpenGravity Agent is ALIVE!');
});

app.listen(port, () => {
  console.log(`Dummy web server listening on port ${port} to satisfy Render's health checks.`);
});

async function bootstrap() {
    console.log('Initializing OpenGravity Agent...');
    
    // Ensure at least one LLM provider is configured
    const hasGroq = config.groqApiKey && config.groqApiKey !== 'SUTITUYE POR EL TUYO';
    const hasOpenRouter = config.openrouterApiKey && config.openrouterApiKey !== 'SUTITUYE POR EL TUYO';

    if (!hasGroq && !hasOpenRouter) {
        console.error('ERROR: No LLM provider configured. Please set GROQ_API_KEY or OPENROUTER_API_KEY.');
        process.exit(1);
    }

    if (!hasGroq) {
        console.warn('WARNING: GROQ_API_KEY is missing. Agent will default to OpenRouter.');
    }

    try {
        // Render often starts the new instance before the old one is fully dead.
        // A small delay helps avoid the 409 Conflict error.
        console.log('Waiting 5 seconds for old instances to settle...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('Starting Telegram Bot with Long Polling...');
        await bot.start({
            onStart: (botInfo) => {
                console.log(`OpenGravity bot @${botInfo.username} is now online and listening.`);
            }
        });
    } catch (err: any) {
        if (err.message?.includes('409') || err.description?.includes('Conflict')) {
            console.error('\n⚠️  ERROR 409: CONFLICT. Multiple instances of the bot are running!');
            console.error('👉 If you are running the bot locally, STOP IT NOW.');
            console.error('👉 If it is on Render, wait 2 minutes for the old version to shut down.\n');
        } else {
            console.error('Failed to start OpenGravity:', err);
        }
        process.exit(1);
    }
}

// Handle graceful shutdown
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());

bootstrap();
