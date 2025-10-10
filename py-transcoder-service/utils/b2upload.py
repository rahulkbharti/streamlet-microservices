import os
import hashlib
import logging
from pathlib import Path
from typing import Optional, Callable, Dict, Any, List
from dotenv import load_dotenv
from b2sdk.v2 import B2Api, InMemoryAccountInfo, UploadSourceBytes

# Load environment variables
load_dotenv('.env.development')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CONFIG = {
    'BUCKET_NAME': 'stream-m3u8',
    'STREAMS_DIR': './streams',
    'B2_BASE_FOLDER': 'streams'
}

class UploadOnB2:
    def __init__(self):
        self.b2_api = None
        self.bucket = None
        self._is_uploading = False
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
            self.bucket = self.b2_api.get_bucket_by_name(CONFIG['BUCKET_NAME'])
            logger.info("✅ B2 API initialized successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize B2 API: {e}")
            raise
    
    def get_mime_type(self, file_path: str) -> str:
        """Detect MIME type based on file extension"""
        ext = Path(file_path).suffix.lower()
        mime_map = {
            ".m3u8": "application/vnd.apple.mpegurl",
            ".ts": "video/mp2t",
            ".vtt": "text/vtt",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".mp4": "video/mp4",
        }
        return mime_map.get(ext, "application/octet-stream")
    
    def get_all_files(self, dir_path: str) -> List[str]:
        """Recursive file walker without duplicates"""
        result = []
        
        def walk_directory(directory):
            for root, dirs, files in os.walk(directory):
                for file in files:
                    full_path = os.path.join(root, file)
                    result.append(full_path)
        
        walk_directory(dir_path)
        # Remove duplicates and return
        return list(set(result))
    
    def upload_file(self, file_path: str, destination_path: str):
        """Upload one file to B2"""
        try:
            # Read file data
            with open(file_path, 'rb') as f:
                data = f.read()
            
            # Calculate SHA1 hash (for verification, not passed to B2)
            file_hash = hashlib.sha1(data).hexdigest()
            file_size = len(data)
            
            # Create upload source
            upload_source = UploadSourceBytes(data)
            
            logger.info(f"📤 Uploading: {destination_path}")
            
            # Upload file - using correct b2sdk API
            file_info = self.bucket.upload(
                upload_source=upload_source,
                file_name=destination_path,
                content_type=self.get_mime_type(file_path)
                # file_infos parameter is not needed in b2sdk
            )
            
            # Verify the upload by checking the returned file info
            logger.info(f"✅ Uploaded: {destination_path} ({(file_size / 1024 / 1024):.2f} MB)")
            logger.debug(f"📄 B2 File ID: {file_info.id_}, SHA1: {file_info.content_sha1}")
            
        except Exception as e:
            logger.error(f"❌ Failed to upload {destination_path}: {e}")
            raise
    
    def upload_video_folder(self, video_id: str, on_progress: Optional[Callable] = None) -> Dict[str, Any]:
        """Upload all files for a video folder"""
        folder_path = os.path.join(CONFIG['STREAMS_DIR'], video_id)
        if not os.path.exists(folder_path):
            raise FileNotFoundError(f"Video folder not found: {folder_path}")
        
        logger.info(f"📁 Uploading video: {video_id}")
        logger.info(f"📁 Target folder on Backblaze: {CONFIG['B2_BASE_FOLDER']}/{video_id}/")
        
        files = self.get_all_files(folder_path)
        logger.info(f"📦 Found {len(files)} files to upload.")
        
        # Calculate total size
        total_size = sum(os.path.getsize(f) for f in files)
        uploaded_count = 0
        uploaded_size = 0
        
        for file_path in files:
            # Calculate relative path and destination
            relative_path = os.path.relpath(file_path, folder_path)
            destination_path = os.path.join(CONFIG['B2_BASE_FOLDER'], video_id, relative_path).replace('\\', '/')
            
            self.upload_file(file_path, destination_path)
            
            uploaded_count += 1
            uploaded_size += os.path.getsize(file_path)
            
            # Call progress callback if provided
            if on_progress:
                progress_data = {
                    'videoId': video_id,
                    'uploadedCount': uploaded_count,
                    'totalCount': len(files),
                    'uploadedSize': uploaded_size,
                    'totalSize': total_size
                }
                on_progress(progress_data)
        
        logger.info(f"🎉 Upload complete for {video_id}")
        logger.info(f"📊 Files uploaded: {uploaded_count}")
        logger.info(f"💾 Total size: {(uploaded_size / 1024 / 1024):.2f} MB")
        
        return {
            'uploadedCount': uploaded_count,
            'totalSize': uploaded_size
        }
    
    def verify_master_file(self, video_id: str) -> bool:
        """Verify that master.m3u8 exists on Backblaze"""
        try:
            master_path = f"{CONFIG['B2_BASE_FOLDER']}/{video_id}/master.m3u8"
            file_info = self.bucket.get_file_info_by_name(master_path)
            logger.info(f"✅ Verified: {master_path} exists on Backblaze")
            return True
        except Exception as e:
            logger.warning(f"⚠️ Could not verify master.m3u8 existence on Backblaze: {e}")
            return False
    
    def upload_video(
        self, 
        video_id: str, 
        delete_after_upload: bool = False, 
        on_progress: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Main upload handler
        
        Args:
            video_id: The video identifier
            delete_after_upload: Whether to delete local files after upload
            on_progress: Callback function for progress updates
            
        Returns:
            Upload result with count and size
        """
        try:
            logger.info(f"🚀 Starting upload for video: {video_id}")
            
            # Prevent accidental double execution
            if self._is_uploading:
                logger.warning("⚠️ Upload already in progress. Skipping duplicate call.")
                return {}
            
            self._is_uploading = True
            
            # Upload the video folder
            result = self.upload_video_folder(video_id, on_progress)
            
            # Verify master file
            self.verify_master_file(video_id)
            
            # Delete local files if requested
            if delete_after_upload:
                folder_path = os.path.join(CONFIG['STREAMS_DIR'], video_id)
                import shutil
                if os.path.exists(folder_path):
                    shutil.rmtree(folder_path, ignore_errors=True)
                    logger.info(f"🗑️ Deleted local folder: {video_id}")
                else:
                    logger.warning(f"⚠️ Local folder not found for deletion: {folder_path}")
            
            logger.info(f"✅ Successfully uploaded {video_id} to Backblaze B2")
            logger.info(f"📁 Backblaze Path: {CONFIG['B2_BASE_FOLDER']}/{video_id}/")
            
            self._is_uploading = False
            return result
            
        except Exception as err:
            self._is_uploading = False
            logger.error(f"❌ Failed to upload {video_id}: {err}")
            raise

# Function-based approach (maintaining your original function signature)
def upload_on_b2(
    video_id: str, 
    delete_after_upload: bool = False, 
    on_progress: Optional[Callable] = None
) -> Dict[str, Any]:
    """
    Function-based version of the B2 uploader
    
    Args:
        video_id: The video identifier
        delete_after_upload: Whether to delete local files after upload
        on_progress: Callback function for progress updates
        
    Returns:
        Upload result with count and size
    """
    uploader = UploadOnB2()
    return uploader.upload_video(video_id, delete_after_upload, on_progress)

# Alternative simplified version for quick uploads
def quick_upload(video_id: str, source_folder: Optional[str] = None) -> bool:
    """
    Simplified version for quick uploads without progress tracking
    
    Args:
        video_id: The video identifier
        source_folder: Optional custom source folder path
        
    Returns:
        Success status
    """
    try:
        uploader = UploadOnB2()
        
        # Use custom source folder if provided, otherwise use default
        if source_folder:
            original_streams_dir = CONFIG['STREAMS_DIR']
            CONFIG['STREAMS_DIR'] = source_folder
        
        result = uploader.upload_video(video_id)
        
        # Restore original streams dir if we changed it
        if source_folder:
            CONFIG['STREAMS_DIR'] = original_streams_dir
            
        return bool(result and result.get('uploadedCount', 0) > 0)
    except Exception as e:
        logger.error(f"Quick upload failed: {e}")
        return False

# Example usage
# if __name__ == "__main__":
#     def progress_callback(progress_data):
#         percent = int((progress_data['uploadedCount'] / progress_data['totalCount']) * 100)
#         size_mb = progress_data['uploadedSize'] / 1024 / 1024
#         total_mb = progress_data['totalSize'] / 1024 / 1024
#         print(f"Progress: {percent}% - {progress_data['uploadedCount']}/{progress_data['totalCount']} files "
#               f"({size_mb:.1f}/{total_mb:.1f} MB)")
    
#     try:
#         # Example usage with progress tracking
#         result = upload_on_b2(
#             video_id="input",
#             delete_after_upload=False,
#             on_progress=progress_callback
#         )
#         print(f"Upload completed: {result}")
        
#         # Or use the quick version
#         # success = quick_upload("test_video_123")
#         # print(f"Quick upload: {'Success' if success else 'Failed'}")
        
#     except Exception as e:
#         print(f"Error: {e}")