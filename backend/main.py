"""FastAPI main application for SOP Processor backend."""

import os
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from models import ProcessResponse, HealthResponse, ParsedDocument
from document_parser import DocumentParser
from content_generator import ContentGenerator
from ai_processor import GEMINI_API_KEY

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


@app.post("/api/process", response_model=ProcessResponse)
async def process_document(file: UploadFile = File(...)):
    """Full pipeline: parse document → extract content → generate training materials via AI."""
    content_type = file.content_type or ""
    file_bytes = await file.read()
    print(f"[POST] /api/process | file={file.filename}  size={len(file_bytes)//1024}KB")

    # Validate file
    valid, err = _parser.validate_file(file.filename or "upload", len(file_bytes), content_type)
    if not valid:
        print(f"[FAIL] /api/process | {err}")
        raise HTTPException(status_code=400, detail=err)

    try:
        # Step 1: Parse document
        print(f"[STEP] Parsing document...")
        parsed = _parser.parse_document(file.filename or "upload", file_bytes, content_type)
        print(f"[STEP] Parse done | sections={len(parsed.structure.sections)} words={len(parsed.content.split())}")

        # Step 2: Generate all training content
        print(f"[STEP] Generating AI content (parallel)...")
        generated = await _generator.generate_all_content(parsed)
        print(f"[OK]   /api/process | done")

        return ProcessResponse(
            success=True,
            parsed_document=parsed,
            generated_content=generated,
        )

    except HTTPException:
        raise
    except Exception as exc:
        print(f"[ERR]  /api/process | {exc}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(exc)}")


# ---------------------------------------------------------------------------
# Dev entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
