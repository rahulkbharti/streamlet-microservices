// src/api/controllers/video.controller.js
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from "../config/b2.config.js";
import { videoQueue } from '../queues/video.queue.js';
import { addJobToSocketMap } from '../sockets/socket.handler.js';
import prisma from "../utils/prisma.js";
import VideoEngagement from '../models/mongoose/videoEngagement.model.js';
import UserInteraction from '../models/mongoose/userInteraction.model.js';
// Make sure to import the Comment model if it's in a separate file
import Comment from '../models/mongoose/comment.model.js';
import { generateVideoId } from '../utils/generateVideoId.js';

const getUploadUrl = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        console.log('📥 Generating upload URL with request body:', req.body);
        const { title, description } = req.body;
        if (!title) {
            return res.status(400).json({ error: 'title is required' });
        }
        const videoId = generateVideoId();
        const uniqueName = `uploads/${Date.now()}_${title.replace(/ /g, '_')}`;
        const command = new PutObjectCommand({
            Bucket: "stream-m3u8",
            Key: uniqueName,
            ContentType: 'video/mp4',
        });
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: { channel: true }
        });
        if (!user || !user.channel) {
            return res.status(400).json({ error: 'User does not have a channel' });
        }
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        console.log('✅ Pre-signed URL generated');
        const response = await prisma.video.create({
            data: {
                title: uniqueName.split("/")[1],
                description: description,
                videoId: videoId.split('.')[0],
                channel: { connect: { id: user.channel.id } }
            }
        });
        if (!response) {
            return res.status(500).json({ error: 'Failed to create video record' });
        }
        res.status(200).json({
            uploadUrl: presignedUrl,
            key: uniqueName,
            ...response

        });
    } catch (error) {
        console.error('💥 Error:', error);
        res.status(500).json({ error: error.message });
    }
};

const scheduleVideoJob = async (req, res) => {
    const { key, videoId, socketId } = req.body;
    if (!key || !socketId) {
        return res.status(400).json({ error: 'key and socketId are required.' });
    }
    const job = await videoQueue.add('process-video', { key, videoId });
    console.log(`[SERVER] Added job ${job.id} for socket: ${socketId}`);
    addJobToSocketMap(job.id, socketId);
    res.status(200).json({ message: 'Job queued for processing.', jobId: job.id });
};

const getVideosPublic = async (req, res) => {
    try {
        // 1. Get all public videos from PostgreSQL
        const videos = await prisma.video.findMany({
            where: {
                uploadStatus: "PUBLISHED",
                visibility: "PUBLIC"
            },
            include: { channel: true }
        });

        if (!videos.length) {
            return res.status(200).json([]);
        }

        // 2. Collect all video IDs
        const videoIds = videos.map(video => video.id);

        // 3. Fetch all related engagements from MongoDB in one query
        const engagements = await VideoEngagement.find({ _id: { $in: videoIds } });

        // Create a lookup map for engagements for quick access
        const engagementMap = new Map(engagements.map(e => [e._id.toString(), e]));

        // 4. Combine the video data with its engagement data
        const combinedVideos = videos.map(video => ({
            ...video,
            engagements: engagementMap.get(video.id.toString()) || null
        }));

        res.status(200).json(combinedVideos);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Server Error" });
    }
};

const getVideoPublic = async (req, res) => {
    const { videoId } = req.params;
    if (!videoId) {
        return res.status(400).json({ message: "Video ID is required" });
    }
    try {
        // 1. Get the specific video from PostgreSQL
        const video = await prisma.video.findFirst({
            where: {
                uploadStatus: "PUBLISHED",
                visibility: "PUBLIC",
                videoId
            },
            include: { channel: { include: { _count: { select: { subscribers: true } } } } }
        });

        if (!video) {
            return res.status(404).json({ message: "Video not found" });
        }

        // ✨ NEW: Atomically increment the view count in MongoDB
        await VideoEngagement.findOneAndUpdate(
            { _id: video.id },
            { $inc: { viewCount: 1 } },
            { upsert: true } // Creates the document if it doesn't exist
        );
        // console.log(result)

        // 2. Fetch all related data from MongoDB in parallel
        const [engagements, comments] = await Promise.all([
            VideoEngagement.findOne({ _id: video.id }),
            Comment.find({ videoId: video.id }).populate('userId', 'name profileImageUrl'), // Example of populating user info
            // UserInteraction.find({ videoId: video.id })
        ]);

        // 3. Check if the current user has liked, disliked, or subscribed
        let userStatus = {
            liked: false,
            disliked: false,
            subscribed: false
        };

        if (req.user) {
            // Check like/dislike status
            const userInteraction = await UserInteraction.findOne({
                videoId: video.id,
                userId: req.user.id
            });
            if (userInteraction) {
                // console.log(userInteraction)
                userStatus.liked = userInteraction.interactionType === "LIKE";
                userStatus.disliked = userInteraction.interactionType === "DISLIKE";
            }
            // Check subscription status
            const subscription = await prisma.subscription.findUnique({
                where: {
                    subscriberId_channelId: {
                        subscriberId: req.user.id,
                        channelId: video.channelId
                    }
                }
            });
            userStatus.subscribed = !!subscription;
            // console.log(subscription)
        }
        // 4. Combine all data into a single response object
        const combinedResponse = {
            ...video,
            engagements: engagements || null,
            comments: comments || [],
            userStatus
        };
        res.status(200).json(combinedResponse);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Server Error" });
    }
};

