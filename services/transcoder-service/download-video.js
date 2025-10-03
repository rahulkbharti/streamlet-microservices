import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';

dotenv.config({
    path: `.env.${process.env.NODE_ENV || "development"}`
})
// Configure the S3 Client for Backblaze B2 from environment variables
const s3Client = new S3Client({
    endpoint: process.env.B2_ENDPOINT,
    region: process.env.B2_REGION,
    credentials: {
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_APPLICATION_KEY,
    },
});

/**
 * Downloads a file from a B2 bucket to a local temporary path.
 * @returns {Promise<string>} A promise that resolves with the local path of the downloaded file.
 */
export async function downloadFile(bucket, key) {
    console.log(`[STORAGE] Downloading ${key} from bucket ${bucket}`);
    const localTempPath = path.join(os.tmpdir(), key);
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });

    const response = await s3Client.send(command);
    const writeStream = fs.createWriteStream(localTempPath);
    response.Body.pipe(writeStream);

    return new Promise((resolve, reject) => {
        writeStream.on('finish', () => resolve(localTempPath));
        writeStream.on('error', reject);
    });
}

/**
 * Uploads a local file to a B2 bucket.
 * @returns {Promise<object>} A promise that resolves with the S3 upload result.
 */
export async function uploadFile(bucket, key, localFilePath, contentType) {
    console.log(`[STORAGE] Uploading ${localFilePath} to ${bucket}/${key}`);
    const readStream = fs.createReadStream(localFilePath);
    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: readStream,
        ContentType: contentType,
    });
    return s3Client.send(command);
}


downloadFile('streamlet-m3u8', "5491e6f0ea9a72b9").then(e => {
    console.log(e);
});