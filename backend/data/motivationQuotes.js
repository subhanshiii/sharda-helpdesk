const openings = [
  'Small disciplined effort',
  'Steady preparation',
  'Focused practice',
  'Consistent learning',
  'Quiet persistence',
  'Purposeful work',
  'Patient progress',
  'Daily discipline',
  'Curious thinking',
  'Intentional effort',
];

const actions = [
  'turns uncertain mornings into confident decisions',
  'builds the kind of progress that lasts beyond one deadline',
  'creates momentum long before results become visible',
  'makes difficult work feel lighter one step at a time',
  'turns pressure into structure when the day feels heavy',
  'opens doors that talent alone cannot keep open',
  'shapes growth in ways that hurried effort never can',
  'helps ordinary days become meaningful milestones',
  'gives direction to ambition and calm to busy schedules',
  'helps you keep moving even when recognition is delayed',
];

const outcomes = [
  'Keep showing up.',
  'Let today count.',
  'Trust the process.',
  'Progress will follow.',
  'Stay with the work.',
  'Build one good day at a time.',
  'Keep the standard high.',
  'Make consistency your advantage.',
  'Choose effort over noise.',
  'Move with purpose today.',
];

const roleLines = [
  'Learning grows wherever commitment is stronger than comfort.',
  'The work you finish quietly often becomes the strength people notice later.',
  'Real growth begins the moment you stop waiting for perfect conditions.',
  'Leadership, service, and learning all improve when you practice them daily.',
  'The best progress is rarely loud, but it is always earned.',
  'A clear purpose turns demanding days into meaningful ones.',
  'What feels repetitive today often becomes excellence tomorrow.',
  'Confidence is built most reliably by keeping promises to yourself.',
  'A strong community is shaped by people who keep contributing with care.',
  'Meaningful achievement is usually the result of steady, ordinary discipline.',
];

const buildQuoteBank = () => {
  const quotes = [];
  const seen = new Set();

  openings.forEach((opening) => {
    actions.forEach((action) => {
      outcomes.forEach((outcome) => {
        const quote = `${opening} ${action}. ${outcome}`;
        if (!seen.has(quote)) {
          seen.add(quote);
          quotes.push({ quote });
        }
      });
    });
  });

  roleLines.forEach((quote) => {
    if (!seen.has(quote)) {
      seen.add(quote);
      quotes.push({ quote });
    }
  });

  return quotes.slice(0, 1000);
};

module.exports = buildQuoteBank();
