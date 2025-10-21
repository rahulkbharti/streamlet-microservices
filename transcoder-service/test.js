// import UploadOnB2 from "./utils/b2upload.js";
// import processVideo from "./process.js";
// import DownloadFromB2 from "./utils/b2download.js";
// import { downloadVideo } from "./utils/azureDownload.js";
// import { UploadStream } from "./utils/azureUpload.js";

import { cleanupResources } from "./utils/cleanupResources.js";

const main = async () => {
    // await DownloadFromB2({ key: "uploads/1760759934753_uploads_1759487795658_Big_Buck_Bunny_1080_10s_5MB", videoId: "7sKp6lAuEpC" });
    // const s = await UploadOnB2("test-video", true);
    // processVideo(`./downloads/AQMRSW6sHOBKToB2VmPbjR-XQ8a90cmR4BTL7dBaCnZWh8D_N1wmLR4CU8oiKCOTSb4BQ3ZvngGHtxpJgJajCfMvu4gGId-WWAbOGK8.mp4`)
    // await UploadOnB2(`uR656norKPX`, true, (progress) => {
    //     console.log(`Progress for video ${progress.videoId}: ${progress.uploadedCount}/${progress.totalCount} files uploaded, ${((progress.uploadedSize / progress.totalSize) * 100).toFixed(2)}% complete.`);
    // });

    // await downloadVideo("rahul47d087-f4tkXEGyS23.mp4");
    // await UploadStream("WWAbOGK11");
    await cleanupResources("rahul47d087-f4tkXEGyS23.mp4", "f4tkXEGyS23.mp4", "f4tkXEGyS23");
};

main();