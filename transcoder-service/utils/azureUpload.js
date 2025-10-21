import { BlobServiceClient } from "@azure/storage-blob";
import { promises as fs, createReadStream } from "fs";
import path from "path";
import dotenv from "dotenv";
import cliProgress from "cli-progress";

dotenv.config({ path: `./${process.env.ENV_FILE}` });

// --- START: Module Configuration ---
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = process.env.AZURE_STREAM_CONTAINER_NAME;

const LOCAL_BASE_FOLDER_PATH = path.join(process.cwd(), "streams");
// --- END: Module Configuration ---

if (!AZURE_STORAGE_CONNECTION_STRING) {
    throw new Error(
        "AZURE_STORAGE_CONNECTION_STRING is not set in your .env file."
    );
}
const blobServiceClient = BlobServiceClient.fromConnectionString(
    AZURE_STORAGE_CONNECTION_STRING
);
const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

async function findFilesRecursively(dirPath, rootPath, fileList = []) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            await findFilesRecursively(fullPath, rootPath, fileList);
        } else if (entry.isFile()) {
            const stats = await fs.stat(fullPath);
            const relativePath = path.relative(rootPath, fullPath);
            const blobName = relativePath.replace(/\\/g, "/");
            fileList.push({ fullPath, blobName, size: stats.size });
        }
    }
    return fileList;
}

export async function UploadStream(
    videoIDFolder,
    onProgress,
    concurrency = 5
) {
    await containerClient.createIfNotExists();
    const fullFolderPath = path.join(LOCAL_BASE_FOLDER_PATH, videoIDFolder);

    try {
        await fs.access(fullFolderPath);
    } catch (err) {
        throw new Error(`Local folder does not exist: ${fullFolderPath}`);
    }

    console.log(
        `Checking for existing files in container: ${CONTAINER_NAME}/${videoIDFolder}...`
    );
    const existingAzureBlobs = new Set();
    const blobPrefix = videoIDFolder + "/";
    for await (const blob of containerClient.listBlobsFlat({
        prefix: blobPrefix,
    })) {
        existingAzureBlobs.add(blob.name);
    }
    console.log(`Found ${existingAzureBlobs.size} files already in Azure.`);

    console.log(`Scanning local folder: ${fullFolderPath}...`);
    const allLocalFiles = await findFilesRecursively(
        fullFolderPath,
        LOCAL_BASE_FOLDER_PATH
    );
    const totalLocalFiles = allLocalFiles.length;
    if (totalLocalFiles === 0) {
        console.warn("Warning: No local files found. Nothing to upload.");
        return;
    }

    const filesToUpload = allLocalFiles.filter(
        (file) => !existingAzureBlobs.has(file.blobName)
    );

    const totalFiles = filesToUpload.length; // Total files for this run
    if (totalFiles === 0) {
        console.log("\nAll files are already in sync. Nothing to upload.");
        return;
    }

    const totalSize = filesToUpload.reduce((acc, file) => acc + file.size, 0);
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

    console.log(`Local files: ${totalLocalFiles}. Existing: ${existingAzureBlobs.size}.`);
    console.log(`Queueing ${totalFiles} new/missing files for upload (Total Size: ${totalSizeMB} MB).`);
    console.log(`Starting ${concurrency} concurrent upload workers...\n`);

    // --- NEW: Setup the Multi-Progress Bar ---
    const multibar = new cliProgress.MultiBar({
        format: ' {bar} | {percent}% | {size}MB | {filename}',
        clearOnComplete: false,
        hideCursor: true,
    }, cliProgress.Presets.rect);

    let uploadedFiles = 0;
    let uploadedSize = 0;

    // --- NEW: Updated worker function ---
    const worker = async () => {
        while (filesToUpload.length > 0) {
            const file = filesToUpload.shift();
            if (!file) continue;

            // 1. Create a new bar for this specific file
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            const bar = multibar.create(file.size, 0, {
                filename: file.blobName,
                size: sizeMB
            });

            try {
                const blockBlobClient = containerClient.getBlockBlobClient(file.blobName);
                const stream = createReadStream(file.fullPath);

                // 2. Use uploadStream (NOT uploadFile)
                await blockBlobClient.uploadStream(stream, file.size, concurrency, {
                    // 3. Update this file's bar on its progress
                    onProgress: (progress) => {
                        bar.update(progress.loadedBytes);
                    }
                });

                // 4. Mark the bar as complete
                bar.stop();

                // --- OLD: Update overall progress ---
                uploadedFiles++;
                uploadedSize += file.size;
                const uploadedSizeMB = (uploadedSize / (1024 * 1024)).toFixed(2);
                const percent = Math.round((uploadedFiles / totalFiles) * 100);

                if (onProgress && typeof onProgress === "function") {
                    onProgress({
                        totalFiles: totalFiles,
                        uploadedFiles: uploadedFiles,
                        totalSizeMB: parseFloat(totalSizeMB),
                        uploadedSizeMB: parseFloat(uploadedSizeMB),
                        percent,
                        currentFile: file.blobName,
                    });
                }
                // --- End overall progress ---

            } catch (err) {
                bar.stop(); // Stop the bar on failure too
                multibar.stop(); // Stop all bars
                console.error(`\n[Failed Upload]: ${file.blobName} - ${err.message}`);
                throw new Error(`Upload failed for ${file.blobName}`);
            }
        }
    };

    const workerPromises = [];
    for (let i = 0; i < concurrency; i++) {
        workerPromises.push(worker());
    }
    await Promise.all(workerPromises);

    // --- NEW: Stop the multibar container ---
    multibar.stop();
    console.log("\nFolder upload complete!\n");
}