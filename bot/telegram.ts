import { Bot } from 'grammy';
import { config } from '../config/index.js';
import { runAgentLoop } from '../agent/index.js';
import { transcribeAudio } from './transcription.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';

export const bot = new Bot(config.telegramBotToken);

// Middleware for auth whitelist
bot.use(async (ctx, next) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return; // ignore system messages without user

    if (!config.telegramAllowedUserIds.includes(userId)) {
        console.warn(`Unauthorized access attempt from User ID: ${userId}`);
        // Optionally reply: await ctx.reply("Unauthorized.");
        return;
    }

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
                await ctx.reply("Sorry, I couldn't download the audio file.");
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
                await ctx.reply("Error: The downloaded audio file is empty.");
                return;
            }

            // Send typing indicator
            await ctx.api.sendChatAction(ctx.chat.id, 'typing');

            // Transcribe via Groq Whisper (direct buffer)
            userMessage = await transcribeAudio(buffer);
            
            if (!userMessage) {
                 await ctx.reply("Sorry, I could not hear anything in that audio.");
                 return;
            }
            
            console.log(`Transcribed audio: "${userMessage}"`);
        }

        if (!userMessage) return; // Skip if it's empty

        const response = await runAgentLoop(userMessage);
        await ctx.reply(response);
    } catch (error: any) {
        console.error("Agent error:", error);
        await ctx.reply(`Sorry, I encountered an internal error: ${error.message}`);
    }
});
