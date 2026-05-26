import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import API from '../utils/api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getInitials } from '../utils/helpers';
import {
  FiArrowUpRight,
  FiMessageSquare,
  FiRefreshCw,
  FiSend,
  FiZap,
} from 'react-icons/fi';

const SUGGESTED_QUESTIONS = [
  'How do I reset my password?',
  'How do I connect to WiFi?',
  'How do I pay fees online?',
  'How do I get a bonafide certificate?',
];

const TypingIndicator = memo(() => (
  <div className="flex items-end gap-3">
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-sm text-white shadow-sm">
      🤖
    </div>
    <div className="theme-surface rounded-2xl rounded-bl-sm border border-[color:var(--border-soft)] px-4 py-3 shadow-sm">
      <div className="flex h-4 items-center gap-1">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-2 w-2 rounded-full bg-blue-400"
            style={{ animation: `bounce 1s ease-in-out ${item * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  </div>
));

const MessageCard = memo(({ msg, user, onSuggestionClick }) => {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex items-end gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl text-xs font-bold text-white shadow-sm ${
          isUser ? 'bg-gradient-to-br from-blue-600 to-blue-800' : 'bg-gradient-to-br from-blue-500 to-cyan-500'
        }`}
      >
        {isUser ? getInitials(user?.name) : '🤖'}
      </div>

      <div className={`flex max-w-[82%] flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'rounded-br-sm text-white shadow-sm'
              : 'theme-surface rounded-bl-sm border border-[color:var(--border-soft)] theme-text-main shadow-sm'
          }`}
          style={isUser ? { background: 'linear-gradient(135deg, #1e40af, #2563eb)' } : undefined}
        >
          <p className="whitespace-pre-wrap">{msg.content}</p>

          {msg.source ? (
            <div className="mt-2">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                msg.source === 'openai' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {msg.source === 'openai' ? 'GPT assistant' : 'Smart FAQ'}
              </span>
            </div>
          ) : null}

          {msg.usage && process.env.NODE_ENV === 'development' ? (
            <div className="mt-2 text-[11px] opacity-60">
              Tokens: {msg.usage.totalTokens}
            </div>
          ) : null}

          {msg.action ? (
            <Link
              to={msg.action.link}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              {msg.action.label}
              <FiArrowUpRight size={12} />
            </Link>
          ) : null}
        </div>

        {msg.suggestions?.length ? (
          <div className="mt-1 flex flex-wrap gap-2">
            {msg.suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion}-${index}`}
                type="button"
                onClick={() => onSuggestionClick(suggestion)}
                className="theme-surface-soft theme-text-main rounded-2xl border border-[color:var(--border-soft)] px-3 py-2 text-left text-xs font-medium transition hover:-translate-y-0.5 hover:shadow-sm"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        <span className="theme-text-muted text-[11px]">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
});

export default function AIAssistant() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hi ${user?.name?.split(' ')[0] || 'there'}! I can help with university FAQs like WiFi, fees, certificates, library access, hostel support, and exams. Ask a question or use one of the quick prompts below.`,
      suggestions: SUGGESTED_QUESTIONS,
      timestamp: new Date(),
      source: null,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [inputRows, setInputRows] = useState(1);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
    setInputRows(input.includes('\n') ? 2 : 1);
  }, [input]);

  const sendMessage = useCallback(async (nextText) => {
    const messageText = (nextText ?? input).trim();
    if (!messageText || loading) return;

    const userMsg = { role: 'user', content: messageText, timestamp: new Date() };
    const history = messages.slice(-6).map((message) => ({ role: message.role, content: message.content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await API.post('/chat', {
        message: messageText,
        conversationHistory: history,
      });

      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: res.data.response,
        suggestions: res.data.suggestions || [],
        action: res.data.action || null,
        source: res.data.source,
        usage: res.data.usage,
        timestamp: new Date(),
      }]);
    } catch (error) {
      const isRateLimited = error.response?.status === 429;
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: isRateLimited
          ? 'You have reached the AI chat limit for this hour. Raise a support ticket and the team will help directly.'
          : 'I am having trouble responding right now. Please try again in a moment or raise a support ticket.',
        action: { label: 'Raise a Ticket', link: '/tickets/new' },
        timestamp: new Date(),
      }]);
      if (!isRateLimited) {
        toast.error('AI Assistant is temporarily unavailable');
      }
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }, [input, loading, messages]);

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'Chat cleared. Ask a new question whenever you are ready.',
        suggestions: SUGGESTED_QUESTIONS.slice(0, 3),
        timestamp: new Date(),
      },
    ]);
    setInput('');
    textareaRef.current?.focus();
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-5xl flex-col gap-4">
      <div className="theme-surface overflow-hidden rounded-[30px] border border-[color:var(--border-soft)] shadow-[var(--shadow-card)]">
        <div className="theme-surface-soft flex flex-col gap-4 border-b border-[color:var(--border-soft)] px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-br from-blue-500 to-cyan-500 text-2xl text-white shadow-md">
              🤖
            </div>
            <div className="min-w-0">
              <p className="theme-accent-badge inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]">
                AI Assistant
              </p>
              <h2 className="theme-text-strong mt-3 font-display text-2xl font-bold">Ask faster, resolve sooner</h2>
              <p className="theme-text-muted mt-1 text-sm leading-6">
                Get instant answers from the FAQ knowledge base and jump into ticket creation only when you need human help.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700">
              <FiZap size={13} />
              {process.env.REACT_APP_OPENAI_ENABLED === 'true' ? 'GPT enabled' : 'FAQ mode'}
            </div>
            <button type="button" onClick={clearChat} className="btn-secondary text-xs">
              <FiRefreshCw size={13} />
              Clear
            </button>
            <Link to="/faq" className="btn-secondary text-xs">
              <FiZap size={13} />
              FAQ
            </Link>
            <Link to="/tickets/new" className="btn-primary text-xs">
              <FiMessageSquare size={13} />
              Raise Ticket
            </Link>
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-h-0 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_42%)] px-5 py-5">
              {messages.map((msg, index) => (
                <MessageCard key={`${msg.role}-${index}-${msg.timestamp}`} msg={msg} user={user} onSuggestionClick={sendMessage} />
              ))}
              {loading ? <TypingIndicator /> : null}
              <div ref={bottomRef} />
            </div>

            <div className="theme-surface-soft border-t border-[color:var(--border-soft)] px-4 py-4">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                    rows={inputRows}
                    disabled={loading}
                    placeholder="Ask anything about Sharda University..."
                    className="theme-input min-h-[48px] max-h-40 w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none transition"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  className="btn-primary h-12 w-12 justify-center rounded-2xl p-0 disabled:opacity-40"
                  aria-label="Send message"
                >
                  <FiSend size={17} />
                </button>
              </div>

              <p className="theme-text-muted mt-2 text-center text-xs">
                Enter to send, Shift+Enter for a new line, up to 30 AI requests per hour.
              </p>
            </div>
          </div>

          <aside className="theme-surface-soft border-t border-[color:var(--border-soft)] px-5 py-5 xl:border-l xl:border-t-0">
            <p className="theme-accent-badge inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]">
              Quick prompts
            </p>
            <h3 className="theme-text-strong mt-3 font-display text-lg font-bold">Start with a common question</h3>
            <p className="theme-text-muted mt-1 text-sm leading-6">
              These shortcuts reduce typing and help the assistant answer faster with better context.
            </p>

            <div className="mt-5 space-y-2.5">
              {SUGGESTED_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => sendMessage(question)}
                  disabled={loading}
                  className="theme-surface w-full rounded-2xl border border-[color:var(--border-soft)] px-4 py-3 text-left text-sm font-medium theme-text-main transition hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>

            <div className="theme-surface mt-5 rounded-[24px] border border-[color:var(--border-soft)] p-4">
              <p className="theme-text-strong text-sm font-semibold">Best for</p>
              <p className="theme-text-muted mt-2 text-sm leading-6">
                Passwords, WiFi, fee payment steps, bonafide certificates, exam schedules, library timings, and other repeat helpdesk questions.
              </p>
            </div>
          </aside>
        </div>
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
