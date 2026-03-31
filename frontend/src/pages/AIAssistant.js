import React, { useState, useEffect, useRef, useCallback } from 'react';
import API from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { getInitials } from '../utils/helpers';
import { FiSend, FiMessageSquare, FiZap, FiRefreshCw } from 'react-icons/fi';

const TypingIndicator = () => (
  <div className="flex gap-3 items-end">
    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-sm flex-shrink-0">🤖</div>
    <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
      <div className="flex gap-1 items-center h-4">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-blue-400"
            style={{ animation:`bounce 1s ease-in-out ${i*0.2}s infinite` }} />
        ))}
      </div>
    </div>
  </div>
);

const Message = ({ msg, user, onSuggestionClick }) => {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 items-end ${isUser ? 'flex-row-reverse' : ''} animate-fade-in-up`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
        isUser ? 'bg-gradient-to-br from-blue-600 to-blue-800' : 'bg-gradient-to-br from-blue-500 to-cyan-500'
      }`}>
        {isUser ? getInitials(user?.name) : '🤖'}
      </div>
      <div className={`max-w-[78%] flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'text-white rounded-tr-sm'
            : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'
        }`} style={isUser ? { background:'linear-gradient(135deg,#1e40af,#2563eb)' } : {}}>
          {msg.content}

          {/* Source badge */}
          {msg.source && (
            <div className="mt-1.5">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                msg.source === 'openai' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
              }`}>
                {msg.source === 'openai' ? '✨ GPT-3.5' : '🔍 Smart FAQ'}
              </span>
            </div>
          )}

          {/* Token usage (dev only) */}
          {msg.usage && process.env.NODE_ENV === 'development' && (
            <div className="mt-1 text-xs opacity-50">
              Tokens: {msg.usage.totalTokens}
            </div>
          )}

          {/* Action button */}
          {msg.action && (
            <Link to={msg.action.link}
              className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors">
              {msg.action.label} →
            </Link>
          )}
        </div>

        {/* Suggested questions */}
        {msg.suggestions?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {msg.suggestions.map((s, i) => (
              <button key={i} onClick={() => onSuggestionClick(s)}
                className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors text-left">
                {s}
              </button>
            ))}
          </div>
        )}

        <span className="text-xs text-gray-400">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
        </span>
      </div>
    </div>
  );
};

export default function AIAssistant() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      role:    'assistant',
      content: `Hi ${user?.name?.split(' ')[0] || 'there'}! 👋 I'm your Sharda University AI Assistant, powered by GPT. I can answer questions about WiFi, fees, library, hostel, exams, and more. What can I help you with?`,
      suggestions: [
        'How do I reset my password?',
        'How do I connect to WiFi?',
        'How do I pay fees online?',
        'How do I get a bonafide certificate?',
      ],
      timestamp: new Date(),
      source: null,
    }
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text) => {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    const userMsg = { role: 'user', content: messageText, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Send conversation history for context-aware responses
      const history = messages
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await API.post('/chat', {
        message: messageText,
        conversationHistory: history,
      });

      setMessages(prev => [...prev, {
        role:        'assistant',
        content:     res.data.response,
        suggestions: res.data.suggestions || [],
        action:      res.data.action || null,
        source:      res.data.source,
        usage:       res.data.usage,
        timestamp:   new Date(),
      }]);
    } catch (err) {
      const isRateLimited = err.response?.status === 429;
      setMessages(prev => [...prev, {
        role:      'assistant',
        content:   isRateLimited
          ? 'You\'ve reached the AI chat limit for this hour. Please raise a support ticket for help.'
          : 'I\'m having trouble right now. Please try again or raise a support ticket.',
        action:    { label: 'Raise a Ticket', link: '/tickets/new' },
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const clearChat = () => {
    setMessages([{
      role:    'assistant',
      content: 'Chat cleared! How can I help you?',
      suggestions: ['How do I reset my password?', 'How to pay fees?'],
      timestamp: new Date(),
    }]);
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* Header */}
      <div className="card p-4 mb-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-2xl shadow-md">🤖</div>
        <div className="flex-1">
          <h2 className="font-display font-bold text-gray-900">AI Assistant</h2>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <p className="text-xs text-gray-500">
              {process.env.REACT_APP_OPENAI_ENABLED === 'true' ? 'Powered by GPT-3.5' : 'Smart FAQ Bot'}
              · Online
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={clearChat} className="btn-secondary text-xs py-1.5 px-3">
            <FiRefreshCw size={12} /> Clear
          </button>
          <Link to="/faq" className="btn-secondary text-xs py-1.5 px-3">
            <FiZap size={12} /> FAQ
          </Link>
          <Link to="/tickets/new" className="btn-primary text-xs py-1.5 px-3">
            <FiMessageSquare size={12} /> Ticket
          </Link>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto card p-5 space-y-4 mb-4">
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} user={user} onSuggestionClick={sendMessage} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="card p-3">
        <div className="flex gap-2">
          <input className="input flex-1"
            placeholder="Ask anything about Sharda University..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={loading}
          />
          <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
            className="btn-primary px-4 disabled:opacity-40">
            <FiSend size={16} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          Enter to send · Max 30 AI messages/hour ·{' '}
          <Link to="/tickets/new" className="text-blue-500 hover:underline">Raise a ticket</Link> for complex issues
        </p>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
