import { Bot } from 'grammy';
import { config } from '../config/index.js';
import { runAgentLoop } from '../agent/index.js';
import { transcribeAudio } from './transcription.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';

export const bot = new Bot(config.telegramBotToken);

// Diagnostics / Start command
bot.command('start', async (ctx) => {
    await ctx.reply("🚀 ¡El Agente OpenGravity está ONLINE y listo!\n\nPuedes hablar conmigo o enviarme una nota de voz. Responderé siempre en español.");
});

bot.command('borrar', async (ctx) => {
    await memory.clearMemory();
    await ctx.reply("✅ Memoria borrada. ¡Empecemos de cero!");
});

// Middleware to log user IDs
bot.use(async (ctx, next) => {
    const userId = ctx.from?.id.toString();
    console.log("User:", userId);
    await next();
});

// Handle text and voice messages
bot.on(['message:text', 'message:voice', 'message:audio'], async (ctx) => {
    let userMessage = ctx.message.text || ctx.message.caption;

    // Show typing indicator
    if (ctx.chat?.id) {
        await ctx.api.sendChatAction(ctx.chat.id, 'typing');
    }

    try {
        if (ctx.message.voice || ctx.message.audio) {
            const fileId = ctx.message.voice ? ctx.message.voice.file_id : ctx.message.audio!.file_id;
            const file = await ctx.api.getFile(fileId);
            
            if (!file.file_path) {
                await ctx.reply("Lo siento, no pude descargar el archivo de audio.");
                return;
            }

            // Download file from Telegram servers using Axios with safety timeout
            const url = `https://api.telegram.org/file/bot${config.telegramBotToken}/${file.file_path}`;
            const audioRes = await axios.get(url, { 
                responseType: 'arraybuffer',
                timeout: 30000 // 30 seconds
            });
            const buffer = Buffer.from(audioRes.data);
            
            console.log(`Downloaded audio for transcription. Size: ${buffer.length} bytes`);
            
            if (buffer.length === 0) {
                await ctx.reply("Error: El archivo de audio descargado está vacío.");
                return;
            }

            // Send typing indicator
            await ctx.api.sendChatAction(ctx.chat.id, 'typing');

            // Transcribe via Gemini Flash (multimodal data URI)
            userMessage = await transcribeAudio(buffer);
            
            if (!userMessage) {
                 await ctx.reply("Lo siento, no pude escuchar nada en ese audio. ¿Podrías repetirlo?");
                 return;
            }
            
            console.log(`Transcribed audio: "${userMessage}"`);
        }

        if (!userMessage) return; // Skip if it's empty

        const response = await runAgentLoop(userMessage);
        await ctx.reply(response);
    } catch (error: any) {
        console.error("Agent error:", error);
        await ctx.reply(`Lo siento, encontré un error interno: ${error.message}`);
    }
});
