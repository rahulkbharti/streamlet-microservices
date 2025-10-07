// process.js
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ES_Module __dirname/__filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories
// const UPLOAD_DIR = path.resolve(__dirname, 'uploads');
const OUTPUT_DIR = path.resolve(__dirname, './streams');
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
const SEGMENT_DURATION = 5;
const RESOLUTIONS = [
    // { name: '1080p', width: 1920, height: 1080 },
    // { name: '720p', width: 1280, height: 720 },
    // { name: '480p', width: 854, height: 480 },
    // { name: '360p', width: 640, height: 360 },
    // { name: '240p', width: 426, height: 240 },
    { name: '144p', width: 256, height: 144 },
];

// Get video metadata
const getVideoMetadata = (sourcePath) =>
    new Promise((resolve, reject) => {
        ffmpeg.ffprobe(sourcePath, (err, metadata) => {
            if (err) return reject(err);
            resolve(metadata);
        });
    });
// Generate HLS for one resolution
const processResolution = (filePath, resolutionPath, resolution, updateFn = () => { }) => {
    return new Promise((resolve, reject) => {
        ffmpeg(filePath, { timeout: 432000 })
            .videoCodec('libx264')
            .audioCodec('aac')
            .size(`${resolution.width}x${resolution.height}`)
            .addOptions([
                '-preset veryfast',
                '-crf 22',
                '-start_number 0',
                `-hls_segment_filename ${path.join(resolutionPath, 'segment%03d.ts')}`,
                `-hls_time ${SEGMENT_DURATION}`,
                '-hls_list_size 0',
                '-f hls',
            ])
            .output(path.join(resolutionPath, 'playlist.m3u8'))
            .on('end', () => resolve())
            .on('progress', (progress) => {
                updateFn({ res: resolution.name, progress: progress.percent })
                process.stdout.write(`Processing ${resolution.name}: ${Math.floor(progress.percent)}% done\r`);
            })
            .on('error', (err) => reject(err))
            .run();
    });
};
// Create master playlist
const createMasterM3U8 = (baseOutputPath, resolutions) => {
    const bandwidths = {
        '1080p': 5000000, '720p': 2800000, '480p': 1400000, '360p': 800000, '240p': 400000
    };
    const masterM3U8Content = resolutions.map(res =>
        `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidths[res.name]},RESOLUTION=${res.width}x${res.height}\n${path.join(res.name, 'playlist.m3u8')}`
    ).join('\n');
    fs.writeFileSync(path.join(baseOutputPath, 'master.m3u8'), `#EXTM3U\n${masterM3U8Content}`);
};
// Generate thumbnail sprite
const generateThumbnails = (sourcePath, outputDir, duration, segmentDuration) => new Promise((resolve, reject) => {
    const numThumbnails = Math.floor(duration / segmentDuration);
    const thumbnailWidth = 160;
    const thumbnailsDir = path.join(outputDir, 'previews');

    if (!fs.existsSync(thumbnailsDir)) {
        fs.mkdirSync(thumbnailsDir, { recursive: true });
    }

    ffmpeg(sourcePath)
        .on('start', function (commandLine) {
            // This will print the exact command being executed
            console.log('Spawned FFmpeg with command: ' + commandLine);
        })
        .on('end', resolve)
        .on('error', reject)
        .outputOptions([
            `-vf`, `fps=1/${segmentDuration},scale=${thumbnailWidth}:-1`
        ])
        .outputFormat('image2')
        .output(path.join(thumbnailsDir, 'preview%03d.png'))
        .run();
});
//  Generate main thumbnail and poster thumbnail for video listing and player poster.
const generateMainAndPosterThumbnails = async (sourcePath, outputDir, duration) => {
    const thumbnailsDir = outputDir;
    if (!fs.existsSync(thumbnailsDir)) {
        fs.mkdirSync(thumbnailsDir, { recursive: true });
    }

    // Main thumbnail (first frame)
    await new Promise((resolve, reject) => {
        ffmpeg(sourcePath)
            .screenshots({
                timestamps: ['0'],
                filename: 'main.png',
                folder: thumbnailsDir,
                size: '320x?'
            })
            .on('end', resolve)
            .on('error', reject);
    });

    // Poster thumbnail (middle frame)
    const middleTimestamp = Math.floor(duration / 2);
    await new Promise((resolve, reject) => {
        ffmpeg(sourcePath)
            .screenshots({
                timestamps: [middleTimestamp],
                filename: 'poster.png',
                folder: thumbnailsDir,
                size: '320x?'
            })
            .on('end', resolve)
            .on('error', reject);
    });
};

// Generate VTT file for thumbnails
const generateVttFile = (outputDir, duration, segmentDuration) => {
    let vttContent = 'WEBVTT\n\n';
    const numThumbnails = Math.floor(duration / segmentDuration);
    for (let i = 0; i < numThumbnails; i++) {
        const startTime = new Date(i * segmentDuration * 1000).toISOString().slice(11, 19);
        const endTime = new Date((i + 1) * segmentDuration * 1000).toISOString().slice(11, 19);
        vttContent += `${i + 1}\n`;
        vttContent += `${startTime}.000 --> ${endTime}.000\n`;
        const thumbnailIndex = String(i + 1).padStart(3, '0');
        vttContent += `previews/preview${thumbnailIndex}.png\n\n`;
    }
    fs.writeFileSync(path.join(outputDir, 'thumbnails.vtt'), vttContent);
};

// Main video processing
const processVideo = async (sourcePath, updateFn) => {
    const videoFileName = path.basename(sourcePath, path.extname(sourcePath));
    const outputDirectory = path.join(OUTPUT_DIR, videoFileName);

    if (!fs.existsSync(outputDirectory)) {
        fs.mkdirSync(outputDirectory, { recursive: true });
    }

    try {
        const metadata = await getVideoMetadata(sourcePath);
        const originalHeight = metadata.streams.find(s => s.codec_type === 'video').height;
        const durationInSeconds = Math.floor(metadata.format.duration);

        const targetResolutions = RESOLUTIONS.filter(r => r.height <= originalHeight);

        for (const res of targetResolutions) {
            const resolutionPath = path.join(outputDirectory, res.name);
            if (!fs.existsSync(resolutionPath)) {
                fs.mkdirSync(resolutionPath, { recursive: true });
            }
            await processResolution(sourcePath, resolutionPath, res, updateFn);
            process.stdout.write('\n');
        }
        createMasterM3U8(outputDirectory, targetResolutions);

        await generateThumbnails(sourcePath, outputDirectory, durationInSeconds, SEGMENT_DURATION);
        await generateMainAndPosterThumbnails(sourcePath, outputDirectory, durationInSeconds);
        generateVttFile(outputDirectory, durationInSeconds, SEGMENT_DURATION);

    } catch (error) {
        console.error('Video processing error:', error);
    }
};

export default processVideo;

// // Entry point
// const main = async () => {
//     const INPUT_VIDEO_FILENAME = 'input1.mp4';
//     const videoPath = path.join(UPLOAD_DIR, INPUT_VIDEO_FILENAME);
//     if (!fs.existsSync(videoPath)) {
//         console.error(`Input video not found at ${videoPath}`);
//         console.log('Place your video file (e.g., input.mp4) in the "uploads" directory.');
//     } else {
//         await processVideo(videoPath);
//     }
// };

// main();
