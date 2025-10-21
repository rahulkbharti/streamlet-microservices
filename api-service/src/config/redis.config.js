// src/config/redis.config.js
import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config({ path: `./${process.env.ENV_FILE}` });

const redisConnection = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null
});

redisConnection.on('connect', () => console.log('[REDIS] Connected to Redis.'));
redisConnection.on('error', (err) => console.error('[REDIS] Redis Error:', err));

export { redisConnection };