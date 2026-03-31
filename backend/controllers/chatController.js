/**
 * Chat Controller
 * Uses real AI (OpenAI) with fallback to keyword matching
 */
const { chatWithAI, categorizeTicket, predictPriority, summarizeTicket } = require('../services/aiService');
const { withCache, TTL, KEYS } = require('../config/cache');
const faqData = require('../data/faq.json');

// @desc    Chat with AI assistant
// @route   POST /api/chat
// @access  Private
exports.chat = async (req, res, next) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    // Rate limit AI calls per user (in addition to global rate limit)
    // Each user gets 30 AI messages per hour — stored in cache
    const rateLimitKey = `ai_rate:${req.user.id}`;
    const { withCache: cacheHelper, get, set } = require('../config/cache');
    const { getRedisClient } = require('../config/redis');

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

// @desc    Summarize a ticket for agents
// @route   GET /api/chat/summarize/:ticketId
// @access  Private (admin/agent)
exports.summarize = async (req, res, next) => {
  try {
    const Ticket = require('../models/Ticket');
    const ticket = await Ticket.findById(req.params.ticketId)
      .populate('replies.author', 'name role');

    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

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
    const { data, fromCache } = await withCache(KEYS.faq(), TTL.FAQ, async () => faqData);
    res.json({ success: true, data, fromCache: process.env.NODE_ENV === 'development' ? fromCache : undefined });
  } catch (error) { next(error); }
};

// @desc    Get suggested questions
// @route   GET /api/chat/suggestions
// @access  Private
exports.getSuggestions = async (req, res) => {
  const suggestions = faqData.slice(0, 6).map(f => f.question);
  res.json({ success: true, data: suggestions });
};
