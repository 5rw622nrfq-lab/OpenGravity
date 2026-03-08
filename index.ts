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

export async function runAgentLoop(userMessage: string): Promise<string> {
    // 1. Save user message
    await memory.addMessage({ role: 'user', content: userMessage });

    let iterations = 0;
    while (iterations < MAX_ITERATIONS) {
        iterations++;

        // Retrieve recent memory context
        const messages = await memory.getRecentMessages(20);

        // Ensure system prompt is at the top
        const systemPrompt: ChatMessage = {
            role: 'system',
            content: "Eres OpenGravity, un agente de IA personal. Tu idioma principal y ÚNICO es el ESPAÑOL. Debes responder SIEMPRE en español, sin importar en qué idioma te hablen. Sé conciso, servicial y directo. Usa herramientas cuando sea necesario."
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
                return "Error: LLM API failing and OpenRouter fallback is not configured.";
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
        await memory.addMessage({
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
                    await memory.addMessage({
                        role: 'tool',
                        content: JSON.stringify(result),
                        tool_call_id: toolCall.id,
                        name: funcName
                    });
                } catch (err: any) {
                    await memory.addMessage({
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
            return message.content || '(Empty Response)';
        }
    }

    return "Error: Agent reached maximum iterations without reaching a final response.";
}
