"""FastAPI main application for SOP Processor backend."""

import os
from typing import Optional
from io import BytesIO
from datetime import datetime, timezone

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from models import ProcessResponse, HealthResponse, ParsedDocument
from document_parser import DocumentParser
from content_generator import ContentGenerator
from storage_service import StorageService
from ai_processor import GEMINI_API_KEY
from automation_service import AutomationService

load_dotenv()
print(f"[BOOT] SOP Processor backend starting | Gemini: {'OK' if GEMINI_API_KEY else 'NOT CONFIGURED'}")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE_MB", "10")) * 1024 * 1024

app = FastAPI(
    title="SOP Processor API",
    description="FastAPI backend for parsing SOP documents and generating training materials using Google Gemini AI.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_parser = DocumentParser()
_generator = ContentGenerator()
_storage = StorageService()
_automation = AutomationService()

# Notification queue for SSE
import asyncio
from collections import deque
_notification_queue = deque(maxlen=100)  # Keep last 100 notifications


# ---------------------------------------------------------------------------
# Models for output generation
# ---------------------------------------------------------------------------

class GenerateRequest(BaseModel):
    content: dict


class AutomationConfigRequest(BaseModel):
    folder_path: str
    file_patterns: Optional[list[str]] = None
    recursive: Optional[bool] = False
    debounce_seconds: Optional[int] = 2


class GoogleDriveFolderRequest(BaseModel):
    folder_id: str
    folder_name: Optional[str] = None
    file_types: Optional[list[str]] = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    print("[GET]  /api/health")
    return HealthResponse(
        status="ok",
        gemini_configured=bool(GEMINI_API_KEY),
    )


@app.post("/api/parse", response_model=ProcessResponse)
async def parse_document(file: UploadFile = File(...)):
    """Parse a document and return its structured content — no AI generation."""
    content_type = file.content_type or ""
    file_bytes = await file.read()
    print(f"[POST] /api/parse  | file={file.filename}  size={len(file_bytes)//1024}KB")

    # Validate
    valid, err = _parser.validate_file(file.filename or "upload", len(file_bytes), content_type)
    if not valid:
        print(f"[FAIL] /api/parse  | {err}")
        raise HTTPException(status_code=400, detail=err)

    try:
        parsed = _parser.parse_document(file.filename or "upload", file_bytes, content_type)
        print(f"[OK]   /api/parse  | sections={len(parsed.structure.sections)}")
        return ProcessResponse(success=True, parsed_document=parsed)
    except Exception as exc:
        print(f"[ERR]  /api/parse  | {exc}")
        raise HTTPException(status_code=500, detail=f"Parsing failed: {str(exc)}")


@app.post("/api/process")
async def process_document(file: UploadFile = File(...)):
    """Full pipeline with streaming: parse document → stream summary → generate training materials."""
    from fastapi.responses import StreamingResponse
    import json
    
    content_type = file.content_type or ""
    file_bytes = await file.read()
    print(f"[POST] /api/process | file={file.filename}  size={len(file_bytes)//1024}KB")

    # Validate file
    valid, err = _parser.validate_file(file.filename or "upload", len(file_bytes), content_type)
    if not valid:
        print(f"[FAIL] /api/process | {err}")
        raise HTTPException(status_code=400, detail=err)

    async def generate_stream():
        """Stream the processing results as Server-Sent Events."""
        try:
            # Step 1: Parse document
            print(f"[STEP] Parsing document...")
            yield f"data: {json.dumps({'type': 'status', 'message': 'Parsing document...', 'step': 'parsing'})}\n\n"
            
            parsed = _parser.parse_document(file.filename or "upload", file_bytes, content_type)
            print(f"[STEP] Parse done | sections={len(parsed.structure.sections)} words={len(parsed.content.split())}")
            
            # Send parsed document
            yield f"data: {json.dumps({'type': 'parsed', 'data': parsed.model_dump()})}\n\n"
            
            # Step 2: Generate summary with character streaming
            print(f"[STEP] Generating summary (character streaming)...")
            yield f"data: {json.dumps({'type': 'status', 'message': 'Generating summary...', 'step': 'extracting'})}\n\n"
            
            # Extract comprehensive structure first
            from content_extractor import ContentExtractor
            extractor = ContentExtractor()
            comprehensive_structure = extractor.extract_comprehensive_structure(parsed.content)
            
            # Prepare AI context
            from content_generator import ContentGenerator
            generator = ContentGenerator()
            ai_context = generator._prepare_comprehensive_ai_context(parsed, comprehensive_structure)
            
            # Stream summary character by character
            from ai_processor import generate_summary_streaming
            
            # Create a list to collect chunks for streaming
            summary_chunks = []
            
            # Define callback that collects chunks
            def collect_chunk(chunk):
                summary_chunks.append(chunk)
            
            # Generate summary with streaming callback
            summary_data = await generate_summary_streaming(
                ai_context["full_content_with_analysis"],
                callback=collect_chunk
            )
            
            # Stream collected chunks to client
            for chunk in summary_chunks:
                yield f"data: {json.dumps({'type': 'summary_chunk', 'text': chunk})}\n\n"
            
            # Build summary object
            summary = generator._build_enhanced_summary(parsed, summary_data, comprehensive_structure)
            
            # Send complete summary
            yield f"data: {json.dumps({'type': 'summary_complete', 'data': summary.model_dump()})}\n\n"
            
            # Step 3: Generate training material
            print(f"[STEP] Generating training material...")
            yield f"data: {json.dumps({'type': 'status', 'message': 'Creating training steps...', 'step': 'formatting'})}\n\n"
            
            from ai_processor import create_training_steps
            procedures_detailed = comprehensive_structure["procedures"]
            training_steps_raw = await create_training_steps(
                procedures_detailed, 
                content_hint=ai_context["training_context"]
            )
            
            training_material = generator._build_enhanced_training(parsed, training_steps_raw, comprehensive_structure)
            
            # Stream training material
            yield f"data: {json.dumps({'type': 'training', 'data': training_material.model_dump()})}\n\n"
            
            # Step 4: Generate evaluation questions
            print(f"[STEP] Generating evaluation questions...")
            yield f"data: {json.dumps({'type': 'status', 'message': 'Creating evaluation questions...', 'step': 'formatting'})}\n\n"
            
            from ai_processor import generate_questions
            questions_raw = await generate_questions(
                ai_context["evaluation_context"], 
                count=5
            )
            
            evaluation = generator._build_enhanced_evaluation(parsed, questions_raw, comprehensive_structure)
            
            # Stream evaluation
            yield f"data: {json.dumps({'type': 'evaluation', 'data': evaluation.model_dump()})}\n\n"
            
            # Step 5: Save to storage
            print(f"[STEP] Saving results to disk...")
            from datetime import datetime, timezone
            from models import GeneratedContent
            
            generated = GeneratedContent(
                summary=summary,
                training_material=training_material,
                evaluation=evaluation,
                source_document={"filename": parsed.filename, "id": parsed.id},
                generated_at=datetime.now(timezone.utc).isoformat(),
            )
            
            project_meta = _storage.save_result(file.filename or "upload", generated.model_dump())
            print(f"[OK]   /api/process | saved project={project_meta['id']}")
            
            # Send completion
            yield f"data: {json.dumps({'type': 'complete', 'project_id': project_meta['id']})}\n\n"
            
        except Exception as exc:
            print(f"[ERR]  /api/process | {exc}")
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


# ---------------------------------------------------------------------------
# Projects (saved results)
# ---------------------------------------------------------------------------

@app.get("/api/projects")
async def list_projects():
    """List all previously processed SOP projects."""
    print("[GET]  /api/projects")
    return {"projects": _storage.list_projects()}


@app.get("/api/projects/{project_id}")
async def get_project(project_id: str):
    """Retrieve full content for a saved project."""
    print(f"[GET]  /api/projects/{project_id}")
    project = _storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str):
    """Delete a saved project."""
    print(f"[DELETE] /api/projects/{project_id}")
    deleted = _storage.delete_project(project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"success": True}


