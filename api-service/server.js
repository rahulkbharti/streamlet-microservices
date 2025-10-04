// server.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import { Queue, QueueEvents } from 'bullmq';
import cors from 'cors'; // <-- 1. IMPORT THE CORS PACKAGE
import { randomBytes } from 'crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from "dotenv";
import B2 from "backblaze-b2";
import Redis from 'ioredis';

dotenv.config({ path: `.env.${process.env.NODE_ENV || "development"}` });

const b2 = new B2({
    applicationKeyId: process.env.B2_KEY_ID,
    applicationKey: process.env.B2_APPLICATION_KEY
});
// --- Basic Setup ---
const app = express();
const httpServer = createServer(app);

// --- Socket.io Configuration with CORS ---
const io = new Server(httpServer, { // <-- 2. ADD CORS OPTIONS FOR SOCKET.IO
    cors: {
        origin: "*", // The origin of your frontend
        methods: ["GET", "POST"]
    }
});

const PORT = 4000;

// --- Express Middleware ---
// Apply the CORS middleware to your Express app
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static('public'));

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        const ext = file.originalname.split('.').pop();
        const randomId = randomBytes(8).toString('hex');
        cb(null, `${randomId}.${ext}`);
    }
});

const s3 = new S3Client({
    region: process.env.B2_REGION,
    endpoint: process.env.B2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_APPLICATION_KEY,
    },
});

const upload = multer({ storage });

// --- BullMQ & Redis Configuration ---
// const redisOptions = { host: '127.0.0.1', port: 6379 };
const connection = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null
});
const videoQueue = new Queue('video-processing', { connection });

async function main() {
    const jobIdToSocketIdMap = new Map();
    const queueEvents = new QueueEvents('video-processing', { connection });

    queueEvents.on('progress', ({ jobId, data }) => {
        const socketId = jobIdToSocketIdMap.get(jobId);
        if (socketId) {
            console.log(`[SERVER] Progress for job ${jobId}: ${data.progress}%`); // Comment in production
            io.to(socketId).emit('video-progress', { ...data });
        }
    });

    queueEvents.on('completed', ({ jobId, returnvalue }) => {
        const socketId = jobIdToSocketIdMap.get(jobId);
        if (socketId) {
            console.log(`[SERVER] Job ${jobId} completed.`);
            io.to(socketId).emit('video-progress', { progress: 100, status: 'complete', url: returnvalue });
            jobIdToSocketIdMap.delete(jobId);
        }
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
        const socketId = jobIdToSocketIdMap.get(jobId);
        if (socketId) {
            console.error(`[SERVER] Job ${jobId} failed: ${failedReason}`);
            io.to(socketId).emit('video-progress', { status: 'failed', reason: failedReason });
            jobIdToSocketIdMap.delete(jobId);
        }
    });

    app.post('/get-upload-url', async (req, res) => {
        try {
            const { fileName } = req.body;

            if (!fileName) {
                return res.status(400).json({ error: 'FileName required' });
            }

            // Simple unique name
            const uniqueName = `uploads/${Date.now()}_${fileName.replace(/ /g, '_')}`;

            // Generate pre-signed URL for direct upload
            const command = new PutObjectCommand({
                Bucket: "stream-m3u8", // Tumhara bucket name yahan dalo
                Key: uniqueName,
                ContentType: 'video/mp4' // Ya file type ke hisab se
            });

            // Create pre-signed URL (client direct upload kar sakega)
            const presignedUrl = await getSignedUrl(s3, command, {
                expiresIn: 3600 // 1 hour
            });

            console.log('✅ Pre-signed URL generated');

            res.json({
                uploadUrl: presignedUrl,
                fileName: uniqueName,
                method: 'PUT' // AWS SDK PUT method use karta hai
            });

        } catch (error) {
            console.error('💥 Error:', error);
            res.status(500).json({
                error: error.message
            });
        }
    });
    app.post('/schedule-job', async (req, res) => {
        const { key, socketId } = req.body;
        if (!key || !socketId) {
            return res.status(400).json({ error: 'key and socketId are required.' });
        }
        const job = await videoQueue.add('process-video', { key });
        console.log(`[SERVER] Added job ${job.id} for socket: ${socketId}`);
        jobIdToSocketIdMap.set(job.id, socketId);
        res.status(200).json({ message: 'Job queued for processing.', jobId: job.id });
    });

    app.post('/upload', upload.single('video'), async (req, res) => {
        // Try to get socketId from body or query
        const socketId = req.body.socketId;
        const videoFile = req.file;
        console.log("socketId", socketId, req.body);
        if (!socketId) {
            return res.status(400).json({ error: 'socketId missing.' });
        }
        console.log("Socket ID:", socketId);
        console.log("Received file:", videoFile);

        const job = await videoQueue.add('process-video', { videoFile });
        console.log(`[SERVER] Added job ${job.id} for socket: ${socketId}`);
        jobIdToSocketIdMap.set(job.id, socketId);
        res.status(200).json({ message: 'Job queued for processing.', jobId: job.id });
        // res.status(200).json({ message: 'Job queued for processing.' });
    });

    io.on('connection', (socket) => {
        console.log(`[SERVER] Client connected with socket ID: ${socket.id}`);
        socket.on('disconnect', () => {
            console.log(`[SERVER] Client disconnected: ${socket.id}`);
        });
    });

    httpServer.listen(PORT, () => {
        console.log(`[SERVER] Listening on http://localhost:${PORT} 1`);
    });
}

main();