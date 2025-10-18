import UploadOnB2 from "./utils/b2upload.js";
import processVideo from "./process.js";
import DownloadFromB2 from "./utils/b2download.js";

const main = async () => {
    await DownloadFromB2({ key: "uploads/1760759934753_uploads_1759487795658_Big_Buck_Bunny_1080_10s_5MB", videoId: "7sKp6lAuEpC" });
    // const s = await UploadOnB2("test-video", true);
    // processVideo(`./downloads/Big_Buck_Bunny_1080_10s_1MB.mp4`)
}

main();