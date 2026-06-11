/**
 * Chat Controller
 * Uses real AI (OpenAI) with fallback to keyword matching
 */
const { chatWithAI, categorizeTicket, predictPriority, summarizeTicket, suggestPreTicketSupport, answerErpCopilotQuestion } = require('../services/aiService');
const ticketService = require('../services/ticketService');
const { withCache, TTL, KEYS } = require('../config/cache');
const { listFaqs, createFaq, updateFaq, deleteFaq } = require('../services/faqService');

// @desc    Chat with AI assistant
// @route   POST /api/chat
// @access  Private
exports.chat = async (req, res, next) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const result = await chatWithAI(message.trim(), conversationHistory);

    res.status(200).json({
      success:      true,
      response:     result.response,
      source:       result.source,
      needsTicket:  result.needsTicket,
      suggestions:  result.suggestions || [],
      action:       result.action || null,
      usage:        result.usage || null, // token usage for monitoring
    });
  } catch (error) { next(error); }
};

// @desc    Auto-categorize a ticket using AI
// @route   POST /api/chat/categorize
// @access  Private
exports.categorize = async (req, res, next) => {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description required' });
    }

    const [category, priority] = await Promise.all([
      categorizeTicket(title, description),
      predictPriority(title, description),
    ]);

    res.status(200).json({
      success: true,
      data: {
        suggestedCategory: category,
        suggestedPriority: priority,
        confidence:        process.env.OPENAI_API_KEY ? 'high' : 'medium',
        source:            process.env.OPENAI_API_KEY ? 'openai' : 'keyword-matching',
      },
    });
  } catch (error) { next(error); }
};

exports.preTicket = async (req, res, next) => {
  try {
    const { title, description } = req.body;
    if (!title?.trim() || !description?.trim()) {
      return res.status(400).json({ success: false, message: 'Title and description required' });
    }

    const data = await suggestPreTicketSupport(title.trim(), description.trim());
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Summarize a ticket for support staff
// @route   GET /api/chat/summarize/:ticketId
// @access  Private (roles with ticket-handling permission)
exports.summarize = async (req, res, next) => {
  try {
    const ticket = await ticketService.getTicketById(req.params.ticketId, req.user);

    const summary = await summarizeTicket(ticket);

    res.status(200).json({
      success: true,
      data: {
        summary: summary || `Ticket about ${ticket.category}: ${ticket.title}. Status: ${ticket.status}.`,
        generated: !!summary,
      },
    });
  } catch (error) { next(error); }
};

// @desc    Get FAQ list (CACHED)
// @route   GET /api/chat/faqs
// @access  Private
exports.getFAQs = async (req, res, next) => {
  try {
    const { data, fromCache } = await withCache(KEYS.faq(), TTL.FAQ, async () => listFaqs());
    res.json({ success: true, data, fromCache: process.env.NODE_ENV === 'development' ? fromCache : undefined });
  } catch (error) { next(error); }
};

// @desc    Get suggested questions
// @route   GET /api/chat/suggestions
// @access  Private
exports.getSuggestions = async (req, res, next) => {
  try {
    const faqs = await listFaqs();
    const suggestions = faqs.slice(0, 6).map(f => f.question);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    next(error);
  }
};

exports.createFAQ = async (req, res, next) => {
  try {
    const faq = await createFaq(req.body || {});
    res.status(201).json({ success: true, data: faq, message: 'FAQ created successfully' });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

exports.updateFAQ = async (req, res, next) => {
  try {
    const faq = await updateFaq(req.params.id, req.body || {});
    res.status(200).json({ success: true, data: faq, message: 'FAQ updated successfully' });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

exports.deleteFAQ = async (req, res, next) => {
  try {
    await deleteFaq(req.params.id);
    res.status(200).json({ success: true, message: 'FAQ deleted successfully' });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};


// @desc    Ask the ERP copilot a scoped question
// @route   POST /api/chat/copilot
// @access  Private
exports.copilot = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const result = await answerErpCopilotQuestion(req.user, message.trim());
    res.status(200).json({
      success: true,
      answer: result.answer,
      source: result.source,
      usage: result.usage || null,
    });
  } catch (error) {
    next(error);
  }
};
