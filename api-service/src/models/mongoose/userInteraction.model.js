import mongoose from 'mongoose';

const userInteractionSchema = new mongoose.Schema({
    videoId: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    interactionType: {
        type: String,
        enum: ['LIKE', 'DISLIKE'], // Can only be one of these values
        required: true
    }
}, { timestamps: true });

// Create a compound index to ensure a user can only have one interaction per video
userInteractionSchema.index({ userId: 1, videoId: 1 }, { unique: true });

const UserInteraction = mongoose.model('UserInteraction', userInteractionSchema);
export default UserInteraction;