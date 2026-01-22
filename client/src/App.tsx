import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import {
  Send, Brain, Heart, Code, Search, Plus, Trash2, Edit3, ChevronLeft, ChevronRight,
  MessageCircle, Settings, LogOut, Copy, Check, Sparkles, Zap, BookOpen
} from 'lucide-react';
import { Message, Session, Mode, ChatResponse } from './types';
import { branding } from '../../config/branding';
import './App.css';

interface AppProps {}

const App: React.FC<AppProps> = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('default');
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [currentMode, setCurrentMode] = useState<Mode>('friend');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [newSessionTitle, setNewSessionTitle] = useState<string>('');
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load initial data
  useEffect(() => {
    loadSessions();
    loadHistory(currentSessionId);
  }, []);

  // Load sessions
  const loadSessions = async () => {
    try {
      const response = await axios.get<Session[]>('http://localhost:5000/api/sessions');
      setSessions(response.data);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  // Load conversation history
  const loadHistory = async (sessionId: string) => {
    try {
      const response = await axios.get<Message[]>(`http://localhost:5000/api/history/${sessionId}`);
      setMessages(response.data);
      setCurrentSessionId(sessionId);
    } catch (error) {
      console.error('Error loading history:', error);
      setMessages([]);
    }
  };

  // Auto-scroll
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { 
      role: 'user', 
      content: input.trim(),
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    const tempInput = input;
    setInput('');
    setLoading(true);

    try {
      const response = await axios.post<ChatResponse>('http://localhost:5000/api/chat', {
        message: tempInput,
        sessionId: currentSessionId,
        mode: currentMode
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.response,
        mood: response.data.mood,
        mode: response.data.mode,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
      if (response.data.mode !== currentMode) {
        setCurrentMode(response.data.mode);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        mood: 'neutral',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setLoading(false);
      loadSessions(); // Refresh session list
    }
  }, [input, loading, currentSessionId, currentMode]);

const createNewSession = async () => {
  try {
    const response = await axios.post<{ id: string; title: string }>('http://localhost:5000/api/sessions', { title: 'New Chat' });
    const apiData = response.data;
    // Full Session object matching interface
    const newSession: Session = {
      id: apiData.id,
      title: apiData.title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Add other required fields if defined in types.ts, e.g., messageCount: 0
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    loadHistory(newSession.id);
    setNewSessionTitle('');
  } catch (error) {
    console.error('Error creating session:', error);
  }
};


  const deleteSession = async (sessionId: string) => {
    try {
      await axios.delete(`http://localhost:5000/api/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        // Switch to another session or create new
        const otherSession = sessions[1];
        if (otherSession) {
          loadHistory(otherSession.id);
        } else {
          createNewSession();
        }
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const updateSessionTitle = async (sessionId: string) => {
    try {
      await axios.patch(`http://localhost:5000/api/sessions/${sessionId}`, { title: newSessionTitle });
      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, title: newSessionTitle } : s
      ));
      setEditingSession(null);
      setNewSessionTitle('');
    } catch (error) {
      console.error('Error updating title:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    setInput(target.value);
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
  };

  const getModeIcon = (mode?: string) => {
    switch (mode) {
      case 'code': return <Code size={16} />;
      case 'research': return <Search size={16} />;
      default: return <Heart size={16} />;
    }
  };

  const getMoodColor = (mood?: string) => {
    switch (mood) {
      case 'happy': return 'bg-green-500/20 border-green-500/50 text-green-400';
      case 'stressed': return 'bg-orange-500/20 border-orange-500/50 text-orange-400';
      case 'sad': return 'bg-blue-500/20 border-blue-500/50 text-blue-400';
      case 'excited': return 'bg-purple-500/20 border-purple-500/50 text-purple-400';
      default: return 'bg-gray-500/20 border-gray-500/50 text-gray-400';
    }
  };

  const copyToClipboard = async (text: string, messageId: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const suggestedPrompts = [
    { icon: <Heart size={20} />, text: "How are you feeling today?", mood: "friend" },
    { icon: <Code size={20} />, text: "Help me debug this code", mood: "code" },
    { icon: <BookOpen size={20} />, text: "Explain quantum computing to me", mood: "research" },
    { icon: <Sparkles size={20} />, text: "What's something interesting I should know?", mood: "friend" }
  ];

  const handlePromptClick = (promptText: string) => {
    setInput(promptText);
    inputRef.current?.focus();
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <motion.aside 
        className="sidebar"
        initial={false}
        animate={{ width: sidebarOpen ? 320 : 0 }}
        transition={{ type: 'tween', duration: 0.2, ease: 'easeInOut' }}
      >
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <Brain size={24} className="logo" />
            <span>{branding.name}</span>
          </div>
        </div>

        <div className="sessions-list">
          <div className="sessions-header">
            <h3>Chats</h3>
            <button onClick={createNewSession} className="new-chat-btn">
              <Plus size={16} />
            </button>
          </div>
          
          <AnimatePresence>
            {sessions.map((session) => (
              <motion.div
                key={session.id}
                className={`session-item ${currentSessionId === session.id ? 'active' : ''}`}
                onClick={() => loadHistory(session.id)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.15 }}
              >
                <div className="session-info">
                  <MessageCircle size={16} />
                  <span className="session-title">{session.title}</span>
                  <span className="session-meta">
                    {session.message_count || 0} messages
                  </span>
                </div>
                <div className="session-actions">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingSession(session.id);
                      setNewSessionTitle(session.title);
                    }}
                    title="Rename"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.aside>

      {/* Main Chat Area */}
      <main className="main-chat">
        {/* Floating toggle button */}
        <button 
          className="sidebar-toggle-floating"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
        
        <header className="chat-header">
          <div className="header-left">
            <span className="session-title">
              {sessions.find(s => s.id === currentSessionId)?.title || 'New Chat'}
            </span>
          </div>
          <div className="header-right">
            <div className="mode-indicator">
              {getModeIcon(currentMode)}
              <span>{currentMode}</span>
            </div>
          </div>
        </header>

        <div className="chat-container" ref={chatContainerRef}>
          {/* Empty State */}
          {messages.length === 0 && !loading && (
            <motion.div 
              className="empty-state"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="empty-state-icon">
                <Brain size={64} />
              </div>
              <h2>Hey! {branding.name} here</h2>
              <p>{branding.tagline}</p>
              
              <div className="suggested-prompts">
                <h3>Try asking me:</h3>
                <div className="prompts-grid">
                  {suggestedPrompts.map((prompt, idx) => (
                    <motion.button
                      key={idx}
                      className="prompt-card"
                      onClick={() => handlePromptClick(prompt.text)}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span className="prompt-icon">{prompt.icon}</span>
                      <span className="prompt-text">{prompt.text}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                className={`message ${msg.role}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className={`message-wrapper`}>
                  <div className={`message-content ${msg.role === 'assistant' ? 'markdown-content' : ''} ${getMoodColor(msg.mood)}`}>
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown>
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      msg.content
                    )}
                  </div>
                  <div className="message-meta">
                    {msg.timestamp && (
                      <span className="message-timestamp">{formatTimestamp(msg.timestamp)}</span>
                    )}
                    {msg.role === 'assistant' && (
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(msg.content, idx)}
                        title="Copy message"
                      >
                        {copiedMessageId === idx ? (
                          <Check size={14} />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                {msg.mood && msg.role === 'assistant' && (
                  <div className="mood-indicator" data-mood={msg.mood}>
                    {msg.mood}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div
              className="message assistant"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="message-content typing-indicator">
                <div className="typing-dots">
                  <span></span><span></span><span></span>
                </div>
                <span className="typing-text">D.R.O.S.S is thinking...</span>
              </div>
            </motion.div>
          )}
        </div>

        <div className="input-container">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInput}
            onKeyPress={handleKeyPress}
            placeholder="Message D.R.O.S.S..."
            disabled={loading}
          />
          <button 
            onClick={sendMessage} 
            disabled={loading || !input.trim()}
            className="send-button"
          >
            <Send size={20} />
          </button>
        </div>
      </main>

      {/* Edit Session Modal */}
      <AnimatePresence>
        {editingSession && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditingSession(null)}
          >
            <motion.div
              className="modal"
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
            >
              <div className="modal-header">
                <Edit3 size={20} />
                <h3>Rename Chat</h3>
              </div>
              <input
                value={newSessionTitle}
                onChange={(e) => setNewSessionTitle(e.target.value)}
                placeholder="Enter new title"
                autoFocus
                className="modal-input"
              />
              <div className="modal-actions">
                <button 
                  onClick={() => setEditingSession(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => updateSessionTitle(editingSession)}
                  className="btn-primary"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
