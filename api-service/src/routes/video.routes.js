// src/api/routes/video.routes.js
import { Router } from 'express';
import { createVideo, deleteVideo, engageVideo, getVideoPublic, getVideosPublic, updateVideo } from '../controllers/video.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.get("/videos", getVideosPublic);
router.get("/videos/:videoId", getVideoPublic);
router.post("/videos", authenticateToken, createVideo);
router.put("/videos/:videoId", authenticateToken, updateVideo);
router.delete("/videos/:videoId", authenticateToken, deleteVideo);

router.post("/engag/:videoId", authenticateToken, engageVideo);
export default router;