import axios from "axios";
import B2 from "backblaze-b2";
import dotenv from "dotenv";
dotenv.config({ path: '.env.development' });

console.log("process.env.B2_KEY_ID", process.env.B2_KEY_ID);

const b2 = new B2({
    applicationKeyId: process.env.B2_KEY_ID,
    applicationKey: process.env.B2_APPLICATION_KEY
});

const main = async () => {
    await b2.authorize();  // 🔑 authorize first

    const responce = await b2.getDownloadAuthorization({
        bucketId: "8830259d7bf996ff9a9a061b",
        fileNamePrefix: "6c485ac9945e307a/",
        validDurationInSeconds: 3600
    });

    console.log("Download authorization token:", responce.data.authorizationToken);
}

const requestMaster = async () => {
    const token = "4"
    // const response = await fetch("https://f005.backblazeb2.com/file/stream-m3u8/6c485ac9945e307a/master.m3u8?Authorization=3_20251003050347_8203c524ef182d2b563527ab_95a90ab193058d98d3d36d5230c91625d698ab2e_005_20251003060347_0017_dnld");
    const response = await fetch("https://f005.backblazeb2.com/file/stream-m3u8/6c485ac9945e307a/144p/playlist.m3u8?Authorization=3_20251003050347_8203c524ef182d2b563527ab_95a90ab193058d98d3d36d5230c91625d698ab2e_005_20251003060347_0017_dnld");
    // const response = await fetch("https://f005.backblazeb2.com/file/stream-m3u8/6c485ac9945e307a/thumbnails.vtt?Authorization=3_20251003050347_8203c524ef182d2b563527ab_95a90ab193058d98d3d36d5230c91625d698ab2e_005_20251003060347_0017_dnld");

    let m3u8Text = await response.text();

    // m3u8Text = m3u8Text.replace(/(\d+p\/playlist\.m3u8)/g, `https://f005.backblazeb2.com/file/stream-m3u8/6c485ac9945e307a/$1?Authorization=${token}`);
    m3u8Text = m3u8Text.replace(/(segment\d+\.ts)/g, `https://f005.backblazeb2.com/file/stream-m3u8/6c485ac9945e307a/144p/$1?Authorization=${token}`);
    // m3u8Text = m3u8Text.replace(
    //     /(previews\/[^\s]+\.png)/g,
    //     (match) => `${match}?Authorization=${token}`
    // );

    // res.set("Content-Type", "application/vnd.apple.mpegurl");
    // res.set("Content-Type", "text/vtt");
    console.log(m3u8Text);
    //     // Example modification: replace all occurrences of ".ts" with ".mp4"
    //     const modifiedM3U8 = m3u8Text.replace(/\.ts/g, ".mp4");

    //     console.log(modifiedM3U8);
}

requestMaster();

// main();
