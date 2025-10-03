import fs from "fs";
import path from "path";
import crypto from "crypto";
import B2 from "backblaze-b2";
import dotenv from "dotenv";

dotenv.config({ path: '.env.development' });


const b2 = new B2({
    applicationKeyId: process.env.B2_KEY_ID,
    applicationKey: process.env.B2_APPLICATION_KEY
});

const BUCKET_NAME = "stream-m3u8";
const STREAMS_DIR = "./streams";
const B2_BASE_FOLDER = "streams"; // This will create "streams/" folder on Backblaze

// 🔹 Initialize and get bucket ID
const getBucketId = async () => {
    await b2.authorize();
    const { data } = await b2.getBucket({ bucketName: BUCKET_NAME });
    return data.buckets[0].bucketId;
};

// 🔹 Detect MIME type
const getMime = (filePath) => {
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
};

// 🔹 Upload single file with progress
const uploadFile = async (bucketId, filePath, b2FileName) => {
    try {
        const data = fs.readFileSync(filePath);
        const sha1 = crypto.createHash("sha1").update(data).digest("hex");
        const fileSize = data.length;

        const { data: uploadData } = await b2.getUploadUrl({ bucketId });

        console.log(`📤 Uploading: ${b2FileName}`);

        const response = await b2.uploadFile({
            uploadUrl: uploadData.uploadUrl,
            uploadAuthToken: uploadData.authorizationToken,
            fileName: b2FileName,
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
};

// 🔹 Get all files recursively from a directory
const getAllFiles = (dirPath, arrayOfFiles = []) => {
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
};

// 🔹 Upload specific video folder by ID
const uploadVideoFolder = async (videoId, bucketId, onProgress) => {
    const videoFolderPath = path.join(STREAMS_DIR, videoId);

    if (!fs.existsSync(videoFolderPath)) {
        throw new Error(`Video folder not found: ${videoFolderPath}`);
    }

    console.log(`📁 Uploading video: ${videoId}`);
    console.log(`📁 Target folder on Backblaze: ${B2_BASE_FOLDER}/${videoId}/`);

    const files = getAllFiles(videoFolderPath);
    let uploadedCount = 0;
    let totalSize = 0;

    for (const file of files) {
        const relativeToVideoFolder = path.relative(videoFolderPath, file);
        const b2FilePath = path.join(B2_BASE_FOLDER, videoId, relativeToVideoFolder).replace(/\\/g, '/');

        await uploadFile(bucketId, file, b2FilePath);
        uploadedCount++;
        totalSize += fs.statSync(file).size;
        const videoFolderSize = files.reduce((acc, file) => acc + fs.statSync(file).size, 0);
        if (onProgress) {
            onProgress({
                videoId,
                uploadedCount,
                totalCount: files.length,
                uploadedSize: totalSize,
                totalSize: videoFolderSize
            });
        }
    }


    for (const file of files) {
        const relativeToVideoFolder = path.relative(videoFolderPath, file);
        const b2FilePath = path.join(B2_BASE_FOLDER, videoId, relativeToVideoFolder).replace(/\\/g, '/');

        await uploadFile(bucketId, file, b2FilePath);
        uploadedCount++;
        totalSize += fs.statSync(file).size;
    }

    console.log(`🎉 Upload complete for ${videoId}`);
    console.log(`📊 Files uploaded: ${uploadedCount}`);
    console.log(`💾 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    return { uploadedCount, totalSize };
};

// 🔹 List all available video IDs
const listVideoIds = () => {
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
};

// 🔹 Delete video folder after upload
const deleteVideoFolder = (videoId) => {
    const videoFolderPath = path.join(STREAMS_DIR, videoId);
    if (fs.existsSync(videoFolderPath)) {
        fs.rmSync(videoFolderPath, { recursive: true, force: true });
        console.log(`🗑️ Deleted local folder: ${videoId}`);
    }
};

// 🔹 Check if file exists on Backblaze
const checkFileOnBackblaze = async (fileName) => {
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
};

// 🔹 Main function to upload specific video
const UploadOnB2 = async (videoId, deleteAfterUpload = false, onProgress) => {
    try {
        console.log(`🚀 Starting upload for video: ${videoId}`);

        const bucketId = await getBucketId();
        const result = await uploadVideoFolder(videoId, bucketId, onProgress);

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
};

export default UploadOnB2;

