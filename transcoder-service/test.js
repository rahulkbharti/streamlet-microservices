import UploadOnB2 from "./utils/b2upload.js";
import processVideo from "./process.js";
import DownloadFromB2 from "./utils/b2download.js";

const main = async () => {
    // await DownloadFromB2({ key: "uploads/1760759934753_uploads_1759487795658_Big_Buck_Bunny_1080_10s_5MB", videoId: "7sKp6lAuEpC" });
    // const s = await UploadOnB2("test-video", true);
    // processVideo(`./downloads/uR656norKPX.mp4`)
    await UploadOnB2(`uR656norKPX`, true, (progress) => {
        console.log(`Progress for video ${progress.videoId}: ${progress.uploadedCount}/${progress.totalCount} files uploaded, ${((progress.uploadedSize / progress.totalSize) * 100).toFixed(2)}% complete.`);
    });
}

main();