// src/api/routes/video.routes.js
import { Router } from 'express';
import { createVideo, deleteVideo, engageVideo, getVideoPublic, getVideosPublic, updateVideo } from '../controllers/video.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { publicAuthenticateToken } from '../middlewares/publicAuth.middleware.js';
import { GetComments } from '../controllers/comment.controller.js';

const router = Router();

router.get("/", getVideosPublic);
router.get("/:videoId", publicAuthenticateToken, getVideoPublic);
router.post("", authenticateToken, createVideo);
router.put("/:videoId", authenticateToken, updateVideo);
router.delete("/:videoId", authenticateToken, deleteVideo);

router.post("/engag/:videoId", authenticateToken, engageVideo);
router.get("/comments/:videoId", GetComments);
// router.get("/engagements/:videoId");

export default router;