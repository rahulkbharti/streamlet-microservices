import express from 'express';
import videoRoutes from './video.routes.js';
import authRoutes from './auth.routes.js';
import channelRoutes from './channel.routes.js';

const router = express();

router.use('/videos', videoRoutes);
router.use('/auth', authRoutes);
router.use('/channels', channelRoutes);

export default router;