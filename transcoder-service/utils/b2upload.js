import fs from "fs";
import path from "path";
import crypto from "crypto";
import B2 from "backblaze-b2";
import dotenv from "dotenv";

dotenv.config({ path: ".env.development" });

const b2 = new B2({
    applicationKeyId: process.env.B2_KEY_ID,
    applicationKey: process.env.B2_APPLICATION_KEY,
});

const CONFIG = {
    BUCKET_NAME: "stream-m3u8",
    STREAMS_DIR: "./streams",
    B2_BASE_FOLDER: "streams",
};

// 🔹 Authorize and fetch bucket ID
const getBucketId = async () => {
    await b2.authorize();
    const { data } = await b2.getBucket({ bucketName: CONFIG.BUCKET_NAME });
    return data.buckets[0].bucketId;
};

// 🔹 Detect MIME type
const getMime = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
        ".m3u8": "application/vnd.apple.mpegurl",
        ".ts": "video/mp2t",
        ".vtt": "text/vtt",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".mp4": "video/mp4",
    };
    return mimeMap[ext] || "application/octet-stream";
};

// 🔹 Upload one file
const uploadFile = async (bucketId, filePath, destinationPath) => {
    const data = fs.readFileSync(filePath);
    const hash = crypto.createHash("sha1").update(data).digest("hex");
    const fileSize = data.length;

    const { data: uploadData } = await b2.getUploadUrl({ bucketId });

    console.log(`📤 Uploading: ${destinationPath}`);
    await b2.uploadFile({
        uploadUrl: uploadData.uploadUrl,
        uploadAuthToken: uploadData.authorizationToken,
        fileName: destinationPath,
        data,
        hash,
        mime: getMime(filePath),
    });

    console.log(`✅ Uploaded: ${destinationPath} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
};

// ✅ Fixed version — recursive file walker without duplicates
const getAllFiles = (dirPath) => {
    const result = [];

    const walk = (dir) => {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path.join(dir, file.name);
            if (file.isDirectory()) walk(fullPath);
            else result.push(fullPath);
        }
    };

    walk(dirPath);
    // remove duplicates just in case
    return [...new Set(result)];
};

// 🔹 Upload all files for a video folder
const uploadVideoFolder = async (videoId, bucketId, onProgress) => {
    const folderPath = path.join(CONFIG.STREAMS_DIR, videoId);
    if (!fs.existsSync(folderPath)) throw new Error(`Video folder not found: ${folderPath}`);

    console.log(`📁 Uploading video: ${videoId}`);
    console.log(`📁 Target folder on Backblaze: ${CONFIG.B2_BASE_FOLDER}/${videoId}/`);

    const files = getAllFiles(folderPath);
    console.log(`📦 Found ${files.length} files to upload.`);

    const totalSize = files.reduce((acc, f) => acc + fs.statSync(f).size, 0);
    let uploadedCount = 0;
    let uploadedSize = 0;

    for (const file of files) {
        const relativePath = path.relative(folderPath, file);
        const destinationPath = path
            .join(CONFIG.B2_BASE_FOLDER, videoId, relativePath)
            .replace(/\\/g, "/");

        await uploadFile(bucketId, file, destinationPath);

        uploadedCount++;
        uploadedSize += fs.statSync(file).size;

        onProgress?.({
            videoId,
            uploadedCount,
            totalCount: files.length,
            uploadedSize,
            totalSize,
        });
    }

    console.log(`🎉 Upload complete for ${videoId}`);
    console.log(`📊 Files uploaded: ${uploadedCount}`);
    console.log(`💾 Total size: ${(uploadedSize / 1024 / 1024).toFixed(2)} MB`);
    return { uploadedCount, totalSize: uploadedSize };
};

// 🔹 Main upload handler
const UploadOnB2 = async (videoId, deleteAfterUpload = false, onProgress) => {
    try {
        console.log(`🚀 Starting upload for video: ${videoId}`);
        const bucketId = await getBucketId();

        // prevent accidental double execution
        if (global.__isUploadingB2) {
            console.log("⚠️ Upload already in progress. Skipping duplicate call.");
            return;
        }
        global.__isUploadingB2 = true;

        const result = await uploadVideoFolder(videoId, bucketId, onProgress);

        const masterPath = `${CONFIG.B2_BASE_FOLDER}/streams${videoId}/master.m3u8`;
        try {
            await b2.authorize();
            await b2.getFileInfoByName({
                bucketName: CONFIG.BUCKET_NAME,
                fileName: masterPath,
            });
            console.log(`✅ Verified: ${masterPath} exists on Backblaze`);
        } catch {
            console.warn(`⚠️ Could not verify master.m3u8 existence on Backblaze`);
        }

        if (deleteAfterUpload) {
            const folderPath = path.join(CONFIG.STREAMS_DIR, videoId);
            fs.rmSync(folderPath, { recursive: true, force: true });
            console.log(`🗑️ Deleted local folder: ${videoId}`);
        }

        console.log(`✅ Successfully uploaded ${videoId} to Backblaze B2`);
        console.log(`📁 Backblaze Path: ${CONFIG.B2_BASE_FOLDER}/${videoId}/`);

        global.__isUploadingB2 = false;
        return result;
    } catch (err) {
        global.__isUploadingB2 = false;
        console.error(`❌ Failed to upload ${videoId}: ${err.message}`);
        throw err;
    }
};

export default UploadOnB2;
