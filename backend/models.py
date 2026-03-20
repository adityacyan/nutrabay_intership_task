"""Pydantic models for SOP Processor API request/response types."""
from typing import Any, Optional
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Document / Parsing
# ---------------------------------------------------------------------------

class DocumentMetadata(BaseModel):
    original_size: int
    mime_type: str
    word_count: int
    line_count: int
    page_count: Optional[int] = None
    encoding: Optional[str] = None


class ProcedureStep(BaseModel):
    id: str
    step_number: int
    content: str
    original_text: str
    section: Optional[str] = None
    line_number: int
    type: str  # numbered, lettered, bulleted, etc.
    is_safety_related: bool = False
    is_compliance_related: bool = False
    # Enhanced metadata for comprehensive AI processing
    surrounding_context: Optional[list[str]] = []
    dependencies: Optional[list[str]] = []
    timing_info: Optional[dict[str, Any]] = {}
    tools_equipment: Optional[list[str]] = []
    quality_checks: Optional[list[str]] = []
    complexity_score: Optional[float] = 0.0
    action_verbs: Optional[list[str]] = []


class ContentStructure(BaseModel):
    title: str
    sections: list[dict[str, Any]] = []
    total_lines: int
    word_count: int
    has_numbered_steps: bool = False
    has_safety_section: bool = False
    document_type: str = "general_procedure"
    total_steps: int = 0
    total_safety_items: int = 0


class ParsedDocument(BaseModel):
    id: str
    filename: str
    content: str
    metadata: DocumentMetadata
    structure: ContentStructure


# ---------------------------------------------------------------------------
# Generated Content
# ---------------------------------------------------------------------------

class TrainingStep(BaseModel):
    step_number: int
    title: str
    description: str
    duration: int  # minutes
    type: str  # introduction, procedure, assessment
    key_points: list[str] = []
    safety_notes: list[str] = []
    # Enhanced training metadata
    complexity_level: Optional[str] = "medium"  # beginner, intermediate, advanced
    required_equipment: Optional[list[str]] = []
    prerequisites: Optional[list[str]] = []


class TrainingMaterial(BaseModel):
    title: str
    learning_objectives: list[str] = []
    steps: list[TrainingStep] = []
    estimated_duration: int  # minutes
    prerequisites: list[str] = []
    materials: list[str] = []
    # Enhanced training metadata
    difficulty_level: Optional[str] = "intermediate"
    safety_emphasis: Optional[bool] = False
    hands_on_components: Optional[int] = 0


class Question(BaseModel):
    id: int
    type: str  # multiple-choice, true-false, scenario, short-answer
    question: str
    options: Optional[list[str]] = None
    correct_answer: Any = None
    explanation: str
    sample_answer: Optional[str] = None
    points: int = 1
    # Enhanced question metadata
    difficulty_level: Optional[str] = "medium"
    topic_area: Optional[str] = "general"
    safety_critical: Optional[bool] = False


class Evaluation(BaseModel):
    title: str
    questions: list[Question] = []
    passing_score: int = 75
    instructions: str
    estimated_time: int  # minutes
    # Enhanced evaluation metadata
    safety_weight: Optional[float] = 0.0
    compliance_requirements: Optional[bool] = False
    practical_components: Optional[int] = 0


class Summary(BaseModel):
    title: str
    overview: str
    key_points: list[str] = []
    safety_requirements: list[str] = []
    procedure_count: int = 0
    estimated_read_time: int  # minutes
    # Enhanced summary metadata
    document_complexity: Optional[float] = 0.0
    safety_complexity: Optional[int] = 0
    compliance_references: Optional[int] = 0
    equipment_count: Optional[int] = 0


class GeneratedContent(BaseModel):
    summary: Summary
    training_material: TrainingMaterial
    evaluation: Evaluation
    source_document: dict[str, str]  # {filename, id}
    generated_at: str


# ---------------------------------------------------------------------------
# API response wrappers
# ---------------------------------------------------------------------------

class ProcessResponse(BaseModel):
    success: bool
    parsed_document: Optional[ParsedDocument] = None
    generated_content: Optional[GeneratedContent] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    gemini_configured: bool
