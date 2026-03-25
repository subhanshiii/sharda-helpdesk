const { getRedisClient } = require('./redis');

// ── TTL constants (in seconds) ─────────────────────────
// These are carefully chosen based on how often data changes
const TTL = {
  STATS:         60,          // Dashboard stats — refresh every 60s
  ANNOUNCEMENTS: 5 * 60,      // Announcements — refresh every 5min
  OPPORTUNITIES: 3 * 60,      // Opportunities list — refresh every 3min
  EVENTS:        3 * 60,      // Events list — refresh every 3min
  AGENTS:        10 * 60,     // Agent list — refresh every 10min (rarely changes)
  FAQ:           60 * 60,     // FAQ — refresh every 1 hour (almost never changes)
  USER:          5 * 60,      // User profile — refresh every 5min
};

// ── Cache key builders ─────────────────────────────────
// Consistent naming prevents key collisions
const KEYS = {
  stats:         (userId, role) => `stats:${role}:${userId}`,
  announcements: ()             => 'announcements:all',
  opportunities: (page, type)   => `opportunities:${page}:${type || 'all'}`,
  events:        (page, filter) => `events:${page}:${filter || 'upcoming'}`,
  agents:        ()             => 'users:agents',
  faq:           ()             => 'chat:faqs',
  userProfile:   (userId)       => `user:${userId}`,
};

// ── Core cache operations ──────────────────────────────

/**
 * Get from cache
 * Returns parsed data or null if miss/error
 */
const get = async (key) => {
  try {
    const client = getRedisClient();
    if (client.status !== 'ready') return null;

    const data = await client.get(key);
    if (!data) return null;

    return JSON.parse(data);
  } catch (err) {
    console.warn(`Cache GET error for key ${key}:`, err.message);
    return null; // cache miss — fallback to DB
  }
};

/**
 * Set in cache with TTL
 */
const set = async (key, data, ttl) => {
  try {
    const client = getRedisClient();
    if (client.status !== 'ready') return false;

    await client.setex(key, ttl, JSON.stringify(data));
    return true;
  } catch (err) {
    console.warn(`Cache SET error for key ${key}:`, err.message);
    return false;
  }
};

/**
 * Delete specific key (cache invalidation)
 */
const del = async (key) => {
  try {
    const client = getRedisClient();
    if (client.status !== 'ready') return;
    await client.del(key);
  } catch (err) {
    console.warn(`Cache DEL error for key ${key}:`, err.message);
  }
};

/**
 * Delete all keys matching a pattern
 * e.g., invalidate all stats: delPattern('stats:*')
 */
const delPattern = async (pattern) => {
  try {
    const client = getRedisClient();
    if (client.status !== 'ready') return;

    // SCAN is non-blocking unlike KEYS — safe for production
    let cursor = '0';
    do {
      const [newCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;
      if (keys.length > 0) await client.del(...keys);
    } while (cursor !== '0');
  } catch (err) {
    console.warn(`Cache DELPATTERN error for ${pattern}:`, err.message);
  }
};

/**
 * Cache-aside pattern helper
 * Tries cache first, falls back to fetcher fn, stores result
 * This is the most common caching pattern
 *
 * Usage:
 *   const data = await withCache('key', 60, () => db.findAll())
 */
const withCache = async (key, ttl, fetcher) => {
  // 1. Try cache
  const cached = await get(key);
  if (cached !== null) {
    return { data: cached, fromCache: true };
  }

  // 2. Cache miss — fetch from source
  const data = await fetcher();

  // 3. Store in cache (don't await — don't block response)
  set(key, data, ttl).catch(() => {});

  return { data, fromCache: false };
};

module.exports = { get, set, del, delPattern, withCache, TTL, KEYS };
