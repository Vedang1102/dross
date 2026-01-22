export interface Message {
  role: 'user' | 'assistant';
  content: string;
  mood?: string;
  mode?: string;
  timestamp?: string;
}

export interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export type Mood = 'happy' | 'sad' | 'stressed' | 'excited' | 'neutral';
export type Mode = 'friend' | 'research' | 'code';

export interface ChatResponse {
  response: string;
  mood: Mood;
  mode: Mode;
}
