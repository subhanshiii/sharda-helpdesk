import { useState, useCallback, useEffect } from 'react';

/**
 * useOptimisticUpdate
 *
 * Optimistic UI pattern — update the UI immediately,
 * then sync with server in background.
 * If server fails, roll back to previous state.
 *
 * This makes the app feel instant — no waiting for server.
 * Same pattern used by Gmail, Twitter, Notion.
 *
 * Usage:
 *   const { data, optimisticUpdate } = useOptimisticUpdate(initialItems);
 *
 *   // When user clicks bookmark:
 *   optimisticUpdate(
 *     items => items.map(i => i._id === id ? {...i, isBookmarked: true} : i), // optimistic change
 *     () => API.put(`/opportunities/${id}/bookmark`)                           // actual API call
 *   );
 */
export const useOptimisticUpdate = (initialData) => {
  const [data,    setData]    = useState(initialData);
  const [pending, setPending] = useState(false);
  const [error,   setError]   = useState(null);

  const optimisticUpdate = useCallback(async (updater, apiCall) => {
    let previousData;

    // 1. Apply change optimistically — UI updates immediately
    setData((current) => {
      previousData = current;
      return updater(current);
    });
    setPending(true);
    setError(null);

    try {
      // 2. Sync with server in background
      const result = await apiCall();
      setPending(false);
      return result;
    } catch (err) {
      // 3. Server failed — roll back to previous state
      setData(previousData);
      setError(err.message);
      setPending(false);
      throw err;
    }
  }, []);

  const updateData = useCallback((updater) => {
    setData(prev => typeof updater === 'function' ? updater(prev) : updater);
  }, []);

  return { data, setData: updateData, optimisticUpdate, pending, error };
};

/**
 * useDebounce
 * Delays execution until user stops typing.
 * Prevents API calls on every keystroke.
 */
export const useDebounce = (value, delay = 500) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

/**
 * usePagination
 * Reusable pagination state management
 */
export const usePagination = (initialPage = 1, initialLimit = 10) => {
  const [page,  setPage]  = useState(initialPage);
  const [limit] = useState(initialLimit);
  const [total, setTotal] = useState(0);

  const totalPages  = Math.ceil(total / limit);
  const hasNext     = page < totalPages;
  const hasPrev     = page > 1;

  const nextPage = () => { if (hasNext) setPage(p => p + 1); };
  const prevPage = () => { if (hasPrev) setPage(p => p - 1); };
  const goToPage = (p) => { if (p >= 1 && p <= totalPages) setPage(p); };
  const reset    = () => setPage(1);

  return { page, limit, total, setTotal, totalPages, hasNext, hasPrev, nextPage, prevPage, goToPage, reset };
};
