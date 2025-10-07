import mongoose from 'mongoose';

const videoEngagementSchema = new mongoose.Schema({
    // Use the Video UUID from PostgreSQL as the _id for easy linking
    _id: {
        type: String,
        required: true
    },
    viewCount: {
        type: Number,
        default: 0
    },
    likeCount: {
        type: Number,
        default: 0
    },
    dislikeCount: {
        type: Number,
        default: 0
    },
}, { timestamps: true }); // Adds createdAt and updatedAt

const VideoEngagement = mongoose.model('VideoEngagement', videoEngagementSchema);
export default VideoEngagement;