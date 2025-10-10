import os
import sys
import subprocess
import json
import math
import datetime
from pathlib import Path

# --- Configuration ---
# Use Pathlib for modern, object-oriented path handling.
# The main OUTPUT_DIR will be set relative to the script's execution location.
SEGMENT_DURATION = 5
RESOLUTIONS = [
    # {'name': '1080p', 'width': 1920, 'height': 1080},
    # {'name': '720p', 'width': 1280, 'height': 720},
    # {'name': '480p', 'width': 854, 'height': 480},
    # {'name': '360p', 'width': 640, 'height': 360},
    {'name': '240p', 'width': 426, 'height': 240},
    {'name': '144p', 'width': 256, 'height': 144},
]

# --- Helper Functions ---

def get_video_metadata(source_path):
    """Gets video metadata using ffprobe."""
    try:
        # The 'ffmpeg-python' library provides a convenient probe function
        return json.loads(subprocess.check_output(
            ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', str(source_path)]
        ))
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"Error getting metadata: {e}", file=sys.stderr)
        return None

def process_resolution(file_path, resolution_path, resolution, total_duration):
    """Generates HLS for one resolution and shows progress."""
    print(f"Processing {resolution['name']}...")

    # Construct the ffmpeg command as a list of arguments
    command = [
        'ffmpeg', '-y', # -y overwrites output files without asking
        '-i', str(file_path),
        '-vcodec', 'libx264',
        '-acodec', 'aac',
        '-s', f"{resolution['width']}x{resolution['height']}",
        '-preset', 'veryfast',
        '-crf', '22',
        '-start_number', '0',
        '-hls_segment_filename', str(resolution_path / 'segment%03d.ts'),
        '-hls_time', str(SEGMENT_DURATION),
        '-hls_list_size', '0',
        '-f', 'hls',
        str(resolution_path / 'playlist.m3u8')
    ]

    # Run the command using subprocess to capture stderr for progress
    process = subprocess.Popen(command, stderr=subprocess.PIPE, universal_newlines=True)

    for line in process.stderr:
        if 'time=' in line:
            # Parse time from ffmpeg's output (e.g., time=00:01:23.45)
            timestr = line.split('time=')[1].split(' ')[0]
            try:
                h, m, s = map(float, timestr.split(':'))
                elapsed_time = h * 3600 + m * 60 + s
                percent = (elapsed_time / total_duration) * 100
                # Print progress on a single line
                sys.stdout.write(f"\rProcessing {resolution['name']}: {percent:.1f}% done")
                sys.stdout.flush()
            except ValueError:
                continue # Ignore malformed time strings

    process.wait()
    sys.stdout.write(f"\rProcessing {resolution['name']}: 100.0% done\n")
    sys.stdout.flush()

    if process.returncode != 0:
        raise RuntimeError(f"FFmpeg failed for resolution {resolution['name']}")

def create_master_m3u8(base_output_path, resolutions):
    """Creates a master M3U8 playlist for adaptive bitrate streaming."""
    bandwidths = {
        '1080p': 5000000, '720p': 2800000, '480p': 1400000,
        '360p': 800000, '240p': 400000, '144p': 200000
    }

    master_content = "#EXTM3U\n"
    for res in resolutions:
        bandwidth = bandwidths.get(res['name'], 200000) # Default bandwidth
        master_content += (
            f"#EXT-X-STREAM-INF:BANDWIDTH={bandwidth},"
            f"RESOLUTION={res['width']}x{res['height']}\n"
            f"{res['name']}/playlist.m3u8\n"
        )

    with open(base_output_path / "master.m3u8", "w") as f:
        f.write(master_content)

