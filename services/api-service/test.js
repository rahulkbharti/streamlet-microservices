import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

// --- Configuration ---
// PASTE YOUR NEW KEYS AND DETAILS HERE
const B2_ENDPOINT = "https://s3.us-east-005.backblazeb2.com";
const B2_REGION = "us-east-005";
const B2_KEY_ID = "805db96faa6b";
const B2_SECRET_ACCESS_KEY = "K005/OX68OMDuWelF+FAkr83gtZ5yTs";
// --- End Configuration ---


const s3 = new S3Client({
    endpoint: B2_ENDPOINT,
    region: B2_REGION,
    credentials: {
        accessKeyId: B2_KEY_ID,
        secretAccessKey: B2_SECRET_ACCESS_KEY,
    },
});

async function testConnection() {
    console.log("Attempting to connect to Backblaze B2...");
    try {
        const command = new ListBucketsCommand({});
        const response = await s3.send(command);

        console.log("\n✅ SUCCESS! Connection to Backblaze is working correctly.");
        console.log("Your buckets are:");
        response.Buckets.forEach(bucket => console.log(` - ${bucket.Name}`));

    } catch (error) {
        console.error("\n❌ ERROR! The connection failed.");
        console.error("This means there is still a problem with your Keys, Region, or Endpoint.");
        console.error("\nFull error details:", error);
    }
}

testConnection();