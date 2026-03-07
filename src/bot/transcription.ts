import { config } from '../config/index.js';

/**
 * Transcribes audio using Gemini Flash via OpenRouter.
 * This is the ONLY transcription method now. It avoids all multipart/EOF errors
 * by using base64 encoding within a standard JSON payload.
 */
export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
    console.log(`[Transcription] Starting Gemini Flash transcription. Size: ${audioBuffer.length} bytes`);
    
    if (!config.openrouterApiKey) {
        throw new Error("OPENROUTER_API_KEY is missing. It is required for transcription.");
    }

    try {
        const base64Audio = audioBuffer.toString('base64');
        const dataUri = `data:audio/ogg;base64,${base64Audio}`;
        
        const payload = {
            model: 'google/gemini-flash-1.5',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: "Extract and transcribe exactly what is said in this audio. Output only the transcribed text, nothing else. If there is no speech, return an empty string. Important: Response language should match the audio language (Spanish/English)."
                        },
                        {
                            type: 'image_url', // Standard OpenRouter field for media via data URIs
                            image_url: {
                                url: dataUri
                            }
                        }
                    ]
                }
            ],
            temperature: 0.1 // Low temperature for higher accuracy in transcription
        };

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.openrouterApiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/OpenGravity/OpenGravity',
                'X-Title': 'OpenGravity Agent'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[Transcription] OpenRouter API Error: ${response.status}`, errText);
            throw new Error(`OpenRouter reported an error: ${response.status}`);
        }

        const json: any = await response.json();
        const text = json.choices?.[0]?.message?.content?.trim();
        
        if (!text) {
            console.log("[Transcription] No transcription returned (likely empty audio).");
            return "";
        }

        console.log(`[Transcription] Success! Result: "${text.substring(0, 50)}..."`);
        return text;

    } catch (error: any) {
        console.error("[Transcription] Failure:", error.message);
        throw new Error(`Transcription failed: ${error.message}`);
    }
}
