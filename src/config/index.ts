import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config();

function getEnv(key: string, required: boolean = true): string {
    const value = process.env[key];
    if (required && !value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value || '';
}

export const config = {
    telegramBotToken: getEnv('TELEGRAM_BOT_TOKEN'),
    telegramAllowedUserIds: getEnv('TELEGRAM_ALLOWED_USER_IDS', false)
        .split(',')
        .map(id => id.trim())
        .filter(Boolean),
    groqApiKey: getEnv('GROQ_API_KEY', false),
    openrouterApiKey: getEnv('OPENROUTER_API_KEY', false), // optional fallback
    openrouterModel: getEnv('OPENROUTER_MODEL', false) || 'openrouter/free',
    googleAppCredentials: getEnv('GOOGLE_APPLICATION_CREDENTIALS', false) || './service-account.json',
};
