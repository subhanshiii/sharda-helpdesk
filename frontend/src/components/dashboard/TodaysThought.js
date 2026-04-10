import React, { useEffect, useMemo, useState } from 'react';
import API from '../../utils/api';

const STORAGE_KEY = 'todays_thought_v2';
const TYPE_SPEED_MS = 30;

const FALLBACK_QUOTES = [
  { quote: 'The secret of getting ahead is getting started.' },
  { quote: 'An investment in knowledge pays the best interest.' },
  { quote: 'It always seems impossible until it\'s done.' },
  { quote: 'The expert in anything was once a beginner.' },
  { quote: 'Believe you can and you\'re halfway there.' },
  { quote: 'Success is the sum of small efforts, repeated day in and day out.' },
  { quote: 'Excellence is never an accident. It is always the result of high intention and sincere effort.' },
  { quote: 'The future depends on what you do today.' },
  { quote: 'Start where you are. Use what you have. Do what you can.' },
  { quote: 'Perseverance is not a long race; it is many short races one after the other.' },
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
  <section className="dashboard-thought-card card overflow-hidden border-violet-100">
    <div className="animate-pulse px-4 py-4 sm:px-5">
      <div className="h-3 w-28 rounded-full bg-violet-100" />
      <div className="mt-4 h-5 w-10/12 rounded bg-gray-200" />
      <div className="mt-2 h-5 w-3/4 rounded bg-gray-200" />
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

  return (
    <section className="dashboard-thought-card card overflow-hidden border-violet-100 bg-gradient-to-r from-violet-50 via-white to-sky-50 min-h-[132px]">
      <div className="px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <p className="dashboard-thought-title dashboard-eyebrow text-violet-500">Today&apos;s Thought</p>
        </div>
        <blockquote className="dashboard-thought-body mt-3 max-w-3xl text-[15px] font-medium leading-7 text-gray-800 sm:text-base">
          &ldquo;{displayedQuote}&rdquo;
        </blockquote>
      </div>
    </section>
  );
}
