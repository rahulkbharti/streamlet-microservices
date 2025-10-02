// Import necessary modules
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

// --- Configuration ---
// Replace with your actual Backblaze B2 credentials and endpoint
const b2Credentials = {
    endpoint: "https://s3.us-east-005.backblazeb2.com", // Find this in your B2 App Keys page
    region: "us-east-005",                             // The region part of your endpoint
    credentials: {
        accessKeyId: "805db96faa6b",                 // Your B2 Key ID
        secretAccessKey: "005b1e3b4eaa7866010d624445fffaa5cfd5bcf80c",    // Your B2 Application Key
    },
};

// Create an S3 client configured for B2
const s3 = new S3Client(b2Credentials);

// --- File Upload Function ---
async function uploadFile(bucketName, filePath) {
    try {
        const fileStream = fs.createReadStream(filePath);
        const fileName = path.basename(filePath);

        console.log(`Uploading ${fileName} to bucket ${bucketName}...`);

        // Prepare the upload parameters
        const params = {
            Bucket: bucketName,      // The name of your B2 bucket
            Key: fileName,           // The name you want the file to have in B2
            Body: fileStream,        // The file content
        };

        // Create and send the command to upload the file
        const command = new PutObjectCommand(params);
        const data = await s3.send(command);

        console.log("✅ Success! File uploaded.", data);
        // The public URL for the file would be:
        // https://<your-bucket-name>.<your-endpoint>/<file-name>
        // e.g., https://my-awesome-bucket.s3.us-west-004.backblazeb2.com/my-image.jpg
        return data;
    } catch (err) {
        console.error("❌ Error uploading file:", err);
    }
}

// --- Usage ---
const myBucket = "stream-m3u8"; // Replace with your bucket name
const myFile = "./hello.txt"; // Replace with the path to the file you want to upload

uploadFile(myBucket, myFile);