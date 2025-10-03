import B2 from "backblaze-b2";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: '.env.development' });
const BUCKET_NAME = 'stream-m3u8';
const b2 = new B2({
    applicationKeyId: process.env.B2_KEY_ID,
    applicationKey: process.env.B2_APPLICATION_KEY
});


const DownloadFromB2 = async ({ key, onProgress }) => {
    if (!key) throw new Error('Key is required for download.');
    try {
        await b2.authorize();
        const fileName = key.split('/').pop();
        const outputPath = path.join(process.cwd(), 'downloads', fileName);

        // Ensure downloads directory exists
        const downloadsDir = path.dirname(outputPath);
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }

        console.log(`Downloading ${fileName}...`);

        const response = await b2.downloadFileByName({
            bucketName: BUCKET_NAME,
            fileName: fileName,
            onDownloadProgress: (event) => {
                const percent = Math.round((event.loaded / event.total) * 100);
                process.stdout.write(`Download Progress: ${percent}% (${event.loaded}/${event.total} bytes)`);
                if (onProgress) onProgress(percent, event.loaded, event.total);
            }
        });

        // Save file to disk
        fs.writeFileSync(outputPath, response.data);
        console.log(`✅ File downloaded successfully: ${outputPath}`);

        return outputPath;

    } catch (error) {
        console.error('❌ Download failed:', error);
        throw error;
    }
}

export default DownloadFromB2;