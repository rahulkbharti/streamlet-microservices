
import {
    StorageSharedKeyCredential,
    BlobServiceClient,
    generateBlobSASQueryParameters,
    BlobSASPermissions,
} from "@azure/storage-blob";

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;

export async function generateUploadSasUrl(blobName, containerName = "uploads") {
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

    const blobServiceClient = new BlobServiceClient(
        `https://${accountName}.blob.core.windows.net`,
        sharedKeyCredential
    );

    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);

    // Define the permissions and expiry for the SAS token
    const sasOptions = {
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse("racw"), // "r"ead, "a"dd, "c"reate, "w"rite
        startsOn: new Date(), // Token is valid from now
        expiresOn: new Date(new Date().valueOf() + 3600 * 1000), // Token is valid for 1 hour
    };

    // Generate the SAS token
    const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();

    // The full URL is the blob's URL plus the SAS token
    const sasUrl = `${blobClient.url}?${sasToken}`;

    console.log(`Successfully generated SAS URL for blob: ${blobName}`);
    return sasUrl;
}

// async function main() {
//     const uploadContainer = "uploads"; // The container you created for uploads
//     const fileNameToUpload = `video-${Date.now()}.mp4`; // A unique name for the file

//     try {
//         const uploadUrl = await generateUploadSasUrl(fileNameToUpload, uploadContainer,);
//         console.log("\n------------------------------------------------------------------");
//         console.log("Your temporary upload URL is:");
//         console.log(uploadUrl);
//         console.log("------------------------------------------------------------------");
//         console.log("\nUse this URL with a tool like Postman (as a PUT request with the file in the body) or with a client-side JavaScript uploader to upload your file.");
//     } catch (error) {
//         console.error("Failed to generate SAS URL:", error.message);
//     }
// }

// main();