# ---------------------------------------------------------------------------
# Output Generation Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/generate-presentation")
async def generate_presentation(request: GenerateRequest):
    """Generate PowerPoint presentation from content."""
    print("[POST] /api/generate-presentation")
    
    try:
        from output_formatter import OutputFormatter
        formatter = OutputFormatter()
        
        # Generate PPTX file
        pptx_buffer, slide_count = formatter.create_slide_presentation(request.content)
        
        # Return as streaming response
        return StreamingResponse(
            BytesIO(pptx_buffer),
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={
                "Content-Disposition": "attachment; filename=presentation.pptx",
                "X-Slide-Count": str(slide_count)
            }
        )
    except Exception as exc:
        print(f"[ERR]  /api/generate-presentation | {exc}")
        raise HTTPException(status_code=500, detail=f"Presentation generation failed: {str(exc)}")


@app.post("/api/generate-pdf")
async def generate_pdf(request: GenerateRequest):
    """Generate PDF document from content."""
    print("[POST] /api/generate-pdf")
    
    try:
        from output_formatter import OutputFormatter
        formatter = OutputFormatter()
        
        # Generate PDF file
        pdf_buffer, page_count = formatter.generate_pdf(request.content)
        
        # Return as streaming response
        return StreamingResponse(
            BytesIO(pdf_buffer),
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=document.pdf",
                "X-Page-Count": str(page_count)
            }
        )
    except Exception as exc:
        print(f"[ERR]  /api/generate-pdf | {exc}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(exc)}")


