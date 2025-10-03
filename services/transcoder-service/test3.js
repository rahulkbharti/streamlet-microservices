import fs from "fs";
import path from "path";
import crypto from "crypto";
import B2 from "backblaze-b2";
import dotenv from "dotenv";

dotenv.config({ path: '.env.development' });

console.log("process.env.B2_KEY_ID", process.env.B2_KEY_ID);

const b2 = new B2({
    applicationKeyId: process.env.B2_KEY_ID,
    applicationKey: process.env.B2_APPLICATION_KEY
});

const BUCKET_NAME = "stream-m3u8";
const STREAMS_DIR = "./streams";
const B2_BASE_FOLDER = "streams"; // This will create "streams/" folder on Backblaze

// 🔹 Initialize and get bucket ID
export async function getBucketId() {
    await b2.authorize();
    const { data } = await b2.getBucket({ bucketName: BUCKET_NAME });
    return data.buckets[0].bucketId;
}

// 🔹 Detect MIME type
function getMime(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.m3u8': 'application/vnd.apple.mpegurl',
        '.ts': 'video/mp2t',
        '.vtt': 'text/vtt',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.mp4': 'video/mp4'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

// 🔹 Upload single file with progress
export async function uploadFile(bucketId, filePath, b2FileName) {
    try {
        const data = fs.readFileSync(filePath);
        const sha1 = crypto.createHash("sha1").update(data).digest("hex");
        const fileSize = data.length;

        const { data: uploadData } = await b2.getUploadUrl({ bucketId });

        console.log(`📤 Uploading: ${b2FileName}`);

        const response = await b2.uploadFile({
            uploadUrl: uploadData.uploadUrl,
            uploadAuthToken: uploadData.authorizationToken,
            fileName: b2FileName, // This should include the full path like "streams/videoawas/master.m3u8"
            data,
            hash: sha1,
            mime: getMime(filePath),
        });

        console.log(`✅ Uploaded: ${b2FileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
        return response.data;
    } catch (error) {
        console.error(`❌ Failed to upload ${b2FileName}:`, error.message);
        throw error;
    }
}

// 🔹 Get all files recursively from a directory
function getAllFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            getAllFiles(fullPath, arrayOfFiles);
        } else {
            arrayOfFiles.push(fullPath);
        }
    });

    return arrayOfFiles;
}

// 🔹 Upload specific video folder by ID
export async function uploadVideoFolder(videoId, bucketId) {
    const videoFolderPath = path.join(STREAMS_DIR, videoId);

    // Check if video folder exists
    if (!fs.existsSync(videoFolderPath)) {
        throw new Error(`Video folder not found: ${videoFolderPath}`);
    }

    console.log(`📁 Uploading video: ${videoId}`);
    console.log(`📁 Target folder on Backblaze: ${B2_BASE_FOLDER}/${videoId}/`);

    const files = getAllFiles(videoFolderPath);
    let uploadedCount = 0;
    let totalSize = 0;

    for (const file of files) {
        // Get the relative path from the video folder
        const relativeToVideoFolder = path.relative(videoFolderPath, file);

        // Create Backblaze file path: streams/videoId/filename
        const b2FilePath = path.join(B2_BASE_FOLDER, videoId, relativeToVideoFolder).replace(/\\/g, '/');

        await uploadFile(bucketId, file, b2FilePath);
        uploadedCount++;
        totalSize += fs.statSync(file).size;
    }

    console.log(`🎉 Upload complete for ${videoId}`);
    console.log(`📊 Files uploaded: ${uploadedCount}`);
    console.log(`💾 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    return { uploadedCount, totalSize };
}

// 🔹 List all available video IDs
export function listVideoIds() {
    if (!fs.existsSync(STREAMS_DIR)) {
        console.log("❌ Streams directory not found");
        return [];
    }

    const items = fs.readdirSync(STREAMS_DIR);
    const videoIds = items.filter(item => {
        const fullPath = path.join(STREAMS_DIR, item);
        return fs.statSync(fullPath).isDirectory();
    });

    console.log("📁 Available video IDs:");
    videoIds.forEach(id => console.log(`  - ${id}`));

    return videoIds;
}

// 🔹 Delete video folder after upload
function deleteVideoFolder(videoId) {
    const videoFolderPath = path.join(STREAMS_DIR, videoId);
    if (fs.existsSync(videoFolderPath)) {
        fs.rmSync(videoFolderPath, { recursive: true, force: true });
        console.log(`🗑️ Deleted local folder: ${videoId}`);
    }
}

// 🔹 Check if file exists on Backblaze
export async function checkFileOnBackblaze(fileName) {
    try {
        await b2.authorize();
        const response = await b2.getFileInfoByName({
            bucketName: BUCKET_NAME,
            fileName: fileName
        });
        return { exists: true, info: response.data };
    } catch (error) {
        return { exists: false };
    }
}

// 🔹 Main function to upload specific video
export async function uploadVideoById(videoId, deleteAfterUpload = false) {
    try {
        console.log(`🚀 Starting upload for video: ${videoId}`);

        const bucketId = await getBucketId();
        const result = await uploadVideoFolder(videoId, bucketId);

        // Verify upload
        const checkFile = await checkFileOnBackblaze(`streams/${videoId}/master.m3u8`);
        if (checkFile.exists) {
            console.log(`✅ Verified: streams/${videoId}/master.m3u8 exists on Backblaze`);
        }

        if (deleteAfterUpload) {
            deleteVideoFolder(videoId);
        }

        console.log(`✅ Successfully uploaded ${videoId} to Backblaze B2`);
        console.log(`📁 Backblaze Path: ${B2_BASE_FOLDER}/${videoId}/`);
        return result;

    } catch (error) {
        console.error(`❌ Failed to upload ${videoId}:`, error.message);
        throw error;
    }
}

// Usage
(async () => {
    try {
        // List available videos
        const availableVideos = listVideoIds();

        if (availableVideos.length === 0) {
            console.log("No video folders found in streams directory");
            return;
        }

        // Upload specific video
        const videoIdToUpload = "cbdcfb1f494834d8"; // Change this to your actual video ID
        console.log(`\n🎯 Attempting to upload: ${videoIdToUpload}`);

        await uploadVideoById(videoIdToUpload, false); // false = don't delete after upload

        // console.log("\n📋 Final Backblaze structure should be:");
        // console.log(`streams/${videoIdToUpload}/master.m3u8`);
        // console.log(`streams/${videoIdToUpload}/720p/playlist.m3u8`);
        // console.log(`streams/${videoIdToUpload}/720p/segment1.ts`);
        // console.log(`streams/${videoIdToUpload}/thumbnails.vtt`);

    } catch (error) {
        console.error("❌ Main execution failed:", error);
    }
})();