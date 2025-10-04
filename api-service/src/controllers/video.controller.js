// src/api/controllers/video.controller.js
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from "../config/b2.config.js";
import { videoQueue } from '../queues/video.queue.js';
import { addJobToSocketMap } from '../sockets/socket.handler.js';

const getUploadUrl = async (req, res) => {
    try {
        const { fileName } = req.body;
        if (!fileName) {
            return res.status(400).json({ error: 'FileName required' });
        }

        const uniqueName = `uploads/${Date.now()}_${fileName.replace(/ /g, '_')}`;
        const command = new PutObjectCommand({
            Bucket: "stream-m3u8",
            Key: uniqueName,
            ContentType: 'video/mp4',
        });

        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        console.log('✅ Pre-signed URL generated');

        res.status(200).json({
            uploadUrl: presignedUrl,
            fileName: uniqueName,
        });

    } catch (error) {
        console.error('💥 Error:', error);
        res.status(500).json({ error: error.message });
    }
};

const scheduleVideoJob = async (req, res) => {
    const { key, socketId } = req.body;
    if (!key || !socketId) {
        return res.status(400).json({ error: 'key and socketId are required.' });
    }

    const job = await videoQueue.add('process-video', { key });
    console.log(`[SERVER] Added job ${job.id} for socket: ${socketId}`);

    // Link job ID to socket ID
    addJobToSocketMap(job.id, socketId);

    res.status(200).json({ message: 'Job queued for processing.', jobId: job.id });
};

export { getUploadUrl, scheduleVideoJob };