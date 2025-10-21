import processVideo from "./process.js";
import { downloadVideo } from "./utils/azureDownload.js";
import { UploadStream } from "./utils/azureUpload.js";
// import fs from "fs/promises";
// import path from "path";
// import { deleteVideoFile } from "./utils/azureDelete.js";
import { cleanupResources } from "./utils/cleanupResources.js";

const main = async () => {
    const videoId = "cXxnOI7NlTf";
    const key = "1761047909949-Big_Buck_Bunny_1080_10s_1MB.mp4";
    // Step 1 : Download The video file (.mp4) from azure
    console.log(`Downloading file from Azure: ${key}`);
    await downloadVideo(key, `${videoId}.mp4`);
    console.log(`File downloaded to: ./downloads/${videoId}.mp4`);
    // Step 2 : Process the video
    // await processVideo(`./downloads/${videoId}.mp4`);
    // console.log("video is process")
    // // Step 3 : Upload back to Azure
    // console.log(`Uploading video streams to Azure: ${videoId}`);
    // await UploadStream(videoId);
    // console.log("video streams is uploaded to azure")
    S
    //Cleaning Up process
    await cleanupResources(key, `${videoId}.mp4`, videoId);


}
main();