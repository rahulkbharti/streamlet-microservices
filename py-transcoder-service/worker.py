# worker.py
import os
import sys
import asyncio
from pathlib import Path
from bullmq import Worker

# --- Apne doosre Python functions ko import karein ---
from process import process_video
from utils.b2download import download_from_b2
from utils.b2upload import upload_on_b2

# --- Redis Configuration ---
REDIS_URL = os.getenv("REDIS_URL", "")

# --- Output Directory Setup ---
CURRENT_DIR = Path.cwd()
OUTPUT_DIR = CURRENT_DIR / "streams"
OUTPUT_DIR.mkdir(exist_ok=True)

# --- The Processor Function ---
async def processor(job, token):
    """
    This is the core task that the bullmq worker will execute for each job.
    """
    print(f"[WORKER] Starting job {job.id}. Data:", job.data)
    
    try:
        key = job.data.get('key')
        video_id = job.data.get('videoId')
        download_path = Path(f"./downloads/{video_id}")

        # Ensure downloads directory exists
        download_path.parent.mkdir(parents=True, exist_ok=True)

        # --- Step 1: Download the video file from Backblaze ---
        # print(f"[WORKER] Downloading file from B2: {key}")
        
        # progress_data = {
        #     "type": "downloading", 
        #     "videoId": video_id, 
        #     "fileName": key, 
        #     "percent": 0,
        #     "status": "Downloading from B2"
        # }
        # print(f"[PROGRESS] {progress_data}")

        # # Download file
        # download_result = download_from_b2(
        #     key=key, 
        #     video_id=video_id.split('.')[0]
        # )
        # print(f"[WORKER] File downloaded to: {download_path}")

        # --- Step 2: Process the video file on the server ---
        progress_data = {
            "type": "processing", 
            "videoId": video_id, 
            "percent": 50,
            "status": "Processing video"
        }
        print(f"[PROGRESS] {progress_data}")

        # Process video - SIMPLE PARAMETERS (no keyword arguments)
        CURRENT_DIR = Path.cwd()
        OUTPUT_DIR = CURRENT_DIR / "streams"

        # Create an 'uploads' directory if it doesn't exist
        UPLOAD_DIR = CURRENT_DIR / "downloads"
        UPLOAD_DIR.mkdir(exist_ok=True)
        input_video_filename = 'TEST1.mp4'
        video_path = UPLOAD_DIR / input_video_filename
        if not video_path.is_file():
            print(f"Input video not found at '{video_path}'", file=sys.stderr)
            print(f"Place your video file (e.g., '{input_video_filename}') in the '{UPLOAD_DIR.name}' directory.")
        else:
        # Pass the base output directory to the main function
            process_video(video_path, OUTPUT_DIR)
        # process_video(str(download_path), str(OUTPUT_DIR))

        print(f"[WORKER] Video processing completed")

        # --- Step 3: Delete the original downloaded .mp4 file ---
        try:
            if download_path.exists():
                download_path.unlink()
                print(f"[WORKER] Deleted local file: {download_path}")
        except OSError as e:
            print(f"[WORKER] Could not delete file {download_path}: {e}")

        # --- Step 4: Upload the HLS folder to Backblaze ---
        progress_data = {
            "type": "uploading", 
            "videoId": video_id, 
            "percent": 75,
            "status": "Uploading to B2"
        }
        print(f"[PROGRESS] {progress_data}")

        print(f"[WORKER] Uploading processed files to B2...")
        
        # Upload processed files
        upload_result = upload_on_b2(
            video_id=video_id.split('.')[0], 
            delete_after_upload=True
        )
        print(f"[WORKER] Upload completed. Result:", upload_result)
        
        # Final progress update
        progress_data = {
            "type": "completed", 
            "videoId": video_id, 
            "percent": 100,
            "status": "Completed"
        }
        print(f"[PROGRESS] {progress_data}")

        print(f"[WORKER] Job {job.id} complete. Processed video ID: {video_id}")
        return {
            "videoId": video_id, 
            "uploadResult": upload_result,
            "status": "success"
        }
        
    except Exception as e:
        print(f"[WORKER] Error in job {job.id}: {e}")
        progress_data = {
            "type": "error",
            "videoId": video_id,
            "error": str(e),
            "status": "Failed"
        }
        print(f"[PROGRESS] {progress_data}")
        raise e

# --- Worker Event Listeners ---
def on_completed(job, result, *args):
    print(f"[WORKER] Job {job.id} has completed with result: {result}")

def on_failed(job, err, *args):
    print(f"[WORKER] Job {job.id} has failed with error: {err}")

# --- Worker Initialization ---
async def main():
    worker = Worker(
        'video-processing',  # Queue name must match your Node.js queue
        processor,
        {"connection": REDIS_URL}
    )
    
    # Event listeners
    worker.on("completed", on_completed)
    worker.on("failed", on_failed)
    
    print('[WORKER] Worker is running and waiting for jobs...')
    
    # Keep the worker running
    try:
        await asyncio.Future()  # Run forever
    except KeyboardInterrupt:
        print("Worker received interrupt signal...")
    finally:
        await worker.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Worker shutting down...")