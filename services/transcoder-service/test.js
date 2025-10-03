import UploadOnB2 from "./utils/b2upload.js";
import DownloadFromB2 from "./utils/b2download.js";
// const testUpload = async () => {
//     const onProgress = (info) => {
//         console.log("Progress Info:", info);
//     };
//     const result = await UploadOnB2("6c485ac9945e307a", true, onProgress);
//     console.log("Upload Result:", result);
// }

// testUpload();

const testDownload = async () => {
    const onProgress = (percent, loaded, total) => {
        process.stdout.write(`\rProgress: ${percent}% (${loaded}/${total} bytes)`);
    };
    try {
        const filePath = await DownloadFromB2({ key: 'uploads/1759487795658_Big_Buck_Bunny_1080_10s_5MB.mp4', onProgress });
        console.log("\nDownload completed:", filePath);
    } catch (error) {
        console.error("Download error:", error);
    }
};

testDownload();