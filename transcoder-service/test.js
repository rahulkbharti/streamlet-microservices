import UploadOnB2 from "./utils/b2upload.js";
// import processVideo from "./process.js";

const main = async () => {
    const s = await UploadOnB2("test-video", true);
    // processVideo(`./downloads/Big_Buck_Bunny_1080_10s_1MB.mp4`)
}

main();