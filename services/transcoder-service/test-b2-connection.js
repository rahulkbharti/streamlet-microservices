import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

// Apne .env file ka naam yahan daalo agar alag hai
dotenv.config({ path: '.env.development' });

console.log('--- Backblaze Connection Test ---');
console.log('B2 Endpoint:', process.env.B2_ENDPOINT);
console.log('B2 Region:', process.env.B2_REGION);
console.log('B2 Key ID:', process.env.B2_KEY_ID ? 'Loaded' : 'NOT FOUND');

// Same S3Client configuration
const s3 = new S3Client({
    region: process.env.B2_REGION,
    endpoint: process.env.B2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_APPLICATION_KEY,
    },
});

const runTest = async () => {
    try {
        console.log('\n[1] Sending command to list buckets...');

        // Sirf bucket list karne ka command bhej rahe hain
        const command = new ListBucketsCommand({});
        const response = await s3.send(command);

        console.log('\n[2] SUCCESS! ✅ Connection is working.');
        console.log('Buckets found in your account:');
        response.Buckets.forEach(bucket => {
            console.log(`  - ${bucket.Name}`);
        });

    } catch (error) {
        console.error('\n[2] FAILED! ❌ Connection failed.');
        console.error('Error Details:', error);
    }
};

runTest();