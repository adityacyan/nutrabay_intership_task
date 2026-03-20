"""Google Drive folder monitoring for automatic SOP processing."""

import os
import logging
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import time

logger = logging.getLogger(__name__)

# Google Drive API imports (optional - only if credentials are configured)
try:
    from google.oauth2.credentials import Credentials
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload
    import io
    GOOGLE_DRIVE_AVAILABLE = True
except ImportError:
    GOOGLE_DRIVE_AVAILABLE = False
    logger.warning("Google Drive API libraries not installed. Install with: pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client")


class GoogleDriveMonitor:
    """Monitor Google Drive folders for new SOP documents."""
    
    def __init__(self, credentials_path: Optional[str] = None):
        """
        Initialize Google Drive monitor.
        
        Args:
            credentials_path: Path to Google service account credentials JSON file
        """
        if not GOOGLE_DRIVE_AVAILABLE:
            raise ImportError("Google Drive API libraries not installed")
        
        self.credentials_path = credentials_path or os.getenv('GOOGLE_DRIVE_CREDENTIALS')
        self.service = None
        self.monitored_folders: Dict[str, Dict[str, Any]] = {}
        self.is_running = False
        self.poll_interval = 60  # Check every 60 seconds
        
        if self.credentials_path:
            self._initialize_service()
    
    def _initialize_service(self):
        """Initialize Google Drive API service."""
        try:
            if not self.credentials_path or not Path(self.credentials_path).exists():
                raise FileNotFoundError(f"Credentials file not found: {self.credentials_path}")
            
            # Use service account credentials
            credentials = service_account.Credentials.from_service_account_file(
                self.credentials_path,
                scopes=['https://www.googleapis.com/auth/drive.readonly']
            )
            
            self.service = build('drive', 'v3', credentials=credentials)
            logger.info("Google Drive API service initialized successfully")
            
        except Exception as exc:
            logger.error(f"Failed to initialize Google Drive API: {exc}")
            raise
    
    def add_folder(
        self,
        folder_id: str,
        folder_name: Optional[str] = None,
        file_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Add a Google Drive folder to monitor.
        
        Args:
            folder_id: Google Drive folder ID
            folder_name: Optional friendly name for the folder
            file_types: List of file MIME types to monitor (default: PDF and text)
        
        Returns:
            Configuration result
        """
        if not self.service:
            return {
                'success': False,
                'error': 'Google Drive service not initialized'
            }
        
        file_types = file_types or [
            'application/pdf',
            'text/plain',
            'application/vnd.google-apps.document'  # Google Docs
        ]
        
        # Verify folder exists and is accessible
        try:
            folder = self.service.files().get(
                fileId=folder_id,
                fields='id,name,mimeType'
            ).execute()
            
            if folder.get('mimeType') != 'application/vnd.google-apps.folder':
                return {
                    'success': False,
                    'error': f'ID {folder_id} is not a folder'
                }
            
            folder_name = folder_name or folder.get('name', 'Unknown Folder')
            
        except Exception as exc:
            logger.error(f"Failed to access folder {folder_id}: {exc}")
            return {
                'success': False,
                'error': f'Failed to access folder: {str(exc)}'
            }
        
        # Store folder configuration
        self.monitored_folders[folder_id] = {
            'folder_id': folder_id,
            'folder_name': folder_name,
            'file_types': file_types,
            'last_check': None,
            'processed_files': set()
        }
        
        logger.info(f"Added Google Drive folder to monitor: {folder_name} ({folder_id})")
        
        return {
            'success': True,
            'folder_id': folder_id,
            'folder_name': folder_name,
            'file_types': file_types
        }
    
    def remove_folder(self, folder_id: str) -> bool:
        """
        Remove a folder from monitoring.
        
        Args:
            folder_id: Google Drive folder ID
        
        Returns:
            True if removed successfully
        """
        if folder_id in self.monitored_folders:
            del self.monitored_folders[folder_id]
            logger.info(f"Removed folder from monitoring: {folder_id}")
            return True
        return False
    
    async def check_for_new_files(self, folder_id: str) -> List[Dict[str, Any]]:
        """
        Check a folder for new files.
        
        Args:
            folder_id: Google Drive folder ID
        
        Returns:
            List of new file metadata
        """
        if folder_id not in self.monitored_folders:
            return []
        
        folder_config = self.monitored_folders[folder_id]
        
        try:
            # Build query for files in folder
            query_parts = [f"'{folder_id}' in parents", "trashed=false"]
            
            # Add file type filters
            mime_type_conditions = [f"mimeType='{mt}'" for mt in folder_config['file_types']]
            if mime_type_conditions:
                query_parts.append(f"({' or '.join(mime_type_conditions)})")
            
            query = ' and '.join(query_parts)
            
            # List files
            results = self.service.files().list(
                q=query,
                fields='files(id,name,mimeType,createdTime,modifiedTime)',
                orderBy='createdTime desc',
                pageSize=100
            ).execute()
            
            files = results.get('files', [])
            
            # Filter for new files (not yet processed)
            new_files = []
            for file in files:
                file_id = file['id']
                if file_id not in folder_config['processed_files']:
                    new_files.append(file)
                    folder_config['processed_files'].add(file_id)
            
            folder_config['last_check'] = datetime.now(timezone.utc).isoformat()
            
            if new_files:
                logger.info(f"Found {len(new_files)} new files in folder {folder_config['folder_name']}")
            
            return new_files
            
        except Exception as exc:
            logger.error(f"Error checking folder {folder_id}: {exc}")
            return []
    
    async def download_file(self, file_id: str, file_name: str, mime_type: str) -> Optional[bytes]:
        """
        Download a file from Google Drive.
        
        Args:
            file_id: Google Drive file ID
            file_name: File name
            mime_type: File MIME type
        
        Returns:
            File content as bytes, or None if download fails
        """
        try:
            # Handle Google Docs export
            if mime_type == 'application/vnd.google-apps.document':
                # Export as PDF
                request = self.service.files().export_media(
                    fileId=file_id,
                    mimeType='application/pdf'
                )
                logger.info(f"Exporting Google Doc as PDF: {file_name}")
            else:
                # Download regular file
                request = self.service.files().get_media(fileId=file_id)
            
            # Download to memory
            file_buffer = io.BytesIO()
            downloader = MediaIoBaseDownload(file_buffer, request)
            
            done = False
            while not done:
                status, done = downloader.next_chunk()
                if status:
                    logger.debug(f"Download progress: {int(status.progress() * 100)}%")
            
            file_buffer.seek(0)
            content = file_buffer.read()
            
            logger.info(f"Downloaded file: {file_name} ({len(content)} bytes)")
            return content
            
        except Exception as exc:
            logger.error(f"Failed to download file {file_id}: {exc}")
            return None
    
    async def start_monitoring(self, callback):
        """
        Start monitoring all configured folders.
        
        Args:
            callback: Async function to call with (file_id, file_name, file_content, mime_type)
        """
        if not self.service:
            logger.error("Cannot start monitoring: Google Drive service not initialized")
            return
        
        self.is_running = True
        logger.info(f"Started monitoring {len(self.monitored_folders)} Google Drive folders")
        
        while self.is_running:
            try:
                for folder_id in list(self.monitored_folders.keys()):
                    # Check for new files
                    new_files = await self.check_for_new_files(folder_id)
                    
                    # Process each new file
                    for file in new_files:
                        file_id = file['id']
                        file_name = file['name']
                        mime_type = file['mimeType']
                        
                        logger.info(f"Processing new file: {file_name}")
                        
                        # Download file
                        content = await self.download_file(file_id, file_name, mime_type)
                        
                        if content:
                            # Call callback with file data
                            try:
                                await callback(file_id, file_name, content, mime_type)
                            except Exception as exc:
                                logger.error(f"Error in callback for {file_name}: {exc}")
                
                # Wait before next check
                await asyncio.sleep(self.poll_interval)
                
            except Exception as exc:
                logger.error(f"Error in monitoring loop: {exc}")
                await asyncio.sleep(self.poll_interval)
    
    def stop_monitoring(self):
        """Stop monitoring folders."""
        self.is_running = False
        logger.info("Stopped Google Drive monitoring")
    
    def set_poll_interval(self, seconds: int):
        """Set the polling interval in seconds."""
        self.poll_interval = max(10, seconds)  # Minimum 10 seconds
        logger.info(f"Set poll interval to {self.poll_interval} seconds")
    
    def get_status(self) -> Dict[str, Any]:
        """Get monitoring status."""
        return {
            'is_running': self.is_running,
            'service_initialized': self.service is not None,
            'monitored_folders': len(self.monitored_folders),
            'poll_interval': self.poll_interval,
            'folders': [
                {
                    'folder_id': folder_id,
                    'folder_name': config['folder_name'],
                    'last_check': config['last_check'],
                    'processed_files_count': len(config['processed_files'])
                }
                for folder_id, config in self.monitored_folders.items()
            ]
        }
