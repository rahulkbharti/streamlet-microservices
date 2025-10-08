import B2 from "backblaze-b2";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { generateVideoId } from "./nameGenerator.js";

dotenv.config({ path: '.env.development' });
const BUCKET_NAME = 'stream-m3u8';
const b2 = new B2({
    applicationKeyId: process.env.B2_KEY_ID,
    applicationKey: process.env.B2_APPLICATION_KEY
});

const DownloadFromB2 = async ({ key, videoId, onProgress }) => {
    if (!key) throw new Error('Key is required for download.');
    try {
        await b2.authorize();

        const fileName = key; // Keep 'uploads/filename.mp4'
        const outputPath = path.join(process.cwd(), 'downloads', videoId + ".mp4");

        // Ensure downloads directory exists
        const downloadsDir = path.dirname(outputPath);
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }

        console.log(`Downloading ${fileName} from B2...`);

        // ✅ FIX: Use responseType: 'arraybuffer' to get proper binary data
        const response = await b2.downloadFileByName({
            bucketName: BUCKET_NAME,
            fileName: fileName,
            responseType: 'arraybuffer', // ✅ Important for binary files
            onDownloadProgress: (event) => {
                const percent = Math.round((event.loaded / event.total) * 100);
                console.log(`Download Progress: ${percent}% (${event.loaded}/${event.total} bytes)`);
                if (onProgress) onProgress(percent, event.loaded, event.total);
            }
        });

        // ✅ FIX: Properly save binary data
        const data = response.data;

        // Check if data is Buffer, if not convert it
        let fileData;
        if (Buffer.isBuffer(data)) {
            fileData = data;
        } else if (data instanceof ArrayBuffer) {
            fileData = Buffer.from(data);
        } else {
            fileData = Buffer.from(JSON.stringify(data), 'utf8');
        }

        // ✅ Save file with proper binary format
        fs.writeFileSync(outputPath, fileData);
        console.log(`✅ File downloaded successfully: ${outputPath}`);
        console.log(`📊 File size: ${fileData.length} bytes`);

        // Verify file was written correctly
        const stats = fs.statSync(outputPath);
        console.log(`📁 Saved file size: ${stats.size} bytes`);

        return videoId;

    } catch (error) {
        console.error('❌ Download failed:', error);
        throw error;
    }
}

export default DownloadFromB2;