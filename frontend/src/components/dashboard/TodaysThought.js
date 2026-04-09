import React, { useEffect, useMemo, useState } from 'react';
import API from '../../utils/api';

const STORAGE_KEY = 'todays_thought';
const TYPE_SPEED_MS = 30;

const FALLBACK_QUOTES = [
  { quote: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { quote: 'An investment in knowledge pays the best interest.', author: 'Benjamin Franklin' },
  { quote: 'It always seems impossible until it\'s done.', author: 'Nelson Mandela' },
  { quote: 'The expert in anything was once a beginner.', author: 'Helen Hayes' },
  { quote: 'Believe you can and you\'re halfway there.', author: 'Theodore Roosevelt' },
];

const getDateKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getFallbackQuote = () => FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];

const readCachedThought = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.date === getDateKey() && parsed?.quote?.quote) {
      return parsed.quote;
    }
  } catch {
    return null;
  }
  return null;
};

const writeCachedThought = (quote) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: getDateKey(), quote }));
  } catch {
    // Intentionally ignore storage failures.
  }
};

const ThoughtSkeleton = () => (
  <section className="card overflow-hidden border-violet-100">
    <div className="animate-pulse px-4 py-4 sm:px-5">
      <div className="h-3 w-28 rounded-full bg-violet-100" />
      <div className="mt-4 h-6 w-11/12 rounded bg-gray-200" />
      <div className="mt-2 h-6 w-4/5 rounded bg-gray-200" />
      <div className="mt-4 flex items-center gap-2">
        <div className="h-4 w-28 rounded-full bg-gray-200" />
      </div>
    </div>
  </section>
);

export default function TodaysThought() {
  const [loading, setLoading] = useState(true);
  const [thought, setThought] = useState(null);
  const [typedQuote, setTypedQuote] = useState('');

  useEffect(() => {
    const cached = readCachedThought();
    const controller = new AbortController();
    let active = true;

    const finalize = (value) => {
      if (!active) return;
      setThought(value);
      setLoading(false);
    };

    if (cached) {
      finalize(cached);
      return () => {
        active = false;
        controller.abort();
      };
    }

    const loadThought = async () => {
      try {
        const response = await API.get('/motivation/today', { signal: controller.signal });
        const data = response.data?.data;
        const quote = {
          quote: String(data?.quote || '').trim(),
          author: String(data?.author || '').trim() || 'Original',
        };

        if (!quote.quote) {
          throw new Error('Missing quote');
        }

        writeCachedThought(quote);
        finalize(quote);
      } catch (error) {
        if (!active) return;
        const fallback = getFallbackQuote();
        writeCachedThought(fallback);
        finalize(fallback);
      }
    };

    loadThought();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!thought?.quote) {
      setTypedQuote('');
      return undefined;
    }

    setTypedQuote('');
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTypedQuote(thought.quote.slice(0, index));
      if (index >= thought.quote.length) {
        window.clearInterval(timer);
      }
    }, TYPE_SPEED_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [thought]);

  const displayedQuote = useMemo(() => typedQuote || thought?.quote || '', [thought?.quote, typedQuote]);

  if (loading) return <ThoughtSkeleton />;

  const authorLabel = thought?.author === 'AI' ? 'Original' : (thought?.author || 'Original');

  return (
    <section className="card overflow-hidden border-violet-100 bg-gradient-to-r from-violet-50 via-white to-sky-50">
      <div className="px-4 py-4 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-500">Today&apos;s Thought</p>
        <blockquote className="mt-3 text-base font-medium leading-7 text-gray-800 sm:text-lg">
          &ldquo;{displayedQuote}&rdquo;
        </blockquote>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <span className="font-semibold text-gray-700">— {authorLabel}</span>
        </div>
      </div>
    </section>
  );
}
