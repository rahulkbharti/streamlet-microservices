import express from "express";
import { getBlobUrl, getContainerSASToken } from "../utils/getSASTokens.js";
const router = express.Router();

router.get("/:videoId/main.png", async (req, res) => {
    try {
        const videoId = req.params.videoId;
        const token = await getContainerSASToken();
        if (!token) return res.status(500).json({ message: "Failed to generate token" });

        const blobPath = `${videoId}/main.png`;
        const URL = `${getBlobUrl(blobPath)}?${token}`;
        return res.redirect(URL);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// master playlist
router.get('/:videoId/master.m3u8', async (req, res) => {
    try {
        const videoId = req.params.videoId;
        const token = await getContainerSASToken();
        if (!token) return res.status(500).json({ message: "Failed to generate token" });

        const blobPath = `${videoId}/master.m3u8`;
        const URL = `${getBlobUrl(blobPath)}?${token}`;
        const response = await fetch(URL);

        if (!response.ok) {
            return res.status(response.status).json({ message: `Failed to fetch master playlist. Status: ${response.status}` });
        }
        let m3u8Text = await response.text();
        // Rewrite sub-playlists with token
        m3u8Text = m3u8Text.replace(
            /(\d+p\/playlist\.m3u8)/g,
            `$1?${token}`
        );

        console.log(`[${videoId}] : Generated Signed master.m3u8`);
        res.set("Content-Type", "application/vnd.apple.mpegurl");
        res.send(m3u8Text);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// resolution playlist
router.get('/:videoId/:resolution/playlist.m3u8', async (req, res) => {
    try {
        const { videoId, resolution } = req.params;
        const token = req.url.split('?')[1];

        if (!token) {
            return res.status(401).json({ message: "Missing authorization token" });
        }
        const blobPath = `${videoId}/${resolution}/playlist.m3u8`;
        const URL = `${getBlobUrl(blobPath)}?${token}`;
        const response = await fetch(URL);

        if (!response.ok) {
            return res.status(response.status).send(`Failed to fetch playlist. Status: ${response.status}`);
        }

        let m3u8Text = await response.text();
        const segmentBaseUrl = getBlobUrl(`${videoId}/${resolution}`);

        // Rewrite segments with an ABSOLUTE URL to the Azure blob
        m3u8Text = m3u8Text.replace(
            /(segment\d+\.ts)/g,
            `${segmentBaseUrl}/$1?${token}`
        );

        console.log(`[${videoId}] : Generated Signed playlist-${resolution}.m3u8`);
        res.set("Content-Type", "application/vnd.apple.mpegurl");
        res.send(m3u8Text);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

// thumbnails vtt
router.get('/:videoId/thumbnails.vtt', async (req, res) => {
    try {
        const videoId = req.params.videoId;
        const token = await getContainerSASToken();
        if (!token) return res.status(500).send("Failed to generate token");

        const blobPath = `${videoId}/thumbnails.vtt`;
        const URL = `${getBlobUrl(blobPath)}?${token}`;
        const response = await fetch(URL);

        if (!response.ok) {
            return res.status(response.status).send(`Failed to fetch vtt. Status: ${response.status}`);
        }

        let vttText = await response.text();
        const previewBaseUrl = getBlobUrl(videoId);

        // rewrite preview URLs with ABSOLUTE paths
        vttText = vttText.replace(
            /(previews\/[^\s]+\.png)/g,
            (match) => `${previewBaseUrl}/${match}?${token}`
        );

        console.log(`[${videoId}] : Generated Signed master.vtt`)
        res.set("Content-Type", "text/vtt");
        res.send(vttText);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

// Export the router for use in your main server file
export default router;