def generate_thumbnails(source_path, output_dir):
    """Generates a series of thumbnails from the video."""
    print("Generating preview thumbnails...")
    previews_dir = output_dir / "previews"
    previews_dir.mkdir(parents=True, exist_ok=True)

    command = [
        'ffmpeg', '-y',
        '-i', str(source_path),
        '-vf', f"fps=1/{SEGMENT_DURATION},scale=160:-1",
        '-vsync', 'vfr',
        str(previews_dir / "preview%03d.png")
    ]
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def generate_main_and_poster_thumbnails(source_path, output_dir, duration):
    """Generates a main thumbnail (start) and a poster thumbnail (middle)."""
    print("Generating main and poster thumbnails...")

    # Main thumbnail (from the start)
    main_thumb_command = [
        'ffmpeg', '-y',
        '-i', str(source_path),
        '-ss', '00:00:00',
        '-vframes', '1',
        '-s', '320x180',
        str(output_dir / "main.png")
    ]
    subprocess.run(main_thumb_command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Poster thumbnail (from the middle)
    middle_timestamp = str(datetime.timedelta(seconds=duration / 2))
    poster_thumb_command = [
        'ffmpeg', '-y',
        '-i', str(source_path),
        '-ss', middle_timestamp,
        '-vframes', '1',
        '-s', '320x180',
        str(output_dir / "poster.png")
    ]
    subprocess.run(poster_thumb_command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def generate_vtt_file(output_dir, duration, segment_duration):
    """Generates a WebVTT file for thumbnail previews."""
    print("Generating VTT file...")
    num_thumbnails = math.floor(duration / segment_duration)
    vtt_content = "WEBVTT\n\n"

    for i in range(num_thumbnails):
        start_time = datetime.timedelta(seconds=i * segment_duration)
        end_time = datetime.timedelta(seconds=(i + 1) * segment_duration)

        # Format timedelta to HH:MM:SS.mmm
        start_str = f"0{start_time}".split('.')[0] + ".000"
        end_str = f"0{end_time}".split('.')[0] + ".000"

        vtt_content += f"{i+1}\n"
        vtt_content += f"{start_str} --> {end_str}\n"
        vtt_content += f"previews/preview{i+1:03d}.png\n\n"

    with open(output_dir / "thumbnails.vtt", "w") as f:
        f.write(vtt_content)

# --- Main Orchestrator ---

def process_video(source_path, output_dir_base):
    """Main video processing function."""
    video_filename = Path(source_path).stem
    output_directory = output_dir_base / video_filename

    # Create the main output directory for the video
    output_directory.mkdir(parents=True, exist_ok=True)

    try:
        metadata = get_video_metadata(source_path)
        if not metadata:
            return

        video_stream = next((s for s in metadata['streams'] if s['codec_type'] == 'video'), None)
        if not video_stream:
            print("No video stream found.", file=sys.stderr)
            return

        original_height = int(video_stream['height'])
        duration = float(metadata['format']['duration'])

        # Filter resolutions to only process those smaller or equal to the original
        target_resolutions = [r for r in RESOLUTIONS if r['height'] <= original_height]

        print(f"--- Starting processing for {Path(source_path).name} ---")

        for res in target_resolutions:
            resolution_path = output_directory / res['name']
            resolution_path.mkdir(parents=True, exist_ok=True)
            process_resolution(source_path, resolution_path, res, duration)

        create_master_m3u8(output_directory, target_resolutions)

        generate_thumbnails(source_path, output_directory)
        generate_main_and_poster_thumbnails(source_path, output_directory, duration)
        generate_vtt_file(output_directory, duration, SEGMENT_DURATION)

        print(f"--- Successfully processed {Path(source_path).name} ---")

    except Exception as e:
        print(f"An error occurred during video processing: {e}", file=sys.stderr)

# # --- Entry Point ---
if __name__ == "__main__":
    # Get the current working directory, which works in all environments.
    CURRENT_DIR = Path.cwd()
    OUTPUT_DIR = CURRENT_DIR / "streams"

    # Create an 'uploads' directory if it doesn't exist
    UPLOAD_DIR = CURRENT_DIR / "downloads"
    UPLOAD_DIR.mkdir(exist_ok=True)

    input_video_filename = 'TEST1.mp4' # Change this to your video file
    video_path = UPLOAD_DIR / input_video_filename

    if not video_path.is_file():
        print(f"Input video not found at '{video_path}'", file=sys.stderr)
        print(f"Place your video file (e.g., '{input_video_filename}') in the '{UPLOAD_DIR.name}' directory.")
    else:
        # Pass the base output directory to the main function
        process_video(video_path, OUTPUT_DIR)