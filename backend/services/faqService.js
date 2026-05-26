const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { del, KEYS } = require('../config/cache');

const FAQ_FILE_PATH = path.join(__dirname, '../data/faq.json');

const normalizeFaqEntry = (entry = {}, index = 0) => ({
  id: String(entry.id || `faq-${index + 1}-${crypto.randomUUID().slice(0, 8)}`),
  question: String(entry.question || '').trim(),
  answer: String(entry.answer || '').trim(),
});

const readFaqFile = async () => {
  const raw = await fs.promises.readFile(FAQ_FILE_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
};

const writeFaqFile = async (items) => {
  await fs.promises.writeFile(FAQ_FILE_PATH, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
  await del(KEYS.faq());
};

const listFaqsSync = () => {
  const raw = fs.readFileSync(FAQ_FILE_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  return (Array.isArray(parsed) ? parsed : [])
    .map(normalizeFaqEntry)
    .filter((entry) => entry.question && entry.answer);
};

const ensureFaqIntegrity = async () => {
  const existing = await readFaqFile();
  const normalized = existing.map(normalizeFaqEntry)
    .filter((entry) => entry.question && entry.answer);

  const changed = normalized.length !== existing.length || normalized.some((entry, index) => (
    entry.id !== existing[index]?.id
    || entry.question !== existing[index]?.question
    || entry.answer !== existing[index]?.answer
  ));

  if (changed) {
    await writeFaqFile(normalized);
  }

  return normalized;
};

const listFaqs = async () => ensureFaqIntegrity();

const createFaq = async ({ question, answer }) => {
  const nextQuestion = String(question || '').trim();
  const nextAnswer = String(answer || '').trim();

  if (!nextQuestion || !nextAnswer) {
    const error = new Error('Question and answer are required');
    error.statusCode = 400;
    throw error;
  }

  const items = await ensureFaqIntegrity();
  items.push({
    id: `faq-${crypto.randomUUID()}`,
    question: nextQuestion,
    answer: nextAnswer,
  });
  await writeFaqFile(items);
  return items[items.length - 1];
};

const updateFaq = async (faqId, { question, answer }) => {
  const nextQuestion = String(question || '').trim();
  const nextAnswer = String(answer || '').trim();

  if (!nextQuestion || !nextAnswer) {
    const error = new Error('Question and answer are required');
    error.statusCode = 400;
    throw error;
  }

  const items = await ensureFaqIntegrity();
  const index = items.findIndex((entry) => entry.id === faqId);

  if (index === -1) {
    const error = new Error('FAQ not found');
    error.statusCode = 404;
    throw error;
  }

  items[index] = {
    ...items[index],
    question: nextQuestion,
    answer: nextAnswer,
  };

  await writeFaqFile(items);
  return items[index];
};

const deleteFaq = async (faqId) => {
  const items = await ensureFaqIntegrity();
  const nextItems = items.filter((entry) => entry.id !== faqId);

  if (nextItems.length === items.length) {
    const error = new Error('FAQ not found');
    error.statusCode = 404;
    throw error;
  }

  await writeFaqFile(nextItems);
};

module.exports = {
  listFaqs,
  listFaqsSync,
  createFaq,
  updateFaq,
  deleteFaq,
};
