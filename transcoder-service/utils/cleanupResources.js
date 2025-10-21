import { BlobServiceClient } from "@azure/storage-blob";
import { promises as fs } from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: `./${process.env.ENV_FILE}` });

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const UPLOADS_CONTAINER_NAME = "uploads"; // Container for the original .mp4
const LOCAL_STREAMS_PATH = path.join(process.cwd(), "streams"); // Base local dir for streams
const LOCAL_DOWNLOAD_PATH = path.join(process.cwd(), "downloads"); // Base local dir for downloads

if (!AZURE_STORAGE_CONNECTION_STRING) {
    throw new Error(
        "AZURE_STORAGE_CONNECTION_STRING is not set in your .env file."
    );
}

const blobServiceClient = BlobServiceClient.fromConnectionString(
    AZURE_STORAGE_CONNECTION_STRING
);
const uploadsContainerClient = blobServiceClient.getContainerClient(
    UPLOADS_CONTAINER_NAME
);


export async function cleanupResources(
    originalMp4BlobName,
    localDownloadFileName,
    localStreamFolder
) {
    console.log("\n--- Starting Cleanup ---");
    // Step 1 : Deleting Original Azure Blob
    try {
        if (originalMp4BlobName) {
            console.log(`Deleting original blob: ${UPLOADS_CONTAINER_NAME}/${originalMp4BlobName}...`);
            const blobToDeleteClient = uploadsContainerClient.getBlockBlobClient(
                originalMp4BlobName
            );
            await blobToDeleteClient.deleteIfExists();
            console.log("Azure blob deleted. ✅");
        }
    } catch (err) {
        console.error(`Failed to delete Azure blob: ${err.message}`);
        console.warn("Azure blob deletion failed, continuing cleanup...");
    }
    // Step 2 : Deleting Local Download File
    try {
        if (localDownloadFileName) {
            const fullDownloadPath = path.join(LOCAL_DOWNLOAD_PATH, localDownloadFileName);
            console.log(`Deleting local download: ${fullDownloadPath}...`);
            // Check if file exists before trying to delete
            await fs.access(fullDownloadPath); // Throws error if it doesn't exist
            await fs.rm(fullDownloadPath);
            console.log("Local download file deleted. ✅");
        }
    } catch (err) {
        // If fs.access fails, it's 'ENOENT' (file not found), which is fine.
        if (err.code !== 'ENOENT') {
            console.error(`Failed to delete local download file: ${err.message}`);
            console.warn("Local download deletion failed, continuing cleanup...");
        } else {
            console.log("Local download file already deleted or not found, skipping.");
        }
    }

    // Step 3 : Deleting Local Stream Folder
    try {
        if (localStreamFolder) {
            const fullStreamPath = path.join(LOCAL_STREAMS_PATH, localStreamFolder);
            console.log(`Deleting local stream folder: ${fullStreamPath}...`);
            await fs.rm(fullStreamPath, { recursive: true, force: true });
            console.log("Local stream folder deleted. ✅");
        }
    } catch (err) {
        console.error(`Failed to delete local stream folder: ${err.message}`);
        console.warn("Local stream folder deletion failed.");
    }

    console.log("Cleanup complete. 🎉");
}