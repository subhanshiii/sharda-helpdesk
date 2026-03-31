/**
 * AI Service — OpenAI Integration
 *
 * This service handles all AI operations:
 * 1. Conversational FAQ bot (replaces keyword matcher)
 * 2. Auto ticket categorization
 * 3. Priority prediction
 * 4. Ticket summary generation
 *
 * Architecture: Falls back gracefully if OpenAI is unavailable
 * so the app never breaks when AI is down.
 */

const faqData = require('../data/faq.json');

// ── OpenAI client (lazy init) ──────────────────────────
let openaiClient = null;

const getOpenAI = () => {
  if (openaiClient) return openaiClient;
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const { OpenAI } = require('openai');
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return openaiClient;
  } catch {
    console.warn('⚠️  OpenAI package not installed — running in fallback mode');
    return null;
  }
};

// ── System prompt for FAQ chatbot ─────────────────────
const buildSystemPrompt = () => {
  const faqContext = faqData
    .map((f, i) => `Q${i + 1}: ${f.question}\nA${i + 1}: ${f.answer}`)
    .join('\n\n');

  return `You are a helpful support assistant for Sharda University Helpdesk.
Your job is to answer student queries about university services.

Here is the knowledge base you should use to answer questions:
--- FAQ START ---
${faqContext}
--- FAQ END ---

RULES:
- Answer ONLY based on the FAQ above for factual questions
- Be friendly, concise, and helpful
- If the question is not in the FAQ, say you're not sure and suggest raising a support ticket
- Never make up information
- Keep responses under 150 words
- If a student seems frustrated, acknowledge it empathetically
- Always end with asking if they need more help or want to raise a ticket
- Format: plain text only, no markdown`;
};

// ── Core chat function ─────────────────────────────────
const chatWithAI = async (message, conversationHistory = []) => {
  const openai = getOpenAI();

  // Fallback to keyword matching if OpenAI unavailable
  if (!openai) {
    return fallbackChat(message);
  }

  try {
    const messages = [
      { role: 'system', content: buildSystemPrompt() },
      ...conversationHistory.slice(-6), // Keep last 6 messages for context window efficiency
      { role: 'user', content: message },
    ];

    const response = await openai.chat.completions.create({
      model:       'gpt-3.5-turbo', // Fast and cheap — good for FAQ bot
      messages,
      max_tokens:  200,              // Keep responses concise
      temperature: 0.3,             // Low temp = more factual, less creative
      stream:      false,
    });

    const reply    = response.choices[0].message.content;
    const usage    = response.usage;

    // Detect if a ticket is needed based on AI response
    const needsTicket = reply.toLowerCase().includes('raise a ticket') ||
                        reply.toLowerCase().includes('support ticket') ||
                        reply.toLowerCase().includes('not sure');

    return {
      success:     true,
      response:    reply,
      source:      'openai',
      needsTicket,
      usage: {
        promptTokens:     usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens:      usage.total_tokens,
      },
      suggestions: needsTicket ? [] : getRelatedQuestions(message),
      action:      needsTicket ? { label: 'Raise a Ticket', link: '/tickets/new' } : null,
    };
  } catch (err) {
    console.error('OpenAI API error:', err.message);

    // Graceful fallback — don't expose API errors to users
    if (err.code === 'insufficient_quota') {
      return {
        success:     true,
        response:    'I\'m experiencing high demand right now. Let me use my basic knowledge instead.',
        source:      'fallback',
        ...fallbackChat(message),
      };
    }

    return fallbackChat(message);
  }
};

// ── Auto-categorize ticket ─────────────────────────────
const categorizeTicket = async (title, description) => {
  const openai = getOpenAI();
  const categories = ['IT Support', 'Administration', 'Hostel', 'Library', 'Finance', 'Academic', 'Infrastructure', 'Other'];

  if (!openai) {
    return keywordCategorize(title, description);
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a ticket categorization system for Sharda University.
Classify the ticket into EXACTLY ONE of these categories: ${categories.join(', ')}.
Respond with ONLY the category name, nothing else.`,
        },
        {
          role: 'user',
          content: `Title: ${title}\nDescription: ${description}`,
        },
      ],
      max_tokens:  20,
      temperature: 0,
    });

    const suggested = response.choices[0].message.content.trim();
    return categories.includes(suggested) ? suggested : keywordCategorize(title, description);
  } catch {
    return keywordCategorize(title, description);
  }
};

// ── Auto-predict priority ──────────────────────────────
const predictPriority = async (title, description) => {
  const openai = getOpenAI();
  const priorities = ['Low', 'Medium', 'High', 'Critical'];

  if (!openai) {
    return keywordPriority(title, description);
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a ticket priority classifier for a university helpdesk.
Classify based on urgency and impact:
- Critical: System down, exam-related, payment failures, emergencies
- High: Cannot access important resources, blocking academic work
- Medium: Inconvenient but has workarounds
- Low: General questions, suggestions, non-urgent requests
Respond with ONLY one word: ${priorities.join(', ')}.`,
        },
        {
          role: 'user',
          content: `Title: ${title}\nDescription: ${description}`,
        },
      ],
      max_tokens:  10,
      temperature: 0,
    });

    const suggested = response.choices[0].message.content.trim();
    return priorities.includes(suggested) ? suggested : keywordPriority(title, description);
  } catch {
    return keywordPriority(title, description);
  }
};

