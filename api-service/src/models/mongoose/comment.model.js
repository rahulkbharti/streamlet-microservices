import mongoose, { Schema } from 'mongoose';

const commentSchema = new mongoose.Schema({
    videoId: {
        type: String,
        required: true,
        index: true // Index for fast lookups
    },
    userId: {
        type: String,
        required: true
    },
    commentText: {
        type: String,
        required: true
    },
    // For threaded replies
    parentCommentId: {
        type: Schema.Types.ObjectId,
        ref: 'Comment',
        default: null
    }
}, { timestamps: true });

const Comment = mongoose.model('Comment', commentSchema);
export default Comment;