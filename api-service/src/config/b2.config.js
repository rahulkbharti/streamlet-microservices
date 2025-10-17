// src/config/b2.config.js
import { S3Client } from '@aws-sdk/client-s3';
import dotenv from "dotenv";
dotenv.config({ path: `./${process.env.ENV_FILE}` });
console.log("B2 Configuration:", process.env.B2_REGION, process.env.B2_ENDPOINT);

const s3Client = new S3Client({
    region: process.env.B2_REGION,
    endpoint: process.env.B2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_APPLICATION_KEY,
    },
});

export { s3Client };