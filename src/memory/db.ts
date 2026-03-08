import admin from 'firebase-admin';
import { config } from '../config/index.js';

export interface ChatMessage {
    id?: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | null;
    name?: string; // used for tool calls/responses
    tool_calls?: any; // JSON object/array of tool calls
    tool_call_id?: string;
    timestamp?: number;
}

// Initialize Firebase Admin globally
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // Deploy scenario (Render.com) where file upload is restricted
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
        });
    } else {
        // Local scenario
        const serviceAccountPath = config.googleAppCredentials;
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccountPath),
        });
    }
} catch(e: any) {
  if (e.message.includes('already exists')) {
     // Already initialized
  } else {
     console.error(`Failed to initialize Firebase Admin:`, e.message);
     console.warn("Make sure FIREBASE_SERVICE_ACCOUNT is set or GOOGLE_APPLICATION_CREDENTIALS points to a valid file.");
  }
}

const db = admin.firestore();

export const memory = {
    addMessage: async (userId: string, msg: ChatMessage) => {
        try {
            await db.collection('messages').add({
                userId, // Identify whose message this is
                role: msg.role,
                content: msg.content ?? null,
                name: msg.name ?? null,
                tool_calls: msg.tool_calls ? JSON.stringify(msg.tool_calls) : null,
                tool_call_id: msg.tool_call_id ?? null,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (e) {
            console.error(`Error saving message for user ${userId} to Firestore:`, e);
        }
    },

    getRecentMessages: async (userId: string, limit: number = 20): Promise<ChatMessage[]> => {
        try {
            const snapshot = await db.collection('messages')
                .where('userId', '==', userId) // Filter by user
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();

            const rows: any[] = [];
            snapshot.forEach(doc => {
                 rows.push({ id: doc.id, ...doc.data() });
            });

            // Reverse to get chronological order required by APIs
            rows.reverse();

            return rows.map(row => {
                const msg: ChatMessage = {
                    id: row.id,
                    role: row.role,
                    content: row.content,
                };
                if (row.name) msg.name = row.name;
                if (row.tool_call_id) msg.tool_call_id = row.tool_call_id;
                if (row.tool_calls) msg.tool_calls = JSON.parse(row.tool_calls);
                return msg;
            });
        } catch (e) {
             console.error(`Error getting messages for user ${userId} from Firestore:`, e);
             return [];
        }
    },

    clearMemory: async (userId: string) => {
         try {
             const snapshot = await db.collection('messages')
                .where('userId', '==', userId)
                .get();
             
             const batch = db.batch();
             snapshot.docs.forEach((doc) => {
                 batch.delete(doc.ref);
             });
             await batch.commit();
         } catch (e) {
              console.error(`Error clearing memory for user ${userId}:`, e);
         }
    }
};
