// apps/api/src/utils/cache.js

import Redis from 'ioredis';
import logger from './logger.js';
import 'dotenv/config';

const cache = new Map();
let redis = null;

const url = process.env.REDIS_PUBLIC_URL || process.env.REDIS_URL;
if (url) {
    try {
        logger.info('🔗 Cache: Initializing Redis from URL');
        redis = new Redis(url, {
            maxRetriesPerRequest: 1,
            retryStrategy: () => null // Don't keep retrying if Redis is down
        });
        redis.on('error', (err) => logger.warn('Redis Cache Error', { error: err.message }));
    } catch (e) {
        logger.warn('Failed to connect to Redis, falling back to memory cache', { error: e.message });
    }
} else {
    if (process.env.NODE_ENV === 'production') {
        logger.error('❌ Cache: No REDIS_URL found in production, using memory fallback');
    } else {
        logger.info('📦 Cache: Using local memory fallback (Dev)');
    }
}

export const memoryCache = {
    set: async (key, value, ttlSeconds = 60) => {
        if (redis) {
            try {
                await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
                return;
            } catch (e) {
                // Fallback to memory
            }
        }
        const expiry = Date.now() + ttlSeconds * 1000;
        cache.set(key, { value, expiry });
    },

    get: async (key) => {
        if (redis) {
            try {
                const val = await redis.get(key);
                return val ? JSON.parse(val) : null;
            } catch (e) {
                // Fallback to memory
            }
        }
        const item = cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expiry) {
            cache.delete(key);
            return null;
        }

        return item.value;
    },

    delete: async (key) => {
        if (redis) try { await redis.del(key); } catch (e) { }
        cache.delete(key);
    },

    clear: async () => {
        if (redis) try { await redis.flushdb(); } catch (e) { }
        cache.clear();
    }
};
