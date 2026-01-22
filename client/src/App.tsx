import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { Send, Brain, Heart, Code, Search } from 'lucide-react';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentMode, setCurrentMode] = useState('friend');
  const [sessionId] = useState(() => {
    // Get or create session ID
    let id = localStorage.getItem('dross-session-id');
    if (!id) {
      id = 'session-' + Date.now();
      localStorage.setItem('dross-session-id', id);
    }
    return id;
  });

  // Load conversation history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/history/${sessionId}`);
        if (response.data.length > 0) {
          setMessages(response.data);
        } else {
          // First time - show welcome message
          setMessages([{
            role: 'assistant',
            content: 'Hey! D.R.O.S.S here. How are you feeling today?',
            mood: 'neutral'
          }]);
        }
      } catch (error) {
        console.error('Error loading history:', error);
        setMessages([{
          role: 'assistant',
          content: 'Hey! D.R.O.S.S here. How are you feeling today?',
          mood: 'neutral'
        }]);
      }
    };
    loadHistory();
  }, [sessionId]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:5000/api/chat', {
        message: input,
        sessionId,
        mode: currentMode
      });

      const assistantMessage = {
        role: 'assistant',
        content: response.data.response,
        mood: response.data.mood,
        mode: response.data.mode
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
        mood: 'neutral'
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, currentMode, sessionId]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getModeIcon = (mode) => {
    switch(mode) {
      case 'code': return <Code size={16} />;
      case 'research': return <Search size={16} />;
      default: return <Heart size={16} />;
    }
  };

  return (
    <div className="app">
      <header className="header">
        <Brain size={32} className="logo" />
        <h1>D.R.O.S.S</h1>
        <div className="mode-indicator">
          {getModeIcon(currentMode)}
          <span>{currentMode}</span>
        </div>
      </header>

      <div className="chat-container">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div className="message-content">
              {msg.content}
            </div>
            {msg.mood && msg.role === 'assistant' && (
              <div className="mood-indicator" data-mood={msg.mood}>
                {msg.mood}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="message assistant">
            <div className="message-content loading">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
      </div>

      <div className="input-container">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Talk to D.R.O.S.S..."
          rows="1"
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}>
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}

export default App;
