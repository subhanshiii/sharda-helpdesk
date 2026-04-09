const { generateTodaysThought } = require('../services/aiService');

exports.getTodaysThought = async (req, res, next) => {
  try {
    const data = await generateTodaysThought();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
