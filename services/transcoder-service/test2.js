import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';
import dotenv from "dotenv";
dotenv.config({ path: '.env.development' });

console.log("process.env.B2_KEY_ID", process.env.B2_KEY_ID)

class B2S3Uploader {
    constructor(bucketName) {
        this.s3 = new S3Client({
            endpoint: process.env.B2_ENDPOINT,
            region: process.env.B2_REGION,
            credentials: {
                accessKeyId: process.env.B2_KEY_ID,
                secretAccessKey: process.env.B2_APPLICATION_KEY
            }
        });
        this.bucketName = bucketName;
    }

    async uploadHLSFolder(localPath, remotePrefix = '') {
        const files = await this.getAllFiles(localPath);

        // Upload all files in parallel - NO need for individual upload URLs!
        const uploadPromises = files.map(filePath =>
            this.uploadFile(filePath, localPath, remotePrefix)
        );

        const results = await Promise.allSettled(uploadPromises);

        const successful = results.filter(r => r.status === 'fulfilled').length;
        console.log(`✅ Uploaded ${successful}/${files.length} files`);
    }

    async uploadFile(localFilePath, rootPath, remotePrefix) {
        const relativePath = path.relative(rootPath, localFilePath);
        const remoteKey = path.join(remotePrefix, relativePath).replace(/\\/g, '/');

        const fileBuffer = await readFile(localFilePath);
        const contentType = this.getContentType(localFilePath);

        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: remoteKey,
            Body: fileBuffer,
            ContentType: contentType,
            // Optional: Add cache headers for HLS files
            CacheControl: 'max-age=3600'
        });

        await this.s3.send(command);
        console.log(`✅ Uploaded: ${remoteKey}`);
    }

    getContentType(filePath) {
        if (filePath.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
        if (filePath.endsWith('.ts')) return 'video/mp2t';
        return 'application/octet-stream';
    }

    async getAllFiles(dirPath) {
        const entries = await readdir(dirPath, { withFileTypes: true });
        const files = [];

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                const subFiles = await this.getAllFiles(fullPath);
                files.push(...subFiles);
            } else {
                files.push(fullPath);
            }
        }
        return files;
    }
}

// Usage
const uploader = new B2S3Uploader('stream-m3u8');
await uploader.uploadHLSFolder('./hello'); // Local folder containing HLS files