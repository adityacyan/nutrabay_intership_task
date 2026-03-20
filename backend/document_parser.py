"""Document parser for extracting text from PDF and plain-text SOP documents."""

import io
import re
import uuid
import chardet
from datetime import datetime
import io
import re
import uuid
import chardet
from datetime import datetime
from typing import Optional

import fitz  # PyMuPDF

from models import (
    ParsedDocument,
    DocumentMetadata,
    ContentStructure,
)


MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
SUPPORTED_MIME_TYPES = {"text/plain", "application/pdf"}


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

class DocumentParser:
    """Parse uploaded SOP documents and return structured data."""

    def validate_file(self, filename: str, file_size: int, content_type: str) -> tuple[bool, str]:
        if file_size > MAX_FILE_SIZE:
            return False, f"File size exceeds limit. Maximum size allowed is {MAX_FILE_SIZE // (1024 * 1024)}MB."

        ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
        is_valid = (
            content_type in SUPPORTED_MIME_TYPES
            or ext in {"txt", "pdf"}
        )
        if not is_valid:
            return False, "Unsupported file format. Please upload text (.txt) or PDF (.pdf) files only."

        return True, ""

    def parse_document(self, filename: str, file_bytes: bytes, content_type: str) -> ParsedDocument:
        ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

        if content_type == "application/pdf" or ext == "pdf":
            content, meta = self._parse_pdf(file_bytes)
        else:
            content, meta = self._parse_text(file_bytes)

        content = content.strip()
        structure = self._analyze_structure(content)

        return ParsedDocument(
            id=uuid.uuid4().hex,
            filename=filename,
            content=content,
            metadata=DocumentMetadata(
                original_size=len(file_bytes),
                mime_type=content_type or "text/plain",
                word_count=_count_words(content),
                line_count=len(content.splitlines()),
                **meta,
            ),
            structure=structure,
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _parse_pdf(self, data: bytes) -> tuple[str, dict]:
        pages: list[str] = []
        total_images = 0
        total_tables = 0
        
        with fitz.open(stream=data, filetype="pdf") as doc:
            page_count = len(doc)
            for page_num, page in enumerate(doc):
                # Extract text with layout preservation
                # Use "blocks" mode to preserve structure better
                text_blocks = page.get_text("blocks")
                
                page_text_parts = []
                for block in text_blocks:
                    # block format: (x0, y0, x1, y1, "text", block_no, block_type)
                    if len(block) >= 5:
                        block_text = block[4]
                        if isinstance(block_text, str) and block_text.strip():
                            page_text_parts.append(block_text.strip())
                
                # Join blocks with newlines to preserve structure
                page_text = "\n".join(page_text_parts)
                
                # Also try to extract text with better formatting
                if not page_text.strip():
                    # Fallback to standard text extraction
                    page_text = page.get_text() or ""
                
                # Count images and tables for metadata
                images = page.get_images()
                total_images += len(images)
                
                # Try to detect tables (simple heuristic: look for grid-like structures)
                if "│" in page_text or "├" in page_text or "┼" in page_text:
                    total_tables += 1
                
                pages.append(page_text)
        
        full_text = "\n\n".join(pages)  # Double newline between pages for better separation
        
        metadata = {
            "page_count": page_count,
            "image_count": total_images,
            "table_count": total_tables,
        }
        
        return full_text, metadata

    def _parse_text(self, data: bytes) -> tuple[str, dict]:
        detected = chardet.detect(data)
        encoding = detected.get("encoding") or "utf-8"
        try:
            content = data.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            content = data.decode("utf-8", errors="replace")
        return content, {"encoding": encoding}

    def _analyze_structure(self, content: str) -> ContentStructure:
        lines = content.splitlines()
        sections: list[dict] = []
        procedures: list[dict] = []
        has_safety = False
        has_numbered = False

        safety_kws = {"safety", "hazard", "warning", "caution", "danger", "ppe", "emergency"}
        current_section: Optional[dict] = None
        section_id = 0

        for i, raw_line in enumerate(lines):
            line = raw_line.strip()
            if not line:
                continue

            if _is_heading(line):
                if current_section:
                    sections.append(current_section)
                section_id += 1
                current_section = {
                    "id": f"section_{section_id}",
                    "title": line,
                    "start_line": i + 1,
                    "step_count": 0,
                    "safety_item_count": 0,
                }
                if any(kw in line.lower() for kw in safety_kws):
                    has_safety = True
            elif _is_procedure_step(line):
                has_numbered = True
                procedures.append({"text": line, "line_number": i + 1})
                if current_section:
                    current_section["step_count"] = current_section.get("step_count", 0) + 1
            elif current_section and any(kw in line.lower() for kw in safety_kws):
                current_section["safety_item_count"] = (
                    current_section.get("safety_item_count", 0) + 1
                )

        if current_section:
            sections.append(current_section)

        title = _extract_title(lines, content)
        doc_type = _identify_doc_type(content)

        return ContentStructure(
            title=title,
            sections=sections,
            total_lines=len(lines),
            word_count=_count_words(content),
            has_numbered_steps=has_numbered,
            has_safety_section=has_safety,
            document_type=doc_type,
            total_steps=len(procedures),
            total_safety_items=sum(s.get("safety_item_count", 0) for s in sections),
        )


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------

def _count_words(text: str) -> int:
    return len(text.split())


def _is_heading(line: str) -> bool:
    if len(line) >= 3 and line == line.upper() and re.match(r"^[A-Z\s]+$", line):
        return True
    if re.match(r"^\d+\.\s+[A-Z]", line) or re.match(r"^[A-Z]\.\s+[A-Z]", line):
        return True
    if re.match(r"^(SECTION|CHAPTER|PART|PROCEDURE|STEP)\s+\d+", line, re.I):
        return True
    return False


def _is_procedure_step(line: str) -> bool:
    return bool(re.match(r"^(step\s+\d+|\d+\.\s)", line, re.I))


def _extract_title(lines: list[str], content: str) -> str:
    for line in lines[:5]:
        stripped = line.strip()
        if stripped and 10 <= len(stripped) <= 100:
            if not _is_procedure_step(stripped) and ":" not in stripped:
                return stripped
    return "Untitled Document"


def _identify_doc_type(content: str) -> str:
    lc = content.lower()
    if "standard operating procedure" in lc or "sop" in lc:
        return "standard_operating_procedure"
    if "work instruction" in lc:
        return "work_instruction"
    if "policy" in lc or "guideline" in lc:
        return "policy_document"
    if "safety" in lc and "procedure" in lc:
        return "safety_procedure"
    if "training" in lc or "manual" in lc:
        return "training_manual"
    return "general_procedure"
