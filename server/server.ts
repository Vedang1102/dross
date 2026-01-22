import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  saveMessage,
  getConversationHistory,
  createSession,
  getAllSessions,
  updateSessionTitle,
  deleteSession,
  Message,
  Session
} from './database';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Handle longer messages

// Types
type Mood = 'happy' | 'sad' | 'stressed' | 'excited' | 'neutral';
type Mode = 'friend' | 'research' | 'code';

interface ChatRequest {
  message: string;
  sessionId?: string;
  mode?: Mode;
}

interface ChatResponse {
  response: string;
  mood: Mood;
  mode: Mode;
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

console.log('🔑 Gemini API Key loaded:', process.env.GEMINI_API_KEY ? 'YES ✅' : 'NO ❌');
console.log('🚀 D.R.O.S.S Server starting...');

// Global error handler
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    response: "Something went wrong internally. Please try again.",
    mood: 'neutral',
    mode: 'friend'
  });
});

// Middleware to validate API key
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'Service temporarily unavailable - configuration issue'
    });
  }
  next();
});

// Mood detection
const detectMood = (text: string): Mood => {
  const lower = text.toLowerCase();
  if (/(happy|great|awesome|excited|amazing|wonderful)/i.test(lower)) return 'happy';
  if (/(sad|depressed|down|lonely|upset)/i.test(lower)) return 'sad';
  if (/(stress|anxious|worried|overwhelmed|tired|drained)/i.test(lower)) return 'stressed';
  if (/(excited|can't wait|looking forward|pumped)/i.test(lower)) return 'excited';
  return 'neutral';
};

// Context mode detection
const detectMode = (text: string, currentMode?: Mode): Mode => {
  const lower = text.toLowerCase();
  if (/(code|debug|error|function|component|api|bug|programming|react|angular|typescript)/i.test(lower)) return 'code';
  if (/(research|learn|explain|how does|what is|tell me about|study|researching)/i.test(lower)) return 'research';
  return currentMode || 'friend';
};

// Build system prompt based on mode
const getSystemPrompt = (mode: Mode, mood: Mood): string => {
  const prompts: Record<Mode, string> = {
    friend: `You are D.R.O.S.S (Digital Recovery Optimizer for Soulful Systems), a caring AI companion focused on emotional support and daily wellness. 

Your role:
- Be empathetic and conversational, like a close friend
- Keep responses concise (2-4 sentences) unless user asks for detail  
- Detect and respond to the user's mood sensitively
- Don't overwhelm with information - prioritize emotional connection
- Ask follow-up questions to understand their state better

Current detected mood: ${mood}. Respond accordingly.`,

    research: `You are D.R.O.S.S in Research Mode - a deep-thinking AI that helps explore topics thoroughly.

Your role:
- Provide detailed, well-structured explanations
- Break down complex topics into understandable parts
- Cite reasoning and suggest further areas to explore
- Be intellectually curious and thorough
- Ask clarifying questions when needed`,

    code: `You are D.R.O.S.S in Code Mode - a programming assistant helping debug and explain code.

Your role:
- Help debug errors and explain technical concepts
- Provide code examples when relevant
- Ask about the specific technology stack (React, Angular, Node, etc.)
- Suggest best practices and optimizations
- Keep explanations clear and actionable`
  };

  return prompts[mode];
};

// Generate AI response with retry logic
const generateAIResponse = async (
  message: string,
  mood: Mood,
  mode: Mode,
  history: Message[],
  retries: number = 2
): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const systemPrompt = getSystemPrompt(mode, mood);
    const conversationHistory = history.slice(-6).map(msg => 
      `${msg.role === 'user' ? 'User' : 'D.R.O.S.S'}: ${msg.content}`
    ).join('\n');
    
    const prompt = `${systemPrompt}

Previous conversation:
${conversationHistory}

User (${mood}): ${message}

D.R.O.S.S:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    
    // Retry logic
    if (retries > 0 && error?.status !== 400 && error?.status !== 403) {
      console.log(`⚠️ Retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return generateAIResponse(message, mood, mode, history, retries - 1);
    }
    
    // Context-specific error messages
    if (error?.status === 429) {
      return "I'm getting rate limited. Give me a minute and try again! 🕐";
    }
    if (error?.status === 400 || error?.status === 403) {
      return "Something about that message confused me. Can you rephrase it? 🤔";
    }
    return "I'm having trouble connecting right now. Can you try again? 🔄";
  }
};

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'D.R.O.S.S is alive!', 
    timestamp: new Date().toISOString(),
    geminiReady: !!process.env.GEMINI_API_KEY 
  });
});

