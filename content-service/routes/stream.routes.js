import express from "express";
import B2 from "backblaze-b2";
import dotenv from "dotenv";
dotenv.config({ path: '.env.development' });
import { redisConnection } from "../config/redis.config.js";

console.log("process.env.B2_KEY_ID", process.env.B2_KEY_ID);
const b2 = new B2({
    applicationKeyId: process.env.B2_KEY_ID,
    applicationKey: process.env.B2_APPLICATION_KEY
});

const getToken = async (videoId) => {
    const cachedToken = await redisConnection.get(videoId);
    if (cachedToken) return cachedToken;
    try {
        await b2.authorize(); // 🔑 authorize first
        const response = await b2.getDownloadAuthorization({
            bucketId: process.env.B2_BUCKET_ID,
            fileNamePrefix: `streams/${videoId}/`,
            validDurationInSeconds: 3600 // 1 hour
        });
        await redisConnection.set(videoId, response.data.authorizationToken, "EX", 3600); // cache for 3600 seconds
        return response.data.authorizationToken;
    } catch (e) {
        console.error("Error fetching token:", e);
        return null;
    }
};

const router = express.Router();

router.get("/:videoId/main.png", async (req, res) => {
    try {
        const videoId = req.params.videoId;
        const token = await getToken(videoId);
        console.log("Got The Token", token)
        if (!token) return res.status(500).send("Failed to generate token");
        const URL = `https://f005.backblazeb2.com/file/stream-m3u8/streams/${videoId}/main.png?Authorization=${token}`;
        return res.redirect(URL);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }

})
// master playlist
router.get('/:videoId/master.m3u8', async (req, res) => {
    try {
        const videoId = req.params.videoId;
        const token = await getToken(videoId);
        console.log("Got The Token", token)
        if (!token) return res.status(500).send("Failed to generate token");

        const URL = `https://f005.backblazeb2.com/file/stream-m3u8/streams/${videoId}/master.m3u8?Authorization=${token}`;
        const response = await fetch(URL);

        if (!response.ok) {
            return res.status(response.status).send("Failed to fetch master");
        }

        let m3u8Text = await response.text();

        // rewrite sub-playlists with token
        m3u8Text = m3u8Text.replace(/(\d+p\/playlist\.m3u8)/g, `$1?Authorization=${token}`);
        // console.log(m3u8Text)
        console.log("re-written master.m3u8")
        res.set("Content-Type", "application/vnd.apple.mpegurl");
        res.send(m3u8Text);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});
// resolution playlist
router.get('/:videoId/:resolution/playlist.m3u8', async (req, res) => {
    try {
        const { videoId, resolution } = req.params;
        const { Authorization } = req.query;
        const URL = `https://f005.backblazeb2.com/file/stream-m3u8/streams/${videoId}/${resolution}/playlist.m3u8?Authorization=${Authorization}`;
        const response = await fetch(URL);

        if (!response.ok) {
            return res.status(response.status).send("Failed to fetch master");
        }

        let m3u8Text = await response.text();

        // rewrite sub-playlists with token
        m3u8Text = m3u8Text.replace(/(segment\d+\.ts)/g, `$1?Authorization=${Authorization}`);
        // console.log(m3u8Text)
        console.log("re-written playlist.m3u8")
        res.set("Content-Type", "application/vnd.apple.mpegurl");
        res.send(m3u8Text);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});
// segment
router.get('/:videoId/:resolution/:segment', async (req, res) => {
    try {
        const { videoId, resolution, segment } = req.params;
        const { Authorization } = req.query;
        const URL = `https://f005.backblazeb2.com/file/stream-m3u8/streams/${videoId}/${resolution}/${segment}?Authorization=${Authorization}`;
        return res.redirect(URL);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});
// thumbnails vtt
router.get('/:videoId/thumbnails.vtt', async (req, res) => {
    try {
        const videoId = req.params.videoId;
        const token = await getToken(videoId);
        if (!token) return res.status(500).send("Failed to generate token");

        const URL = `https://f005.backblazeb2.com/file/stream-m3u8/streams/${videoId}/thumbnails.vtt?Authorization=${token}`;
        const response = await fetch(URL);

        if (!response.ok) {
            return res.status(response.status).send("Failed to fetch vtt");
        }

        let vttText = await response.text();

        // rewrite sub-playlists with token
        vttText = vttText.replace(
            /(previews\/[^\s]+\.png)/g,
            (match) => `${match}?Authorization=${token}`
        );
        // console.log(vttText)
        console.log("re-written master.vtt")
        res.set("Content-Type", "text/vtt");
        res.send(vttText);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});
// single thumbnail
router.get('/:videoId/previews/:thumbnail', (req, res) => {
    try {
        const { videoId, thumbnail } = req.params;
        const { Authorization } = req.query;
        const URL = `https://f005.backblazeb2.com/file/stream-m3u8/streams/${videoId}/previews/${thumbnail}?Authorization=${Authorization}`;
        return res.redirect(URL);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});



export default router;

