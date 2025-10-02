// worker.js
import { Worker } from 'bullmq';
// import { setTimeout } from 'timers/promises';
import processVideo from './process.js';
// --- BullMQ & Redis Configuration ---
const redisOptions = { host: '127.0.0.1', port: 6379 };

// --- The Processor Function ---
// This async function is where each job is processed.
// The `job` object contains the data and methods to update progress.
const processor = async (job) => {
    console.log(`[WORKER] Starting job ${job.id}. Data:`, job.data);

    // Simulate a multi-step process with granular updates
    const updateFn = async ({ res, progress }) => {
        // console.log("Res", res, "progress", progress);
        await job.updateProgress({ res, progress });
    }
    console.log(job.data.videoFile.path)
    await processVideo(job.data.videoFile.path, updateFn);

    console.log(`[WORKER] Job ${job.id} complete.`);
    // The return value of the processor is stored as the job's result
    return `/processed/${job.data.videoFile.originalname}`;
};

// --- Worker Initialization ---
// Create a new Worker instance that connects to the 'video-processing' queue.
const worker = new Worker('video-processing', processor, {
    connection: redisOptions,
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