# ---------------------------------------------------------------------------
# Automation Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/automation/configure-watcher")
async def configure_folder_watcher(request: AutomationConfigRequest):
    """Configure folder monitoring for automatic SOP processing."""
    print(f"[POST] /api/automation/configure-watcher | folder={request.folder_path}")
    
    try:
        settings = {
            'file_patterns': request.file_patterns or ['*.txt', '*.pdf'],
            'recursive': request.recursive,
            'debounce_seconds': request.debounce_seconds
        }
        
        result = _automation.configure_watcher(request.folder_path, settings)
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['error'])
        
        return result
        
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[ERR]  /api/automation/configure-watcher | {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to configure watcher: {str(exc)}")


@app.delete("/api/automation/watcher/{watch_id}")
async def stop_folder_watcher(watch_id: str):
    """Stop monitoring a specific folder."""
    print(f"[DELETE] /api/automation/watcher/{watch_id}")
    
    # URL decode the watch_id (it's a path)
    from urllib.parse import unquote
    watch_id = unquote(watch_id)
    
    success = _automation.stop_watcher(watch_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Watcher not found")
    
    return {"success": True, "message": f"Stopped monitoring {watch_id}"}


@app.get("/api/automation/watchers")
async def list_active_watchers():
    """List all active folder watchers."""
    print("[GET]  /api/automation/watchers")
    
    watchers = []
    for watch_id, observer in _automation.observers.items():
        watchers.append({
            'watch_id': watch_id,
            'is_alive': observer.is_alive()
        })
    
    return {"watchers": watchers}


@app.post("/api/automation/google-drive/add-folder")
async def add_google_drive_folder(request: GoogleDriveFolderRequest):
    """Add a Google Drive folder to monitor."""
    print(f"[POST] /api/automation/google-drive/add-folder | folder_id={request.folder_id}")
    
    try:
        from google_drive_monitor import GoogleDriveMonitor, GOOGLE_DRIVE_AVAILABLE
        
        if not GOOGLE_DRIVE_AVAILABLE:
            raise HTTPException(
                status_code=501,
                detail="Google Drive API not available. Install required packages: pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client"
            )
        
        # Initialize Google Drive monitor if not already done
        if not hasattr(_automation, 'gdrive_monitor'):
            credentials_path = os.getenv('GOOGLE_DRIVE_CREDENTIALS')
            if not credentials_path:
                raise HTTPException(
                    status_code=400,
                    detail="Google Drive credentials not configured. Set GOOGLE_DRIVE_CREDENTIALS environment variable."
                )
            _automation.gdrive_monitor = GoogleDriveMonitor(credentials_path)
        
        result = _automation.gdrive_monitor.add_folder(
            folder_id=request.folder_id,
            folder_name=request.folder_name,
            file_types=request.file_types
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['error'])
        
        return result
        
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[ERR]  /api/automation/google-drive/add-folder | {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to add Google Drive folder: {str(exc)}")


@app.delete("/api/automation/google-drive/folder/{folder_id}")
async def remove_google_drive_folder(folder_id: str):
    """Remove a Google Drive folder from monitoring."""
    print(f"[DELETE] /api/automation/google-drive/folder/{folder_id}")
    
    if not hasattr(_automation, 'gdrive_monitor'):
        raise HTTPException(status_code=404, detail="Google Drive monitoring not configured")
    
    success = _automation.gdrive_monitor.remove_folder(folder_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    return {"success": True, "message": f"Removed folder {folder_id} from monitoring"}


@app.get("/api/automation/google-drive/status")
async def get_google_drive_status():
    """Get Google Drive monitoring status."""
    print("[GET]  /api/automation/google-drive/status")
    
    if not hasattr(_automation, 'gdrive_monitor'):
        return {
            "configured": False,
            "message": "Google Drive monitoring not configured"
        }
    
    status = _automation.gdrive_monitor.get_status()
    status['configured'] = True
    
    return status


@app.post("/api/automation/start-worker")
async def start_automation_worker():
    """Start the background automation processing worker."""
    print("[POST] /api/automation/start-worker")
    
    if _automation.is_running:
        return {"success": False, "message": "Worker already running"}
    
    # Set up callbacks for notifications
    async def on_success(file_path, project_meta):
        notification = {
            'type': 'success',
            'message': f"Successfully processed: {project_meta['document_name']}",
            'project_id': project_meta['id'],
            'filename': project_meta['document_name'],
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        _notification_queue.append(notification)
        print(f"[NOTIFICATION] Success: {project_meta['document_name']}")
    
    async def on_error(file_path, error_msg):
        from pathlib import Path
        notification = {
            'type': 'error',
            'message': f"Failed to process: {Path(file_path).name}",
            'error': error_msg,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        _notification_queue.append(notification)
        print(f"[NOTIFICATION] Error: {Path(file_path).name}")
    
    async def on_start(file_path, filename):
        notification = {
            'type': 'info',
            'message': f"Started processing: {filename}",
            'filename': filename,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        _notification_queue.append(notification)
        print(f"[NOTIFICATION] Started: {filename}")
    
    _automation.set_success_callback(on_success)
    _automation.set_error_callback(on_error)
    _automation.set_start_callback(on_start)
    
    # Start worker in background
    import asyncio
    asyncio.create_task(_automation.start_processing_worker())
    
    return {"success": True, "message": "Automation worker started"}


@app.post("/api/automation/stop-worker")
async def stop_automation_worker():
    """Stop the background automation processing worker."""
    print("[POST] /api/automation/stop-worker")
    
    if not _automation.is_running:
        return {"success": False, "message": "Worker not running"}
    
    _automation.stop_processing_worker()
    
    return {"success": True, "message": "Automation worker stopped"}


@app.get("/api/automation/notifications")
async def get_notifications():
    """Get recent automation notifications."""
    print("[GET]  /api/automation/notifications")
    return {"notifications": list(_notification_queue)}


# ---------------------------------------------------------------------------
# Dev entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
