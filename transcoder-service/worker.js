// worker.js
import { Worker } from 'bullmq';
// import { setTimeout } from 'timers/promises';
import processVideo from './process.js';
import DownloadFromB2 from './utils/b2download.js';
import UploadOnB2 from './utils/b2upload.js';
import fs from 'fs/promises';
import Redis from 'ioredis';
// --- BullMQ & Redis Configuration ---
// const redisOptions = { host: '127.0.0.1', port: 6379 };
const connection = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null
});
console.log('[WORKER] Connected to Redis.: ', process.env.REDIS_URL);
// --- The Processor Function ---
// This async function is where each job is processed.
// The `job` object contains the data and methods to update progress.
const processor = async (job) => {
    console.log(`[WORKER] Starting job ${job.id}. Data:`, job.data);
    // Step 1 : Download The video file (.mp4) from blackblaze
    console.log(`[WORKER] Downloading file from B2: ${job.data.key}`);
    const videoId = job.data.videoId;
    await DownloadFromB2({
        key: job.data.key, videoId, onProgress: async (percent, loaded, total) => {
            await job.updateProgress({ type: "downloading", videoId, fileName: job.data.key, percent, loaded, total });
        }
    });
    console.log(`[WORKER] File downloaded to: ${videoId}`);
    // Step 2 : Process the video File on server (worker)
    await processVideo(`./downloads/${videoId}.mp4`, async ({ res, progress }) => {
        await job.updateProgress({ type: "processing", videoId, res, progress });
    });
    // Optionally delete the local file after processing
    try {
        await fs.unlink(`./downloads/${videoId}.mp4`);
        console.log(`[WORKER] Deleted file: ./downloads/${videoId}.mp4`);
    } catch (err) {
        console.warn(`[WORKER] Could not delete file ./downloads/${videoId}.mp4: ${err.message}`);
    }
    // Step 3 : Upload the chunks files on blackblaze.
    console.log(`[WORKER] Uploading processed files to B2...`);
    const uploadResult = await UploadOnB2(videoId.split('.')[0], true, async (info) => {
        await job.updateProgress({ type: "uploading", videoId, ...info });
    });
    console.log(`[WORKER] Upload completed. Result:`, uploadResult);
    // Cleanup local files if needed
    console.log(`[WORKER] Job ${job.id} complete. Processed video ID: ${videoId}`);

    return { videoId, uploadResult };
};

// --- Worker Initialization ---
// Create a new Worker instance that connects to the 'video-processing' queue.
const worker = new Worker('video-processing', processor, {
    connection,
    concurrency: 1,
    lockDuration: 600000, // 10 minutes
    stalledInterval: 60000, // 1 minute
});

console.log('[WORKER] Worker is running and waiting for jobs...');

// --- Worker Event Listeners (for logging) ---
worker.on('completed', (job, result) => {
    console.log(`[WORKER] Job ${job.id} has completed with result: ${result}`);
});

worker.on('failed', (job, err) => {
    console.error(`[WORKER] Job ${job.id} has failed with error: ${err.message}`);
});