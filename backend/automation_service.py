"""Automation service for monitoring folders and triggering automatic SOP processing."""

import os
import asyncio
import logging
import threading
from pathlib import Path
from typing import Optional, Callable, Dict, Any
from datetime import datetime, timezone
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileCreatedEvent

from document_parser import DocumentParser
from content_generator import ContentGenerator
from storage_service import StorageService

# Try to import notification library
try:
    from plyer import notification
    NOTIFICATIONS_AVAILABLE = True
except ImportError:
    NOTIFICATIONS_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("plyer not installed. Install with: pip install plyer")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class AutomationService:
    """Service for monitoring folders and automatically processing new SOP documents."""
    
    def __init__(self):
        self.parser = DocumentParser()
        self.generator = ContentGenerator()
        self.storage = StorageService()
        self.observers: Dict[str, Observer] = {}
        self.processing_queue: asyncio.Queue = asyncio.Queue()
        self.is_running = False
        self.error_callback: Optional[Callable] = None
        self.success_callback: Optional[Callable] = None
        self.event_loop: Optional[asyncio.AbstractEventLoop] = None
        
    def configure_watcher(
        self,
        folder_path: str,
        settings: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Configure folder monitoring for automatic SOP processing.
        
        Args:
            folder_path: Path to the folder to monitor
            settings: Optional configuration settings
                - file_patterns: List of file patterns to watch (default: ['*.txt', '*.pdf'])
                - recursive: Whether to watch subdirectories (default: False)
                - debounce_seconds: Delay before processing (default: 2)
        
        Returns:
            Configuration result with status and details
        """
        settings = settings or {}
        file_patterns = settings.get('file_patterns', ['*.txt', '*.pdf'])
        recursive = settings.get('recursive', False)
        debounce_seconds = settings.get('debounce_seconds', 2)
        
        # Validate folder path
        path = Path(folder_path)
        if not path.exists():
            logger.error(f"Folder path does not exist: {folder_path}")
            return {
                'success': False,
                'error': f"Folder path does not exist: {folder_path}"
            }
        
        if not path.is_dir():
            logger.error(f"Path is not a directory: {folder_path}")
            return {
                'success': False,
                'error': f"Path is not a directory: {folder_path}"
            }
        
        # Create event handler
        event_handler = SOPFileHandler(
            automation_service=self,
            file_patterns=file_patterns,
            debounce_seconds=debounce_seconds
        )
        
        # Create and start observer
        observer = Observer()
        observer.schedule(event_handler, str(path), recursive=recursive)
        
        # Store observer
        watch_id = str(path)
        if watch_id in self.observers:
            # Stop existing observer
            self.observers[watch_id].stop()
            self.observers[watch_id].join()
        
        self.observers[watch_id] = observer
        observer.start()
        
        logger.info(f"Started monitoring folder: {folder_path} (recursive={recursive})")
        
        return {
            'success': True,
            'watch_id': watch_id,
            'folder_path': folder_path,
            'recursive': recursive,
            'file_patterns': file_patterns,
            'debounce_seconds': debounce_seconds
        }
    
    def stop_watcher(self, watch_id: str) -> bool:
        """
        Stop monitoring a specific folder.
        
        Args:
            watch_id: The watch ID returned from configure_watcher
        
        Returns:
            True if stopped successfully, False otherwise
        """
        if watch_id not in self.observers:
            logger.warning(f"No active watcher found for: {watch_id}")
            return False
        
        observer = self.observers[watch_id]
        observer.stop()
        observer.join()
        del self.observers[watch_id]
        
        logger.info(f"Stopped monitoring folder: {watch_id}")
        return True
    
    def stop_all_watchers(self):
        """Stop all active folder watchers."""
        for watch_id in list(self.observers.keys()):
            self.stop_watcher(watch_id)
        logger.info("Stopped all folder watchers")
    
    async def process_new_document(self, file_path: str) -> Dict[str, Any]:
        """
        Process a new SOP document automatically.
        
        Args:
            file_path: Path to the document file
        
        Returns:
            Processing result with status and details
        """
        try:
            logger.info(f"Processing new document: {file_path}")
            
            # Read file
            path = Path(file_path)
            if not path.exists():
                raise FileNotFoundError(f"File not found: {file_path}")
            
            with open(path, 'rb') as f:
                file_bytes = f.read()
            
            filename = path.name
            
            # Determine content type
            if filename.lower().endswith('.pdf'):
                content_type = 'application/pdf'
            else:
                content_type = 'text/plain'
            
            # Validate file
            valid, error_msg = self.parser.validate_file(filename, len(file_bytes), content_type)
            if not valid:
                logger.error(f"File validation failed: {error_msg}")
                if self.error_callback:
                    await self.error_callback(file_path, error_msg)
                return {
                    'success': False,
                    'file_path': file_path,
                    'error': error_msg
                }
            
            # Parse document
            logger.info(f"Parsing document: {filename}")
            parsed = self.parser.parse_document(filename, file_bytes, content_type)
            
            # Generate content
            logger.info(f"Generating training content for: {filename}")
            generated = await self.generator.generate_all_content(parsed)
            
            # Save to storage
            logger.info(f"Saving generated content for: {filename}")
            project_meta = self.storage.save_result(filename, generated.model_dump(), automated=True)
            
            # Create output folder
            output_folder = self.create_output_folder(filename, project_meta['id'])
            
            logger.info(f"Successfully processed document: {filename} -> {output_folder}")
            
            # Notify success
            if self.success_callback:
                await self.success_callback(file_path, project_meta)
            
            return {
                'success': True,
                'file_path': file_path,
                'filename': filename,
                'project_id': project_meta['id'],
                'output_folder': output_folder,
                'processed_at': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as exc:
            logger.error(f"Error processing document {file_path}: {exc}", exc_info=True)
            if self.error_callback:
                await self.error_callback(file_path, str(exc))
            return {
                'success': False,
                'file_path': file_path,
                'error': str(exc)
            }
    
    def create_output_folder(self, document_name: str, project_id: str) -> str:
        """
        Create organized output folder for processed document.
        
        Args:
            document_name: Name of the source document
            project_id: Unique project identifier
        
        Returns:
            Path to the created output folder
        """
        # Create base output directory
        base_output = Path("backend/output/automated")
        base_output.mkdir(parents=True, exist_ok=True)
        
        # Create project-specific folder
        # Sanitize document name for folder name
        safe_name = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in document_name)
        safe_name = safe_name.replace(' ', '_')
        
        # Remove file extension
        if '.' in safe_name:
            safe_name = safe_name.rsplit('.', 1)[0]
        
        folder_name = f"{safe_name}_{project_id[:8]}"
        output_folder = base_output / folder_name
        output_folder.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Created output folder: {output_folder}")
        
        return str(output_folder)
    
    def notify_completion(self, result: Dict[str, Any]):
        """
        Send completion notification.
        
        Args:
            result: Processing result dictionary
        """
        if result['success']:
            logger.info(f"✓ Processing completed successfully: {result.get('filename', 'unknown')}")
            logger.info(f"  Project ID: {result.get('project_id', 'N/A')}")
            logger.info(f"  Output folder: {result.get('output_folder', 'N/A')}")
            
            # Send desktop notification
            self._send_notification(
                title="SOP Processing Complete",
                message=f"Successfully processed: {result.get('filename', 'unknown')}",
                timeout=10
            )
        else:
            logger.error(f"✗ Processing failed: {result.get('file_path', 'unknown')}")
            logger.error(f"  Error: {result.get('error', 'Unknown error')}")
            
            # Send error notification
            self._send_notification(
                title="SOP Processing Failed",
                message=f"Failed to process: {Path(result.get('file_path', 'unknown')).name}",
                timeout=10
            )
    
    def _send_notification(self, title: str, message: str, timeout: int = 10):
        """
        Send desktop notification.
        
        Args:
            title: Notification title
            message: Notification message
            timeout: Notification timeout in seconds
        """
        if NOTIFICATIONS_AVAILABLE:
            try:
                notification.notify(
                    title=title,
                    message=message,
                    app_name="SOP Processor",
                    timeout=timeout
                )
            except Exception as exc:
                logger.debug(f"Failed to send notification: {exc}")
        else:
            logger.info(f"NOTIFICATION: {title} - {message}")
    
    def set_error_callback(self, callback: Callable):
        """Set callback function for error notifications."""
        self.error_callback = callback
    
    def set_success_callback(self, callback: Callable):
        """Set callback function for success notifications."""
        self.success_callback = callback
    
    async def start_processing_worker(self):
        """Start background worker for processing queued documents."""
        self.is_running = True
        self.event_loop = asyncio.get_running_loop()
        logger.info("Started automation processing worker")
        
        while self.is_running:
            try:
                # Get next file from queue (with timeout to allow checking is_running)
                try:
                    file_path = await asyncio.wait_for(
                        self.processing_queue.get(),
                        timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue
                
                # Process the document
                result = await self.process_new_document(file_path)
                self.notify_completion(result)
                
            except Exception as exc:
                logger.error(f"Error in processing worker: {exc}", exc_info=True)
    
    def stop_processing_worker(self):
        """Stop the background processing worker."""
        self.is_running = False
        self.event_loop = None
        logger.info("Stopped automation processing worker")
    
    def queue_file_from_thread(self, file_path: str):
        """
        Thread-safe method to queue a file for processing.
        Called from watchdog thread.
        
        Args:
            file_path: Path to the file to process
        """
        if self.event_loop and self.is_running:
            # Schedule the coroutine in the event loop from another thread
            asyncio.run_coroutine_threadsafe(
                self.processing_queue.put(file_path),
                self.event_loop
            )
            logger.info(f"Queued file for processing: {file_path}")
        else:
            logger.warning(f"Cannot queue file - worker not running: {file_path}")


class SOPFileHandler(FileSystemEventHandler):
    """File system event handler for SOP documents."""
    
    def __init__(
        self,
        automation_service: AutomationService,
        file_patterns: list[str],
        debounce_seconds: int = 2
    ):
        super().__init__()
        self.automation_service = automation_service
        self.file_patterns = file_patterns
        self.debounce_seconds = debounce_seconds
        self.pending_timers: Dict[str, threading.Timer] = {}
    
    def on_created(self, event: FileCreatedEvent):
        """Handle file creation events."""
        if event.is_directory:
            return
        
        file_path = event.src_path
        
        # Check if file matches patterns
        if not self._matches_patterns(file_path):
            return
        
        logger.info(f"Detected new file: {file_path}")
        
        # Cancel any pending timer for this file
        if file_path in self.pending_timers:
            self.pending_timers[file_path].cancel()
        
        # Schedule processing with debounce using threading.Timer
        timer = threading.Timer(
            self.debounce_seconds,
            self._process_file,
            args=[file_path]
        )
        timer.start()
        self.pending_timers[file_path] = timer
    
    def _process_file(self, file_path: str):
        """Process file after debounce delay (runs in timer thread)."""
        try:
            # Queue file using thread-safe method
            self.automation_service.queue_file_from_thread(file_path)
            
            # Remove from pending
            if file_path in self.pending_timers:
                del self.pending_timers[file_path]
                
        except Exception as exc:
            logger.error(f"Error queueing file {file_path}: {exc}")
    
    def _matches_patterns(self, file_path: str) -> bool:
        """Check if file matches any of the configured patterns."""
        path = Path(file_path)
        
        for pattern in self.file_patterns:
            # Simple pattern matching (*.ext)
            if pattern.startswith('*.'):
                ext = pattern[1:]  # Remove *
                if path.suffix.lower() == ext.lower():
                    return True
            elif pattern == path.name:
                return True
        
        return False
