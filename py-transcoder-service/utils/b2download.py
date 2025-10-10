import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from b2sdk.v2 import B2Api, InMemoryAccountInfo, AbstractProgressListener
from typing import Optional, Callable

# Load environment variables
load_dotenv('.env.development')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BUCKET_NAME = 'stream-m3u8'

class ProgressListener(AbstractProgressListener):
    """Custom progress listener for tracking download progress"""
    def __init__(self, total_bytes: int, callback: Optional[Callable] = None):
        super().__init__()
        self.total_bytes = total_bytes
        self.bytes_so_far = 0
        self.callback = callback
    
    def set_total_bytes(self, total_bytes: int):
        """Called when the total bytes are known"""
        self.total_bytes = total_bytes
    
    def bytes_completed(self, bytes_completed: int):
        """Called when bytes are downloaded"""
        self.bytes_so_far = bytes_completed
        if self.callback and self.total_bytes > 0:
            percent = int((bytes_completed / self.total_bytes) * 100)
            self.callback(percent, bytes_completed, self.total_bytes)

class DownloadFromB2:
    def __init__(self):
        self.b2_api = None
        self.bucket = None
        self._initialize_b2()
    
    def _initialize_b2(self):
        """Initialize B2 API connection"""
        try:
            key_id = os.getenv("B2_KEY_ID")
            application_key = os.getenv("B2_APPLICATION_KEY")
            
            if not key_id or not application_key:
                raise ValueError("B2_KEY_ID and B2_APPLICATION_KEY must be set in environment variables")
            
            info = InMemoryAccountInfo()
            self.b2_api = B2Api(info)
            self.b2_api.authorize_account("production", key_id, application_key)
            self.bucket = self.b2_api.get_bucket_by_name(BUCKET_NAME)
            logger.info("✅ B2 API initialized successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize B2 API: {e}")
            raise
    
    def download_file(
        self, 
        key: str, 
        video_id: str, 
        on_progress: Optional[Callable[[int, int, int], None]] = None
    ) -> str:
        """
        Download a file from Backblaze B2
        
        Args:
            key: The file key/path in B2
            video_id: Unique identifier for the video
            on_progress: Callback function for progress updates (percent, loaded, total)
            
        Returns:
            video_id: The video identifier
        """
        if not key:
            raise ValueError('Key is required for download.')
        
        try:
            # Create downloads directory if it doesn't exist
            downloads_dir = Path('downloads')
            downloads_dir.mkdir(exist_ok=True)
            
            output_path = downloads_dir / f"{video_id}.mp4"
            file_name = key  # Keep 'uploads/filename.mp4'
            
            logger.info(f"Downloading {file_name} from B2...")
            
            # Get file info to know total size
            file_version = self.bucket.get_file_info_by_name(file_name)
            total_size = file_version.size
            
            logger.info(f"File size: {total_size} bytes")
            
            # Create progress listener
            progress_listener = ProgressListener(total_size, on_progress)
            
            # Download the file with progress tracking
            downloaded_file = self.bucket.download_file_by_name(
                file_name=file_name,
                progress_listener=progress_listener
            )
            
            # Save to local file
            downloaded_file.save_to(output_path)
            
            # Verify file was written correctly
            file_size = output_path.stat().st_size
            logger.info(f"✅ File downloaded successfully: {output_path}")
            logger.info(f"📊 File size: {file_size} bytes")
            
            return video_id
            
        except Exception as error:
            logger.error(f'❌ Download failed: {error}')
            raise

# Alternative simplified version without progress tracking
def download_from_b2_simple(key: str, video_id: str) -> str:
    """
    Simplified version without progress tracking
    """
    downloader = DownloadFromB2()
    
    # Create downloads directory if it doesn't exist
    downloads_dir = Path('downloads')
    downloads_dir.mkdir(exist_ok=True)
    
    output_path = downloads_dir / f"{video_id}.mp4"
    
    logger.info(f"Downloading {key} from B2...")
    
    # Download without progress tracking
    downloaded_file = downloader.bucket.download_file_by_name(key)
    downloaded_file.save_to(output_path)
    
    file_size = output_path.stat().st_size
    logger.info(f"✅ File downloaded successfully: {output_path}")
    logger.info(f"📊 File size: {file_size} bytes")
    
    return video_id

# Function-based approach (maintaining your original function signature)
def download_from_b2(
    key: str, 
    video_id: str, 
    on_progress: Optional[Callable[[int, int, int], None]] = None
) -> str:
    """
    Function-based version of the B2 downloader
    """
    downloader = DownloadFromB2()
    return downloader.download_file(key, video_id, on_progress)

# Example usage
# if __name__ == "__main__":
#     def progress_callback(percent, loaded, total):
#         print(f"Download Progress: {percent}% ({loaded}/{total} bytes)")
    
#     try:
#         # Example usage with progress tracking
#         video_id = "test_video_123"
#         result = download_from_b2(
#             key="uploads/1760075556108_Big_Buck_Bunny_1080_10s_1MB.mp4",  # Replace with your actual file key
#             video_id=video_id,
#             on_progress=progress_callback
#         )
#         print(f"Download completed: {result}")
        
#         # Or use the simple version without progress
#         # result = download_from_b2_simple("uploads/sample_video.mp4", "video_456")
        
#     except Exception as e:
#         print(f"Error: {e}")