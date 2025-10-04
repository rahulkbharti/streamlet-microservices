// src/api/routes/video.routes.js
import { Router } from 'express';
import { getUploadUrl, scheduleVideoJob } from '../controllers/video.controller.js';

const router = Router();

router.route('/get-upload-url').post(getUploadUrl);
router.route('/schedule-job').post(scheduleVideoJob);

export default router;