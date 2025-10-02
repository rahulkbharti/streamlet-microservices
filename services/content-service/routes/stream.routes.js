import express from "express";
import path from "path";
const router = express.Router();

// master playlist
router.get('/:videoId/master.m3u8', (req, res) => {
    const filePath = path.join(process.cwd(), '../streams', req.params.videoId, 'master.m3u8');
    res.sendFile(filePath);
});

// resolution playlist
router.get('/:videoId/:resolution/playlist.m3u8', (req, res) => {
    const filePath = path.join(process.cwd(), '../streams', req.params.videoId, req.params.resolution, 'playlist.m3u8');
    res.sendFile(filePath);
});

// thumbnails vtt
router.get('/:videoId/thumbnails.vtt', (req, res) => {
    const filePath = path.join(process.cwd(), '../streams', req.params.videoId, 'thumbnails.vtt');
    res.sendFile(filePath);
});

// single thumbnail
router.get('/:videoId/previews/:thumbnail', (req, res) => {
    const filePath = path.join(process.cwd(), '../streams', req.params.videoId, 'previews', req.params.thumbnail);
    res.sendFile(filePath);
});

// segment
router.get('/:videoId/:resolution/:segment', (req, res) => {
    const filePath = path.join(process.cwd(), '../streams', req.params.videoId, req.params.resolution, req.params.segment);
    res.sendFile(filePath);
});

export default router;
