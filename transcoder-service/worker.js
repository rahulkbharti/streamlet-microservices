import { Worker } from 'bullmq';
import processVideo from './process.js';
import Redis from 'ioredis';
import { downloadVideo } from './utils/azureDownload.js';
import { UploadStream } from './utils/azureUpload.js';
import { cleanupResources } from './utils/cleanupResources.js';

const connection = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null
});
console.log('[WORKER] Connected to Redis.: ', process.env.REDIS_URL);


// The `job` object contains the data and methods to update progress.
const processor = async (job) => {
    console.log(`[WORKER] Starting job ${job.id}. Data:`, job.data);
    const videoId = job.data.videoId;
    const key = job.data.key;

    const downloadUpdate = async ({ loadedBytes, totalBytes, percent }) => {
        // console.log(`[WORKER] Download progress: ${progress}%`);
        await job.updateProgress({ type: "downloading", videoId, fileName: key, percent, loadedBytes, totalBytes })
    }
    const processUpdate = async ({ res, progress }) => {
        await job.updateProgress({ type: "processing", videoId, res, progress });
    }
    const uploadUpdate = async (update) => {
        await job.updateProgress({ type: "uploading", videoId, ...update });
    }


    console.log(`videoId is ${videoId} , key is ${key}`);
    // Step 1 : Download The video file (.mp4) from azure
    console.log(`Downloading file from Azure: ${key}`);
    await downloadVideo(key, `${videoId}.mp4`, downloadUpdate);
    console.log(`File downloaded to: ./downloads/${videoId}.mp4`);
    // Step 2 : Process the video
    await processVideo(`./downloads/${videoId}.mp4`, processUpdate);
    console.log("video is process")
    // Step 3 : Upload back to Azure
    console.log(`Uploading video streams to Azure: ${videoId}`);
    await UploadStream(videoId, uploadUpdate);
    console.log("video streams is uploaded to azure")

    //Cleaning Up process
    await cleanupResources(key, `${videoId}.mp4`, videoId);

    return { videoId }
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