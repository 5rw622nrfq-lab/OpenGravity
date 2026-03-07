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
    
    // Ensure critical configs
    if (!config.telegramBotToken || config.telegramBotToken === 'SUTITUYE POR EL TUYO') {
        console.error('ERROR: TELEGRAM_BOT_TOKEN is missing or default.');
        process.exit(1);
    }
    if (!config.groqApiKey || config.groqApiKey === 'SUTITUYE POR EL TUYO') {
        console.error('ERROR: GROQ_API_KEY is missing or default.');
        process.exit(1);
    }

    try {
        console.log('Starting Telegram Bot with Long Polling...');
        await bot.start({
            onStart: (botInfo) => {
                console.log(`OpenGravity bot @${botInfo.username} is now online and listening.`);
            }
        });
    } catch (err) {
        console.error('Failed to start OpenGravity:', err);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());

bootstrap();
