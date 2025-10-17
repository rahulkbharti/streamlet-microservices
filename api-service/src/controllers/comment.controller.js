import Comment from "../models/mongoose/comment.model.js";

export const GetComments = async (req, res) => {
    try {
        const { videoId } = req.params;
        if (!videoId) return res.status(400).json({ message: "videId required..." });
        const comments = await Comment.find({ videoId });
        return res.status(200).json({ comments });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ message: "Server Error" });
    }
}
