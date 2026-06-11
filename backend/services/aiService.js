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

const { listFaqsSync } = require('./faqService');
const assessmentService = require('./assessmentService');
const motivationQuotes = require('../data/motivationQuotes');

// ── OpenAI client (lazy init) ──────────────────────────
let openaiClient = null;
const AI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-3.5-turbo';
const AI_COPILOT_MODEL = process.env.OPENAI_COPILOT_MODEL || 'gpt-4o-mini';
let todaysThoughtCache = {
  dateKey: null,
  value: null,
};

const getCalendarDateKey = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: process.env.APP_TIMEZONE || process.env.TZ || 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const getDailyQuoteFromBank = (dateKey) => {
  const numericSeed = Number(String(dateKey).replace(/-/g, '')) || Date.now();
  const quote = motivationQuotes[numericSeed % motivationQuotes.length] || motivationQuotes[0];
  return {
    quote: quote.quote,
    author: '',
    theme: '',
  };
};

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
  const faqData = listFaqsSync();
  const faqContext = faqData
    .map((f, i) => `Q${i + 1}: ${f.question}\nA${i + 1}: ${f.answer}`)
    .join('\n\n');

  return `You are a helpful support assistant for SmartSharda.
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
      model:       AI_CHAT_MODEL, // Fast and cheap — good for FAQ bot
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
      model: AI_CHAT_MODEL,
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
      model: AI_CHAT_MODEL,
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

// ── Generate ticket summary for support staff ─────────
const summarizeTicket = async (ticket) => {
  const openai = getOpenAI();
  if (!openai) return null;

  try {
    const repliesText = ticket.replies
      .slice(-5)
      .map(r => `${r.authorRole}: ${r.message}`)
      .join('\n');

    const response = await openai.chat.completions.create({
      model: AI_CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Summarize this support ticket conversation in 2-3 sentences for a support staff member. Include the core issue and current status.',
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

const getRelevantFaqEntries = (title = '', description = '') => {
  const faqData = listFaqsSync();
  const text = `${title} ${description}`.toLowerCase();
  const words = text.split(/\s+/).filter((word) => word.length > 3);

  return faqData
    .map((faq) => {
      const score = words.reduce((count, word) => (
        faq.question.toLowerCase().includes(word) || faq.answer.toLowerCase().includes(word)
          ? count + 1
          : count
      ), 0);
      return { ...faq, score };
    })
    .filter((faq) => faq.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ question, answer }) => ({ question, answer }));
};

const fallbackPreTicketSuggestion = async (title, description) => {
  const [suggestedCategory, suggestedPriority] = await Promise.all([
    categorizeTicket(title, description),
    predictPriority(title, description),
  ]);

  const faqMatches = getRelevantFaqEntries(title, description);
  const suggestions = faqMatches.map((item) => item.answer).slice(0, 3);
  const shouldCreateTicket = !faqMatches.length || suggestedPriority === 'High' || suggestedPriority === 'Critical';

  return {
    suggestedCategory,
    suggestedPriority,
    shouldCreateTicket,
    faqMatches,
    suggestions,
    source: 'fallback',
  };
};

const suggestPreTicketSupport = async (title, description) => {
  const openai = getOpenAI();
  if (!openai) {
    return fallbackPreTicketSuggestion(title, description);
  }

  try {
    const faqMatches = getRelevantFaqEntries(title, description);
    const response = await openai.chat.completions.create({
      model: AI_CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant that helps decide whether a university support ticket should be raised. Return only JSON with keys: suggestedCategory, suggestedPriority, shouldCreateTicket, suggestions (array of short strings).',
        },
        {
          role: 'user',
          content: `Title: ${title}
Description: ${description}
Relevant FAQs: ${JSON.stringify(faqMatches)}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 180,
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
    return {
      suggestedCategory: parsed.suggestedCategory || await categorizeTicket(title, description),
      suggestedPriority: parsed.suggestedPriority || await predictPriority(title, description),
      shouldCreateTicket: typeof parsed.shouldCreateTicket === 'boolean' ? parsed.shouldCreateTicket : true,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [],
      faqMatches,
      source: 'openai',
    };
  } catch {
    return fallbackPreTicketSuggestion(title, description);
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
  const faqData = listFaqsSync();
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
      response:    'Hello! 👋 I\'m the SmartSharda Assistant. I can help with WiFi, fees, library, hostel, and more. What do you need help with?',
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
  const faqData = listFaqsSync();
  const msg    = message.toLowerCase();
  const all    = faqData.map(f => f.question);
  const words  = msg.split(' ').filter(w => w.length > 3);
  return all
    .filter(q => words.some(w => q.toLowerCase().includes(w)))
    .slice(0, 3);
};

