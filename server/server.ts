
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import express, { Request, Response } from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { saveMessage, getConversationHistory, Message } from './database';

const app = express();
app.use(cors());
app.use(express.json());

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
  if (/(code|debug|error|function|component|api|bug|programming)/i.test(lower)) return 'code';
  if (/(research|learn|explain|how does|what is|tell me about|study)/i.test(lower)) return 'research';
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
- Ask about the specific technology stack
- Suggest best practices and optimizations
- Keep explanations clear and actionable`
  };

  return prompts[mode];
};

// Generate AI response
const generateAIResponse = async (
  message: string,
  mood: Mood,
  mode: Mode,
  history: Message[]
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
  } catch (error) {
    console.error('Gemini API Error:', error);
    return "I'm having trouble connecting right now. Can you try again?";
  }
};

// Chat endpoint
app.post('/api/chat', async (req: Request<{}, {}, ChatRequest>, res: Response<ChatResponse>) => {
  try {
    const { message, sessionId = 'default', mode } = req.body;
    
    const detectedMood = detectMood(message);
    const detectedMode = detectMode(message, mode);
    
    await saveMessage(sessionId, 'user', message, detectedMood, detectedMode);
    
    const history = await getConversationHistory(sessionId, 10);
    
    const response = await generateAIResponse(message, detectedMood, detectedMode, history);
    
    await saveMessage(sessionId, 'assistant', response, detectedMood, detectedMode);
    
    res.json({
      response,
      mood: detectedMood,
      mode: detectedMode
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      response: "Something went wrong. Let's try that again.",
      mood: 'neutral',
      mode: (req.body.mode as Mode) || 'friend'
    });
  }
});

// Get conversation history endpoint
app.get('/api/history/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const history = await getConversationHistory(sessionId);
    res.json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'D.R.O.S.S is alive!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🧠 D.R.O.S.S server running on port ${PORT}`);
  console.log(`💾 Database: data/dross.db`);
});
