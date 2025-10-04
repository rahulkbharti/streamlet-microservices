// src/queues/video.queue.js
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.config.js';

const videoQueue = new Queue('video-processing', {
    connection: redisConnection
});

export { videoQueue };