import OpenAI from 'openai';
import { config } from '../config/index.js';
import { toolsDefinitions, executeTool } from '../tools/index.js';
import { memory, ChatMessage } from '../memory/db.js';

// Groq client
const groq = new OpenAI({
    apiKey: config.groqApiKey,
    baseURL: 'https://api.groq.com/openai/v1',
});

// OpenRouter fallback client
const openRouter = new OpenAI({
    apiKey: config.openrouterApiKey || 'disabled',
    baseURL: 'https://openrouter.ai/api/v1',
});

const MAX_ITERATIONS = 5;

export async function runAgentLoop(userId: string, userMessage: string): Promise<string> {
    // 1. Save user message
    await memory.addMessage(userId, { role: 'user', content: userMessage });

    let iterations = 0;
    while (iterations < MAX_ITERATIONS) {
        iterations++;

        // Retrieve recent memory context for this specific user
        const messages = await memory.getRecentMessages(userId, 20);

        // Ensure system prompt is at the top
        const systemPrompt: ChatMessage = {
            role: 'system',
            content: `Eres OpenGravity, un asistente de IA avanzado y ultrapotente. 
Tu idioma principal y ÚNICO es el ESPAÑOL. Responde SIEMPRE en español con naturalidad.
Eres un experto en cualquier tema: programación, ciencia, historia, consejos, redacción creativa y resolución de problemas.
No pongas límites a tu ayuda: si el usuario pregunta algo, dale la mejor respuesta posible, detallada y útil. 
Usa herramientas si es necesario, pero confía en tu vasto conocimiento general para responder a cualquier pregunta.`
        };

        const apiMessages = [systemPrompt, ...messages].map(m => {
            const out: any = { role: m.role };
            if (m.content) out.content = m.content;
            if (m.name) out.name = m.name;
            if (m.tool_calls) out.tool_calls = m.tool_calls;
            if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
            return out;
        });

        let response;
        try {
            response = await groq.chat.completions.create({
                model: 'llama-3.3-70b-specdec', // Standard fast free/groq model
                messages: apiMessages,
                tools: toolsDefinitions as any,
                tool_choice: 'auto'
            });
        } catch (error: any) {
            console.warn("Groq failed, attempting OpenRouter fallback...", error.message);
            if (!config.openrouterApiKey) {
                return "Lo siento, el servicio de IA no está disponible en este momento. Por favor, intenta más tarde.";
            }
            response = await openRouter.chat.completions.create({
                model: config.openrouterModel,
                messages: apiMessages,
                tools: toolsDefinitions as any,
                tool_choice: 'auto'
            });
        }

        const choice = response.choices[0];
        const message = choice.message;

        // Save assistant message (which might contain content and/or tool calls)
        await memory.addMessage(userId, {
            role: 'assistant',
            content: message.content || '',
            tool_calls: message.tool_calls as any
        });

        if (choice.finish_reason === 'tool_calls' && message.tool_calls) {
            // Execute tools
            for (const toolCall of message.tool_calls) {
                const funcName = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments || '{}');

                try {
                    const result = await executeTool(funcName, args);
                    await memory.addMessage(userId, {
                        role: 'tool',
                        content: JSON.stringify(result),
                        tool_call_id: toolCall.id,
                        name: funcName
                    });
                } catch (err: any) {
                    await memory.addMessage(userId, {
                        role: 'tool',
                        content: JSON.stringify({ error: err.message }),
                        tool_call_id: toolCall.id,
                        name: funcName
                    });
                }
            }
            // Continue the loop to report tool results to the LLM
            continue;
        } else {
            // Final text response
            return message.content || '(Respuesta vacía)';
        }
    }

    return "Lo siento, me he liado un poco pensando y no he podido terminar la respuesta. Inténtalo de nuevo, por favor.";
}
