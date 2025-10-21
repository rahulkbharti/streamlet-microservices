import { BlobServiceClient } from "@azure/storage-blob";
import * as fs from "fs";
import { promises as fsPromises } from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: `./${process.env.ENV_FILE}` });

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = process.env.AZURE_UPLOAD_CONTAINER_NAME;

const LOCAL_DOWNLOAD_PATH = path.join(process.cwd(), "downloads");

if (!AZURE_STORAGE_CONNECTION_STRING) {
    throw new Error(
        "AZURE_STORAGE_CONNECTION_STRING is not set in your .env file."
    );
}

const blobServiceClient = BlobServiceClient.fromConnectionString(
    AZURE_STORAGE_CONNECTION_STRING
);
const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

export async function downloadVideo(blobName, localBlobName, onProgress) {
    const localFileName = path.basename(localBlobName);
    const localFilePath = path.join(LOCAL_DOWNLOAD_PATH, localFileName);

    await fsPromises.mkdir(LOCAL_DOWNLOAD_PATH, { recursive: true });

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const properties = await blockBlobClient.getProperties();
    const totalBytes = properties.contentLength;

    console.log(`Downloading to: ${localFilePath}`);

    if (!totalBytes || totalBytes === 0) {
        console.log("Blob is 0 bytes. Creating empty local file.");
        await fsPromises.writeFile(localFilePath, "");
        console.log("Download complete (empty file).");
        return localFilePath; // Return the path
    }

    console.log(`Total size: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB\n`);


    const response = await blockBlobClient.download(0, undefined, {
        onProgress: (progress) => {
            const loadedBytes = progress.loadedBytes;
            const percent = Math.round((loadedBytes / totalBytes) * 100);
            const progressBarLength = 50;
            const filledLength = Math.round((progressBarLength * percent) / 100);
            const emptyLength = progressBarLength - filledLength;
            const progressBar = "█".repeat(filledLength) + " ".repeat(emptyLength);

            process.stdout.write(
                `\rDownloading: [${progressBar}] ${percent}% (${loadedBytes}/${totalBytes} bytes)`
            );

            if (onProgress && typeof onProgress === "function") {
                onProgress({ loadedBytes, totalBytes, percent });
            }
        },
    });

    return new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(localFilePath);

        if (response.readableStreamBody) {
            response.readableStreamBody.pipe(fileStream);
            fileStream.on("finish", () => {
                process.stdout.write("\n\nDownload complete!\n");
                resolve(localFilePath); // Resolve the promise with the file path
            });
            fileStream.on("error", reject);
            response.readableStreamBody.on("error", reject);
        } else {
            reject(new Error("Readable stream body was undefined."));
        }
    });
}