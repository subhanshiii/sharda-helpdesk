const Redis = require('ioredis');

// ── Redis client ───────────────────────────────────────
// ioredis is more feature-rich than the official redis package
// It supports clustering, retries, and pipelines out of the box
let redisClient = null;

const getRedisClient = () => {
  if (redisClient) return redisClient;

  redisClient = new Redis({
    host:     process.env.REDIS_HOST || 'localhost',
    port:     parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,

    // Retry strategy — exponential backoff
    // If Redis is down, don't crash the app — just skip caching
    retryStrategy: (times) => {
      if (times > 3) {
        console.warn('⚠️  Redis connection failed after 3 retries — running without cache');
        return null; // stop retrying
      }
      return Math.min(times * 200, 2000); // wait 200ms, 400ms, 600ms...
    },

    // Don't let Redis errors crash the entire app
    enableOfflineQueue: false,
    lazyConnect: true,
  });

  redisClient.on('connect',    ()    => console.log('✅ Redis connected'));
  redisClient.on('error',      (err) => console.warn('⚠️  Redis error:', err.message));
  redisClient.on('reconnecting', ()  => console.log('🔄 Redis reconnecting...'));

  return redisClient;
};

module.exports = { getRedisClient };
