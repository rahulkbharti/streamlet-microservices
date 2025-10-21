import dotenv from "dotenv";
import {
    BlobServiceClient,
    StorageSharedKeyCredential,
    BlobSASPermissions,
    generateBlobSASQueryParameters,
} from "@azure/storage-blob";
import { redisConnection } from "../config/redis.config.js";
dotenv.config({ path: `./${process.env.ENV_FILE}` });

if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    console.warn(
        "Missing AZURE_STORAGE_CONNECTION_STRING. Check your .env file."
    );
}

const AZURE_STORAGE_CONNECTION_STRING =
    process.env.AZURE_STORAGE_CONNECTION_STRING;
const AZURE_CONTAINER_NAME = process.env.AZURE_CONTAINER_NAME;
const SAS_CACHE_KEY = process.env.SAS_CACHE_KEY;
const SAS_EXPIRY_SECONDS = process.env.SAS_EXPIRY_SECONDS;

let blobServiceClient;
let containerClient;
let sharedKeyCredential;
let azureBlobBaseUrl;

try {
    blobServiceClient = BlobServiceClient.fromConnectionString(
        AZURE_STORAGE_CONNECTION_STRING
    );
    containerClient = blobServiceClient.getContainerClient(AZURE_CONTAINER_NAME);

    // Manually parse the connection string to get account name and key
    const credentials = AZURE_STORAGE_CONNECTION_STRING.split(";").reduce(
        (acc, curr) => {
            const [key, ...valueParts] = curr.split("=");
            if (key && valueParts.length > 0) {
                acc[key] = valueParts.join("=");
            }
            return acc;
        },
        {}
    );

    const accountName = credentials.AccountName;
    const accountKey = credentials.AccountKey;

    if (!accountName || !accountKey) {
        throw new Error(
            "AccountName or AccountKey not found in connection string."
        );
    }

    // Create the credential object using the name and key
    sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    azureBlobBaseUrl = `https://${sharedKeyCredential.accountName}.blob.core.windows.net`;
} catch (e) {
    console.error("Failed to initialize Azure clients:", e.message);
    process.exit(1);
}

export const getContainerSASToken = async () => {
    const cachedToken = await redisConnection.get(SAS_CACHE_KEY);
    if (cachedToken) return cachedToken;

    try {
        const expiryDate = new Date();
        expiryDate.setSeconds(expiryDate.getSeconds() + SAS_EXPIRY_SECONDS);

        // Using generateBlobSASQueryParameters without a blobName creates a container-level token
        const sasOptions = {
            containerName: AZURE_CONTAINER_NAME,
            permissions: BlobSASPermissions.parse("r"), // "r" for Read-only
            startsOn: new Date(),
            expiresOn: expiryDate,
        };

        const sasToken = generateBlobSASQueryParameters(
            sasOptions,
            sharedKeyCredential
        ).toString();

        await redisConnection.set(
            SAS_CACHE_KEY,
            sasToken,
            "EX",
            SAS_EXPIRY_SECONDS - 10
        );
        return sasToken;
    } catch (e) {
        console.error("Error generating Azure SAS token:", e);
        return null;
    }
};

export const getBlobUrl = (path) => {
    return `${azureBlobBaseUrl}/${AZURE_CONTAINER_NAME}/${path}`;
};