// Get all sessions
app.get('/api/sessions', async (req: Request, res: Response<Session[]>) => {
  try {
    const sessions = await getAllSessions();
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json([]);
  }
});

// Create new session
app.post('/api/sessions', async (req: Request<{}, {}, { title?: string }>, res: Response<{ id: string; title: string }>) => {
  try {
    const sessionId = 'session-' + Date.now();
    const title = req.body.title || 'New Chat';
    await createSession(sessionId, title);
    res.json({ id: sessionId, title });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ id: '', title: '' });
  }
});

// Update session title
app.patch('/api/sessions/:sessionId', async (req: Request<{ sessionId: string }, {}, { title: string }>, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { title } = req.body;
    await updateSessionTitle(sessionId, title);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Delete session
app.delete('/api/sessions/:sessionId', async (req: Request<{ sessionId: string }>, res: Response) => {
  try {
    const { sessionId } = req.params;
    await deleteSession(sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// Get conversation history
app.get('/api/history/:sessionId', async (req: Request<{ sessionId: string }>, res: Response<Message[]>) => {
  try {
    const sessionId = req.params.sessionId;
    const history = await getConversationHistory(sessionId, 50); // Increased limit
    res.json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json([]);
  }
});

// Chat endpoint - Main AI functionality
app.post('/api/chat', async (req: Request<{}, {}, ChatRequest>, res: Response<ChatResponse>) => {
  const startTime = Date.now();
  
  try {
    const { message, sessionId = 'default', mode } = req.body;
    
    // Validate input
    if (!message || !message.trim()) {
      return res.status(400).json({
        response: "I didn't catch that. Can you type something?",
        mood: 'neutral',
        mode: mode || 'friend'
      });
    }

    const trimmedMessage = message.trim();
    await createSession(sessionId, trimmedMessage.substring(0, 50) + '...');
    
    const detectedMood = detectMood(trimmedMessage);
    const detectedMode = detectMode(trimmedMessage, mode);
    
    // Log chat activity
    console.log(`💬 [${sessionId}] ${detectedMode} | mood=${detectedMood} | "${trimmedMessage.slice(0, 40)}..."`);
    
    // Save user message
    await saveMessage(sessionId, 'user', trimmedMessage, detectedMood, detectedMode);
    
    // Load context
    const history = await getConversationHistory(sessionId, 10);
    
    // Generate response
    const response = await generateAIResponse(trimmedMessage, detectedMood, detectedMode, history);
    
    // Save assistant response
    await saveMessage(sessionId, 'assistant', response, detectedMood, detectedMode);
    
    const responseTime = Date.now() - startTime;
    console.log(`⏱️ [${sessionId}] Response generated in ${responseTime}ms`);
    
    res.json({
      response,
      mood: detectedMood,
      mode: detectedMode
    });
  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({ 
      response: "Something went wrong. Let's try that again.",
      mood: 'neutral',
      mode: (req.body.mode as Mode) || 'friend'
    });
  }
});

const PORT = parseInt(process.env.PORT || '5000');
app.listen(PORT, () => {
  console.log(`🧠 D.R.O.S.S server running on port ${PORT}`);
  console.log(`💾 Database: data/dross.db`);
  console.log('📊 Endpoints: /health, /sessions, /chat, /history/:id');
  console.log('🎯 Ready for production!');
});
