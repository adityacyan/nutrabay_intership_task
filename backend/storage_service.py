"""StorageService: persists processed SOP results to disk in an organized folder structure.

Folder layout:
  backend/output/
    <doc_name>_<timestamp>/
      metadata.json
      summary/
        <doc_name>_summary.json
      training/
        <doc_name>_training.json
      evaluation/
        <doc_name>_evaluation.json

Requirements: 6.3, 6.4
"""

import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

OUTPUT_DIR = Path(__file__).parent / "output"


def _sanitize(name: str) -> str:
    """Strip extension and replace non-alphanumeric chars with underscores."""
    name = re.sub(r"\.[^/.]+$", "", name)  # strip extension
    name = re.sub(r"[^a-zA-Z0-9_\-]", "_", name)
    name = re.sub(r"_+", "_", name).strip("_").lower()
    return name or "document"


def _timestamp() -> str:
    now = datetime.now(timezone.utc)
    return now.strftime("%Y%m%d_%H%M%S")


class StorageService:
    def __init__(self, output_dir: Path = OUTPUT_DIR):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Save
    # ------------------------------------------------------------------

    def save_result(self, filename: str, generated_content: dict, automated: bool = False) -> dict:
        """
        Persist all generated content to an organized folder structure.

        Returns a project metadata dict that can be sent back to the client.
        """
        base = _sanitize(filename)
        ts = _timestamp()
        project_id = f"{base}_{ts}"
        project_dir = self.output_dir / project_id

        # Create sub-folders
        (project_dir / "summary").mkdir(parents=True, exist_ok=True)
        (project_dir / "training").mkdir(parents=True, exist_ok=True)
        (project_dir / "evaluation").mkdir(parents=True, exist_ok=True)

        # Write each content type
        self._write_json(project_dir / "summary" / f"{base}_summary.json", generated_content.get("summary", {}))
        self._write_json(project_dir / "training" / f"{base}_training.json", generated_content.get("training_material", {}))
        self._write_json(project_dir / "evaluation" / f"{base}_evaluation.json", generated_content.get("evaluation", {}))

        # Build and write metadata
        metadata = {
            "id": project_id,
            "document_name": filename,
            "processed_at": generated_content.get("generated_at", datetime.now(timezone.utc).isoformat()),
            "folder": project_id,
            "content_types": ["summary", "training_material", "evaluation"],
            "source_document": generated_content.get("source_document", {}),
            "automated": automated,  # Flag for automation
        }
        self._write_json(project_dir / "metadata.json", metadata)

        return metadata

    # ------------------------------------------------------------------
    # List / retrieve
    # ------------------------------------------------------------------

    def list_projects(self) -> list[dict]:
        """Return metadata for all saved projects, newest first."""
        projects = []
        for entry in self.output_dir.iterdir():
            if not entry.is_dir():
                continue
            meta_path = entry / "metadata.json"
            if meta_path.exists():
                try:
                    metadata = json.loads(meta_path.read_text(encoding="utf-8"))
                    projects.append(metadata)
                except Exception:
                    pass
        
        # Sort by processed_at timestamp, newest first
        projects.sort(key=lambda p: p.get("processed_at", ""), reverse=True)
        return projects

    def get_project(self, project_id: str) -> Optional[dict]:
        """Return full project data (metadata + all content) for a given project ID."""
        project_dir = self.output_dir / project_id
        if not project_dir.is_dir():
            return None

        meta_path = project_dir / "metadata.json"
        if not meta_path.exists():
            return None

        metadata = json.loads(meta_path.read_text(encoding="utf-8"))
        base = _sanitize(metadata["document_name"])

        result = {"metadata": metadata}

        summary_path = project_dir / "summary" / f"{base}_summary.json"
        if summary_path.exists():
            result["summary"] = json.loads(summary_path.read_text(encoding="utf-8"))

        training_path = project_dir / "training" / f"{base}_training.json"
        if training_path.exists():
            result["training_material"] = json.loads(training_path.read_text(encoding="utf-8"))

        evaluation_path = project_dir / "evaluation" / f"{base}_evaluation.json"
        if evaluation_path.exists():
            result["evaluation"] = json.loads(evaluation_path.read_text(encoding="utf-8"))

        return result

    def delete_project(self, project_id: str) -> bool:
        """Delete a project folder. Returns True if deleted, False if not found."""
        import shutil
        project_dir = self.output_dir / project_id
        if not project_dir.is_dir():
            return False
        shutil.rmtree(project_dir)
        return True

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _write_json(path: Path, data: dict) -> None:
        path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