const fallbackDashboardInsight = (context) => {
  const { pendingPersonalTasks, openTickets, freshNotices, overdueAssignments, dueTodayAssignments, pendingGrading, lowPerformanceAlerts } = context.counts;

  if (lowPerformanceAlerts > 0) {
    return {
      message: `${lowPerformanceAlerts} subject${lowPerformanceAlerts > 1 ? 's need' : ' needs'} attention in assessments. Focus on the weakest one first to protect eligibility.`,
      source: 'fallback',
    };
  }

  if (pendingGrading > 0) {
    return {
      message: `You still have ${pendingGrading} assessment item${pendingGrading > 1 ? 's' : ''} waiting to be graded. Clearing them will improve student visibility fast.`,
      source: 'fallback',
    };
  }

  if (overdueAssignments > 0) {
    return {
      message: `You have ${overdueAssignments} overdue assignment${overdueAssignments > 1 ? 's' : ''}. Clear the oldest one first to stop work from piling up.`,
      source: 'fallback',
    };
  }

  if (dueTodayAssignments > 0) {
    return {
      message: `${dueTodayAssignments} assignment${dueTodayAssignments > 1 ? 's are' : ' is'} due today. Finishing them early will make the rest of the day easier.`,
      source: 'fallback',
    };
  }

  if (pendingPersonalTasks > 0) {
    return {
      message: `You have ${pendingPersonalTasks} personal task${pendingPersonalTasks > 1 ? 's' : ''} still open. Completing one quick task now will build momentum.`,
      source: 'fallback',
    };
  }

  if (openTickets > 0) {
    return {
      message: `${openTickets} support ticket${openTickets > 1 ? 's are' : ' is'} still active. A short follow-up can keep the queue moving.`,
      source: 'fallback',
    };
  }

  if (freshNotices > 0) {
    return {
      message: `There ${freshNotices > 1 ? 'are' : 'is'} ${freshNotices} fresh notice${freshNotices > 1 ? 's' : ''} waiting. Review them before you dive into the rest of the day.`,
      source: 'fallback',
    };
  }

  return {
    message: 'Everything looks under control today. Use the board to close one small task and keep your momentum steady.',
    source: 'fallback',
  };
};

const generateDashboardInsight = async (context) => {
  const openai = getOpenAI();

  if (!openai) {
    return fallbackDashboardInsight(context);
  }

  try {
    const response = await openai.chat.completions.create({
      model: AI_CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You write one short daily dashboard coaching message for a university workspace. Be practical, encouraging, and specific. Keep it under 28 words. No markdown.',
        },
        {
          role: 'user',
          content: `User role: ${context.role}
User name: ${context.userName}
Pending personal tasks: ${context.counts.pendingPersonalTasks}
Open tickets: ${context.counts.openTickets}
Fresh notices: ${context.counts.freshNotices}
Overdue assignments: ${context.counts.overdueAssignments}
Assignments due today: ${context.counts.dueTodayAssignments}
Pending assessment grading: ${context.counts.pendingGrading || 0}
Low performance alerts: ${context.counts.lowPerformanceAlerts || 0}
Assessment percentage: ${context.counts.assessmentRate || 0}`,
        },
      ],
      max_tokens: 60,
      temperature: 0.7,
    });

    const message = response.choices[0]?.message?.content?.trim();
    if (!message) return fallbackDashboardInsight(context);

    return { message, source: 'openai' };
  } catch {
    return fallbackDashboardInsight(context);
  }
};

const safeString = (value, fallback = 'N/A') => {
  const text = String(value || '').trim();
  return text || fallback;
};

// Late-binding getter to avoid circular dependency (dashboardService → aiService → dashboardService)
let _dashboardService = null;
const getDashboardService = () => {
  if (!_dashboardService) _dashboardService = require('./dashboardService');
  return _dashboardService;
};

const buildErpCopilotContext = async (user) => {
  try {
    const dashboardService = getDashboardService();
    const [dashboard, assessmentSummary] = await Promise.all([
      dashboardService.getDashboardWorkspace(user),
      assessmentService.getAssessmentDashboardSummary(user).catch(() => ({})),
    ]);

    const topSubjects = Array.isArray(assessmentSummary?.recentAssessments) ? assessmentSummary.recentAssessments.slice(0, 5) : [];
    const weakSubjects = Array.isArray(assessmentSummary?.weakSubjects) ? assessmentSummary.weakSubjects.slice(0, 5) : [];

    return {
      role: user.role,
      name: user.name,
      stats: dashboard.stats || {},
      attendance: dashboard.attendance || {},
      assessment: assessmentSummary || {},
      assignments: (dashboard.assignments || []).slice(0, 5),
      timetable: (dashboard.timetable || []).slice(0, 5),
      notices: (dashboard.notices || []).slice(0, 3),
      topSubjects,
      weakSubjects,
      visibleScope: {
        department: safeString(user.department),
        section: safeString(user.section),
        year: safeString(user.year),
      },
    };
  } catch (error) {
    return {
      role: user.role,
      name: user.name,
      stats: {},
      attendance: {},
      assessment: {},
      assignments: [],
      timetable: [],
      notices: [],
      topSubjects: [],
      weakSubjects: [],
      visibleScope: {
        department: safeString(user.department),
        section: safeString(user.section),
        year: safeString(user.year),
      },
      error: error.message,
    };
  }
};