// ── Generate ticket summary for agents ────────────────
const summarizeTicket = async (ticket) => {
  const openai = getOpenAI();
  if (!openai) return null;

  try {
    const repliesText = ticket.replies
      .slice(-5)
      .map(r => `${r.authorRole}: ${r.message}`)
      .join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Summarize this support ticket conversation in 2-3 sentences for an agent. Include the core issue and current status.',
        },
        {
          role: 'user',
          content: `Ticket: ${ticket.title}\nDescription: ${ticket.description}\nReplies:\n${repliesText}`,
        },
      ],
      max_tokens:  100,
      temperature: 0.3,
    });

    return response.choices[0].message.content;
  } catch {
    return null;
  }
};

// ── Keyword-based fallback categorizer ────────────────
const keywordCategorize = (title, description) => {
  const text = `${title} ${description}`.toLowerCase();
  if (text.match(/wifi|internet|laptop|computer|software|portal|password|login|network/)) return 'IT Support';
  if (text.match(/fee|payment|scholarship|finance|money|challan|receipt/))               return 'Finance';
  if (text.match(/hostel|room|warden|mess|food|laundry|maintenance/))                    return 'Hostel';
  if (text.match(/library|book|journal|reading|borrow|renew/))                           return 'Library';
  if (text.match(/exam|grade|marks|result|attendance|faculty|course|semester/))          return 'Academic';
  if (text.match(/certificate|bonafide|admission|document|id card/))                     return 'Administration';
  if (text.match(/building|classroom|lab|infrastructure|electricity|water/))             return 'Infrastructure';
  return 'Other';
};

// ── Keyword-based fallback priority ───────────────────
const keywordPriority = (title, description) => {
  const text = `${title} ${description}`.toLowerCase();
  if (text.match(/urgent|emergency|critical|exam|payment|cannot access|broken/)) return 'High';
  if (text.match(/suggestion|feedback|question|info|general/))                   return 'Low';
  return 'Medium';
};

// ── Keyword-based fallback chat ───────────────────────
const fallbackChat = (message) => {
  const msg = message.toLowerCase();
  const SUGGESTIONS = [
    'How do I reset my password?',
    'How do I connect to WiFi?',
    'How do I pay fees online?',
    'How do I get a bonafide certificate?',
  ];

  // Greetings
  if (msg.match(/^(hi|hello|hey|hii|namaste)/)) {
    return {
      success:     true,
      response:    'Hello! 👋 I\'m the Sharda University Helpdesk Assistant. I can help with WiFi, fees, library, hostel, and more. What do you need help with?',
      suggestions: SUGGESTIONS.slice(0, 3),
      source:      'fallback',
      needsTicket: false,
    };
  }

  // FAQ matching
  let bestMatch = null;
  let bestScore = 0;
  const words = msg.split(' ').filter(w => w.length > 3);

  for (const faq of faqData) {
    const score = words.filter(w => faq.question.toLowerCase().includes(w)).length;
    if (score > bestScore) { bestScore = score; bestMatch = faq; }
  }

  if (bestMatch && bestScore >= 1) {
    return {
      success:      true,
      response:     bestMatch.answer,
      source:       'fallback',
      needsTicket:  false,
      suggestions:  getRelatedQuestions(message).slice(0, 2),
    };
  }

  return {
    success:     true,
    response:    'I\'m not sure about that specific question. I\'d recommend raising a support ticket so our team can help you directly.',
    source:      'fallback',
    needsTicket: true,
    suggestions: SUGGESTIONS.slice(0, 3),
    action:      { label: 'Raise a Ticket', link: '/tickets/new' },
  };
};

// ── Get related questions ──────────────────────────────
const getRelatedQuestions = (message) => {
  const msg    = message.toLowerCase();
  const all    = faqData.map(f => f.question);
  const words  = msg.split(' ').filter(w => w.length > 3);
  return all
    .filter(q => words.some(w => q.toLowerCase().includes(w)))
    .slice(0, 3);
};

module.exports = { chatWithAI, categorizeTicket, predictPriority, summarizeTicket };
