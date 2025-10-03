import axios from "axios";
import B2 from "backblaze-b2";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: '.env.development' });

const b2 = new B2({
    applicationKeyId: process.env.B2_KEY_ID,
    applicationKey: process.env.B2_APPLICATION_KEY
});

const downloadFile = async () => {
    try {
        await b2.authorize();

        const bucketName = 'stream-m3u8';
        const fileName = 'uploads/Big_Buck_Bunny_1080_10s_5MB.mp4';
        const outputPath = path.join(process.cwd(), 'downloads', path.basename(fileName));

        // Ensure downloads directory exists
        const downloadsDir = path.dirname(outputPath);
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }

        console.log(`Downloading ${fileName}...`);

        const response = await b2.downloadFileByName({
            bucketName: bucketName,
            fileName: fileName,
            onDownloadProgress: (event) => {
                const percent = Math.round((event.loaded / event.total) * 100);
                console.log(`Download Progress: ${percent}% (${event.loaded}/${event.total} bytes)`);
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
};

downloadFile().then(() => {
    console.log('Single file download complete.');
}).catch(console.error);