const answerErpCopilotQuestion = async (user, question) => {
  const context = await buildErpCopilotContext(user);
  const openai = getOpenAI();
  const normalizedQuestion = String(question || '').trim();

  const conciseContext = `
User role: ${context.role}
User name: ${context.name}
Department: ${context.visibleScope.department}
Section: ${context.visibleScope.section}
Year: ${context.visibleScope.year}
Attendance rate: ${context.attendance.attendanceRate || 0}%
Assessment percentage: ${context.assessment.percentage || 0}%
Eligible: ${context.assessment.eligibility?.isEligible ? 'yes' : 'no'}
Weak subjects: ${(context.weakSubjects || []).map((item) => `${item.code}:${Math.round(item.percentage || 0)}%`).join(', ') || 'none'}
Recent assessments: ${(context.topSubjects || []).map((item) => `${item.type || 'assessment'}:${item.subject || item.code || 'subject'}:${Math.round(item.percentage || 0)}%`).join('; ') || 'none'}
Assignments: ${(context.assignments || []).map((item) => `${item.title || 'Assignment'}:${item.status || 'open'}`).join('; ') || 'none'}
Timetable: ${(context.timetable || []).map((item) => `${item.dayOfWeek || 'Day'} ${item.startTime || ''}-${item.endTime || ''} ${item.subjectId?.code || item.subject || ''}`).join('; ') || 'none'}
Notices: ${(context.notices || []).map((item) => item.title || '').join('; ') || 'none'}
`;

  if (!openai) {
    const questionText = normalizedQuestion.toLowerCase();
    if (questionText.includes('attendance')) {
      return {
        answer: `Your attendance is ${context.attendance.attendanceRate || 0}%. ${context.assessment.eligibility?.isEligible ? 'You are currently eligible.' : 'You should improve attendance to stay eligible.'}`,
        source: 'fallback',
        context,
      };
    }
    if (questionText.includes('marks') || questionText.includes('performance') || questionText.includes('weak')) {
      return {
        answer: `Your overall assessment performance is ${context.assessment.percentage || 0}%. Weak subjects: ${(context.weakSubjects || []).map((item) => item.code).join(', ') || 'none'}.`,
        source: 'fallback',
        context,
      };
    }
    if (questionText.includes('timetable')) {
      return {
        answer: `Your current timetable has ${(context.timetable || []).length} visible slots in the workspace.`,
        source: 'fallback',
        context,
      };
    }
    return {
      answer: `I can see ${context.attendance.attendanceRate || 0}% attendance, ${context.assessment.percentage || 0}% performance, and ${context.assessment.eligibility?.isEligible ? 'eligibility looks good' : 'eligibility needs attention'}. Ask about a subject, section, timetable, or marks trend for more detail.`,
      source: 'fallback',
      context,
    };
  }

  const response = await openai.chat.completions.create({
    model: AI_COPILOT_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are SmartSharda ERP Copilot. Answer only using the ERP context below and the user's permissions. If the user asks for data outside their visible scope, politely refuse. Be concise, specific, and helpful. Return plain text only.`,
      },
      {
        role: 'user',
        content: `Question: ${normalizedQuestion}

ERP Context:${conciseContext}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 260,
  });

  const answer = response.choices[0]?.message?.content?.trim();
  return {
    answer: answer || 'I could not generate a response from ERP data.',
    source: 'openai',
    context,
    usage: response.usage ? {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    } : null,
  };
};

const generateTodaysThought = async () => {
  const dateKey = getCalendarDateKey();
  if (todaysThoughtCache.dateKey === dateKey && todaysThoughtCache.value) {
    return todaysThoughtCache.value;
  }
  const result = getDailyQuoteFromBank(dateKey);
  todaysThoughtCache = { dateKey, value: result };
  return result;
};

module.exports = {
  chatWithAI,
  categorizeTicket,
  predictPriority,
  summarizeTicket,
  suggestPreTicketSupport,
  generateDashboardInsight,
  generateTodaysThought,
  answerErpCopilotQuestion,
};
