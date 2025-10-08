// src/queues/queue.events.js
import { QueueEvents } from 'bullmq';
import { redisConnection } from '../config/redis.config.js';
import { getSocketIdForJob, removeJobFromSocketMap } from '../sockets/socket.handler.js';
import prisma from '../utils/prisma.js';

const initializeQueueEvents = (io) => {
    const queueEvents = new QueueEvents('video-processing', { connection: redisConnection });

    queueEvents.on('progress', ({ jobId, data }) => {
        const socketId = getSocketIdForJob(jobId);
        if (socketId) {
            console.log(`[QUEUE] Progress for job ${jobId}: ${data.progress}%`);
            io.to(socketId).emit('video-progress', { ...data });
        }
    });

    queueEvents.on('completed', async ({ jobId, returnvalue }) => {
        const socketId = getSocketIdForJob(jobId);
        if (socketId) {
            console.log(`[QUEUE] Job ${jobId} completed.`, returnvalue);
            io.to(socketId).emit('video-progress', { progress: 100, status: 'complete', url: returnvalue });
            const { videoId } = returnvalue;
            console.log(`[QUEUE] Video available at /watch/${videoId}/master.m3u8`);
            const result = await prisma.video.update({
                where: { videoId: videoId },
                data: { uploadStatus: 'PUBLISHED' }
            });
            console.log(`[QUEUE] Database updated for video ${videoId}:`, result);
            removeJobFromSocketMap(jobId);
        }
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
        const socketId = getSocketIdForJob(jobId);
        if (socketId) {
            console.error(`[QUEUE] Job ${jobId} failed: ${failedReason}`);
            io.to(socketId).emit('video-progress', { status: 'failed', reason: failedReason });
            removeJobFromSocketMap(jobId);
        }
    });

    console.log('[QUEUE] Event listeners initialized.');
};

export { initializeQueueEvents };