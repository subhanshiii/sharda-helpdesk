const faqData = require('../data/faq.json');

// Simple keyword-based FAQ matcher (no OpenAI needed)
const findFAQMatch = (query) => {
  const q = query.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;

  for (const faq of faqData) {
    const questionWords = faq.question.toLowerCase().split(' ');
    const score = questionWords.filter(word => word.length > 3 && q.includes(word)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = faq;
    }
  }
  return bestScore >= 1 ? bestMatch : null;
};

const SUGGESTIONS = [
  'How do I reset my password?',
  'How do I connect to WiFi?',
  'How do I pay fees online?',
  'How do I get a bonafide certificate?',
  'How do I renew library books?',
  'How long does it take to resolve a ticket?',
];

// @desc    Chat with AI assistant
// @route   POST /api/chat
// @access  Private
exports.chat = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const msg = message.trim().toLowerCase();

    // Greeting
    if (['hi','hello','hey','hii','namaste'].some(g => msg.includes(g))) {
      return res.json({
        success: true,
        response: `Hello! 👋 I'm the Sharda University Helpdesk Assistant. I can help you with common questions about WiFi, fees, library, hostel, and more. What do you need help with?`,
        suggestions: SUGGESTIONS.slice(0, 3),
        type: 'greeting',
      });
    }

    // Thanks
    if (['thank','thanks','thankyou'].some(g => msg.includes(g))) {
      return res.json({
        success: true,
        response: `You're welcome! 😊 If you need more help, feel free to ask or raise a support ticket.`,
        suggestions: [],
        type: 'thanks',
      });
    }

    // Ticket creation intent
    if (['raise','create','open','submit','new ticket'].some(g => msg.includes(g))) {
      return res.json({
        success: true,
        response: `To raise a support ticket, click on **"New Ticket"** in the sidebar, fill in the details, and our team will get back to you shortly. You can track your ticket status in the **Tickets** section.`,
        suggestions: [],
        type: 'ticket',
        action: { label: 'Create Ticket', link: '/tickets/new' },
      });
    }

    // FAQ match
    const match = findFAQMatch(message);
    if (match) {
      return res.json({
        success: true,
        response: match.answer,
        matchedQuestion: match.question,
        suggestions: SUGGESTIONS.filter(s => s !== match.question).slice(0, 2),
        type: 'faq',
      });
    }

    // Fallback
    return res.json({
      success: true,
      response: `I'm not sure about that specific question. Here are some things I can help with, or you can **raise a support ticket** and our team will assist you directly.`,
      suggestions: SUGGESTIONS.slice(0, 4),
      type: 'fallback',
      action: { label: 'Raise a Ticket', link: '/tickets/new' },
    });
  } catch (error) { next(error); }
};

// @desc    Get FAQ list
// @route   GET /api/chat/faqs
// @access  Private
exports.getFAQs = async (req, res, next) => {
  try {
    res.json({ success: true, data: faqData });
  } catch (error) { next(error); }
};

// @desc    Get suggestions
// @route   GET /api/chat/suggestions
// @access  Private
exports.getSuggestions = async (req, res) => {
  res.json({ success: true, data: SUGGESTIONS });
};
