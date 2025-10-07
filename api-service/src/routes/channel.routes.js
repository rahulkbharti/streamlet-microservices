import express from "express";
import { getChannels, createChannel, updateChannel, deleteChannel } from "../controllers/channel.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
const router = express.Router();
router.get('/', getChannels);
router.post('/', authenticateToken, createChannel);
router.put('/:id', authenticateToken, updateChannel);
router.delete('/:id', authenticateToken, deleteChannel);
export default router;