const engageVideo = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = req.user.id;
    const { videoId } = req.params;
    const { action, commentText, channelId } = req.body;

    if (!videoId || !action || !userId) {
        return res
            .status(400)
            .json({ message: "videoId, action, and userId are required" });
    }

    try {
        let responseMessage = "";

        // Find user's current interaction with this video (if any)
        const interaction = await UserInteraction.findOne({ videoId, userId });
        let engagement = await VideoEngagement.findById(videoId);

        // If video engagement doesn’t exist yet → create it
        if (!engagement) {
            engagement = new VideoEngagement({ _id: videoId });
            await engagement.save();
        }

        switch (action) {

            case "dislike": {
                if (interaction?.interactionType === "DISLIKE") {
                    // Already disliked → remove dislike
                    await UserInteraction.deleteOne({ videoId, userId });
                    engagement.dislikeCount = Math.max(0, engagement.dislikeCount - 1);
                    responseMessage = "Dislike removed";
                } else {
                    // Add or switch to dislike
                    if (interaction?.interactionType === "LIKE") {
                        engagement.likeCount = Math.max(0, engagement.likeCount - 1);
                    }
                    await UserInteraction.findOneAndUpdate(
                        { videoId, userId },
                        { interactionType: "DISLIKE" },
                        { upsert: true }
                    );
                    engagement.dislikeCount += 1;
                    responseMessage = "Video disliked";
                }
                break;
            }
            case "like": {
                if (interaction?.interactionType === "LIKE") {
                    // Already liked → remove like
                    await UserInteraction.deleteOne({ videoId, userId });
                    engagement.likeCount = Math.max(0, engagement.likeCount - 1);
                    responseMessage = "Like removed";
                } else {
                    // Add or switch to like
                    if (interaction?.interactionType === "DISLIKE") {
                        engagement.dislikeCount = Math.max(0, engagement.dislikeCount - 1);
                    }
                    await UserInteraction.findOneAndUpdate(
                        { videoId, userId },
                        { interactionType: "LIKE" },
                        { upsert: true }
                    );
                    engagement.likeCount += 1;
                    responseMessage = "Video liked";
                }
                break;
            }
            case "comment": {
                if (!commentText)
                    return res.status(400).json({ message: "commentText is required" });
                const user = await prisma.user.findUnique({ where: { id: userId } });
                // console.log("user", user);
                const newComment = new Comment({ videoId, userId: user.username || "Anonymous User", commentText });
                await newComment.save();

                responseMessage = "Comment added";
                return res.status(200).json({ message: responseMessage, comment: newComment });
            }
            case "subscribe": {
                if (!channelId)
                    return res
                        .status(400)
                        .json({ message: "channelId is required for subscribe action" });

                const existingSub = await prisma.subscription.findUnique({
                    where: {
                        subscriberId_channelId: { subscriberId: userId, channelId },
                    },
                });

                // console.log("existingSub", existingSub);

                if (existingSub) {
                    await prisma.subscription.delete({ where: { subscriberId_channelId: { subscriberId: userId, channelId } } });
                    responseMessage = "Unsubscribed successfully";
                } else {
                    await prisma.subscription.create({
                        data: { subscriberId: userId, channelId },
                    });
                    responseMessage = "Subscribed successfully";
                }

                return res.status(200).json({ message: responseMessage });
            }

            default:
                return res.status(400).json({ message: "Invalid action" });
        }

        // Save engagement updates
        await engagement.save();

        res.status(200).json({
            message: responseMessage,
            engagement: {
                likeCount: engagement.likeCount,
                dislikeCount: engagement.dislikeCount,
                viewCount: engagement.viewCount,
            },
        });
    } catch (error) {
        console.error("❌ engageVideo Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
};

const createVideo = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const { title, description, videoId, uploadStatus } = req.body;
        const channel = await prisma.channel.findFirst({
            where: { userId: req.user.id }
        });
        const response = await prisma.video.create({
            data: {
                title,
                description,
                videoId,
                uploadStatus,
                channel: { connect: { id: channel.id } }
            }
        });
        // Create a new VideoEngagement document in MongoDB for this video
        const videoEngage = await VideoEngagement.create({ _id: response.id });
        res.status(201).json({ video: response, engagement: videoEngage });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Server Error" });
    }
}

const updateVideo = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const { videoId } = req.params;
        const { title, description, uploadStatus } = req.body;

        const video = await prisma.video.findUnique({ where: { id: videoId } });
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Optional: Check if the user owns the video/channel
        const channel = await prisma.channel.findFirst({ where: { userId: req.user.id } });
        if (!channel || video.channelId !== channel.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const updatedVideo = await prisma.video.update({
            where: { id: videoId },
            data: { title, description, uploadStatus }
        });

        res.status(200).json(updatedVideo);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Server Error" });
    }
};

const deleteVideo = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const { videoId } = req.params;

        const video = await prisma.video.findUnique({ where: { id: videoId } });
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Optional: Check if the user owns the video/channel
        const channel = await prisma.channel.findFirst({ where: { userId: req.user.id } });
        if (!channel || video.channelId !== channel.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        await prisma.video.delete({ where: { id: videoId } });

        res.status(200).json({ message: 'Video deleted successfully' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Server Error" });
    }
};


export { getUploadUrl, scheduleVideoJob, getVideosPublic, getVideoPublic, engageVideo, createVideo, updateVideo, deleteVideo };