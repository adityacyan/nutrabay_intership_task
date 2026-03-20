"""AI Processor — Gemini API integration for content generation."""

import os
import asyncio
import json
import re
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL_NAME = "gemini-3.1-flash-lite-preview"

# Try to import google.generativeai; fall back to mock if unavailable / no key
_gemini_available = False
_genai = None
_model = None

if GEMINI_API_KEY:
    try:
        import google.generativeai as genai  # type: ignore
        genai.configure(api_key=GEMINI_API_KEY)
        _model = genai.GenerativeModel(MODEL_NAME)
        _gemini_available = True
        _genai = genai
        print(f"[AI]   Gemini ready | model={MODEL_NAME}")
    except Exception as e:
        print(f"[AI]   Gemini init failed: {e} — using mock")
else:
    print("[AI]   No API key — using mock responses")


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

async def generate_summary(content: str) -> dict:
    """Return {overview, key_points, word_count, complexity}."""
    if _gemini_available and _model:
        return await _gemini_summary(content)
    print("[AI]   generate_summary → mock")
    return _mock_summary(content)


async def create_training_steps(procedures: list[dict], content_hint: str = "") -> list[dict]:
    """Return list of training step dicts."""
    if _gemini_available and _model:
        return await _gemini_training_steps(procedures, content_hint)
    print("[AI]   create_training_steps → mock")
    return _mock_training_steps(procedures)


async def generate_questions(content: str, count: int = 4) -> list[dict]:
    """Return list of question dicts."""
    if _gemini_available and _model:
        return await _gemini_questions(content, count)
    print("[AI]   generate_questions → mock")
    return _mock_questions(count)


# ---------------------------------------------------------------------------
# Gemini implementations
# ---------------------------------------------------------------------------

async def _gemini_summary(content: str) -> dict:
    # Use much more content with 300k token limit - approximately 225k words
    truncated = content[:150000]  # Increased from 4000 to 150k characters
    print(f"[AI]   → summary  ({len(truncated)} chars, ~{len(truncated.split())} words)")
    prompt = f"""Analyze this comprehensive SOP document and return a JSON object with these exact keys:
- "overview": a detailed paragraph of 4-5 sentences providing comprehensive summary of the document's purpose, scope, and key procedures
- "key_points": a JSON array of 8-12 strings, each being a detailed and specific point covering procedures, safety, compliance, and quality aspects
- "complexity": one of the strings "Low" / "Medium" / "High" / "Very High"
- "document_type": classify as one of "laboratory_procedure" / "manufacturing_process" / "safety_procedure" / "maintenance_procedure" / "administrative_procedure"
- "critical_safety_items": array of the most critical safety requirements (up to 5 items)
- "regulatory_compliance": array of regulatory standards or compliance requirements mentioned
- "equipment_requirements": array of key equipment or tools mentioned

Use clear, professional language. Include specific details from the document. Return ONLY the raw JSON object. No extra commentary.

COMPREHENSIVE SOP DOCUMENT:
{truncated}"""
    try:
        response = await asyncio.to_thread(_model.generate_content, prompt)
        raw = re.sub(r"^```(?:json)?\n?", "", response.text.strip()).rstrip("```").strip()
        data = json.loads(raw)
        # Strip emojis from string fields
        for field in ["overview", "complexity", "document_type"]:
            if isinstance(data.get(field), str):
                data[field] = _strip_emojis(data[field])
        for list_field in ["key_points", "critical_safety_items", "regulatory_compliance", "equipment_requirements"]:
            if isinstance(data.get(list_field), list):
                data[list_field] = [_strip_emojis(p) for p in data[list_field] if isinstance(p, str)]
        data.setdefault("word_count", len(content.split()))
        print(f"[AI]   ✓ summary  | complexity={data.get('complexity')} points={len(data.get('key_points', []))} type={data.get('document_type')}")
        return data
    except Exception as e:
        print(f"[AI]   ✗ summary failed: {e} → mock")
        return _mock_summary(content)


async def _gemini_training_steps(procedures: list[dict], content_hint: str) -> list[dict]:
    # Use comprehensive procedure context - much more detailed
    proc_text = ""
    for i, p in enumerate(procedures[:30]):  # Increased from 20 to 30 steps
        context_str = " | ".join(p.get('surrounding_context', [])[:2])
        deps_str = ", ".join(p.get('dependencies', [])[:2])
        tools_str = ", ".join(p.get('tools_equipment', [])[:3])
        
        proc_text += f"""
Procedure {i+1}: {p.get('content') or p.get('original_text', '')}
- Section: {p.get('section', 'N/A')}
- Safety critical: {'Yes' if p.get('is_safety_related') else 'No'}
- Complexity: {p.get('complexity_score', 0):.2f}
- Context: {context_str}
- Dependencies: {deps_str}
- Equipment: {tools_str}
- Actions: {', '.join(p.get('action_verbs', [])[:2])}
"""
    
    # Include comprehensive training context
    full_context = f"""
COMPREHENSIVE TRAINING CONTEXT:
{content_hint[:50000]}  # Use up to 50k characters of context

DETAILED PROCEDURES:
{proc_text}
"""
    
    print(f"[AI]   → training  ({len(procedures)} procedures, {len(full_context)} chars context)")

    prompt = f"""Create a comprehensive structured training guide as a JSON array of step objects for this SOP based on the detailed analysis provided.

Each step object must have:
- "step_number": integer
- "title": descriptive title (50-80 characters)
- "description": detailed 2-3 sentences explaining what the trainee does and why
- "duration": integer number of minutes (realistic estimate)
- "type": one of "introduction" / "safety_briefing" / "procedure" / "quality_check" / "assessment"
- "key_points": array of 3-5 specific, actionable strings
- "safety_notes": array of specific safety considerations (empty array if none)
- "complexity_level": one of "beginner" / "intermediate" / "advanced"
- "required_equipment": array of specific equipment/tools needed
- "prerequisites": array of specific prerequisites for this step

Create 6-12 comprehensive training steps including:
1. Introduction step explaining purpose and scope
2. Safety briefing covering critical safety requirements
3. Multiple detailed procedure steps based on the analysis
4. Quality check steps for verification
5. Final assessment step

Use the comprehensive context provided to create detailed, specific training content. Return ONLY the raw JSON array.

{full_context}"""
    
    try:
        response = await asyncio.to_thread(_model.generate_content, prompt)
        raw = re.sub(r"^```(?:json)?\n?", "", response.text.strip()).rstrip("```").strip()
        steps = json.loads(raw)
        # Clean emojis from all text fields
        for step in steps:
            for field in ("title", "description", "complexity_level"):
                if isinstance(step.get(field), str):
                    step[field] = _strip_emojis(step[field])
            for list_field in ("key_points", "safety_notes", "required_equipment", "prerequisites"):
                if isinstance(step.get(list_field), list):
                    step[list_field] = [_strip_emojis(s) for s in step[list_field] if isinstance(s, str)]
        print(f"[AI]   ✓ training | steps={len(steps)}")
        return steps
    except Exception as e:
        print(f"[AI]   ✗ training failed: {e} → mock")
        return _mock_training_steps(procedures)


async def _gemini_questions(content: str, count: int) -> list[dict]:
    # Use much more content for comprehensive question generation
    truncated = content[:100000]  # Increased from 3500 to 100k characters
    print(f"[AI]   → questions ({count} requested, {len(truncated)} chars, ~{len(truncated.split())} words)")
    prompt = f"""Generate {count} comprehensive evaluation questions as a JSON array for this SOP document. Create diverse, challenging questions that test deep understanding.

Question types to include:
- Multiple-choice (4 options): Test specific knowledge and procedures
- True-false: Test understanding of safety rules and compliance
- Scenario-based (4 options): Test application of procedures in realistic situations
- Short-answer: Test ability to explain processes and safety requirements

Each question object must have:
- "id": integer (1-based)
- "type": one of "multiple-choice" / "true-false" / "scenario" / "short-answer"
- "question": detailed, specific question string (be very specific, reference actual content)
- "options": array of 4 detailed answer strings for multiple-choice/scenario, null for others
- "correct_answer": 0-based integer index for multiple-choice/scenario, boolean for true-false, null for short-answer
- "explanation": comprehensive explanation string (2-3 sentences)
- "difficulty_level": one of "beginner" / "intermediate" / "advanced"
- "topic_area": one of "safety" / "procedure" / "compliance" / "equipment" / "quality"
- "safety_critical": boolean (true if safety-related)
- "points": integer 1-3 based on difficulty

Focus on:
- Critical safety procedures and requirements
- Key procedural steps and their sequence
- Equipment usage and safety considerations
- Compliance and regulatory requirements
- Quality control and verification steps
- Emergency procedures and responses

Make questions specific to the actual document content. Return ONLY the raw JSON array.

COMPREHENSIVE DOCUMENT:
{truncated}"""
    try:
        response = await asyncio.to_thread(_model.generate_content, prompt)
        raw = re.sub(r"^```(?:json)?\n?", "", response.text.strip()).rstrip("```").strip()
        questions = json.loads(raw)
        for i, q in enumerate(questions):
            q["id"] = i + 1
            # Clean emojis from text fields
            for field in ["question", "explanation", "difficulty_level", "topic_area"]:
                if isinstance(q.get(field), str):
                    q[field] = _strip_emojis(q[field])
            if isinstance(q.get("options"), list):
                q["options"] = [_strip_emojis(o) for o in q["options"] if isinstance(o, str)]
        print(f"[AI]   ✓ questions | count={len(questions[:count])}")
        return questions[:count]
    except Exception as e:
        print(f"[AI]   ✗ questions failed: {e} → mock")
        return _mock_questions(count)


# ---------------------------------------------------------------------------
# Emoji stripper — removes emojis from text fields
# ---------------------------------------------------------------------------

def _strip_emojis(text: str) -> str:
    """Remove emojis from text to satisfy strict constraints."""
    # Remove emojis (broad unicode ranges)
    text = re.sub(r"[\U0001F300-\U0001F9FF\u2600-\u26FF\u2700-\u27BF\U0001FA70-\U0001FAFF]", "", text)
    return text.strip()


# ---------------------------------------------------------------------------
# Mock fallbacks (used when Gemini is not configured)
# ---------------------------------------------------------------------------

def _mock_summary(content: str) -> dict:
    sentences = [s.strip() for s in re.split(r"[.!?]+", content) if len(s.strip()) > 10]
    words = content.lower().split()

    stop = {"the","and","or","but","in","on","at","to","for","of","with","by","is","are","was","were","be","been","a","an","this","that"}
    freq: dict[str, int] = {}
    for w in words:
        cw = re.sub(r"[^\w]", "", w)
        if len(cw) > 3 and cw not in stop:
            freq[cw] = freq.get(cw, 0) + 1

    top = sorted(freq, key=freq.get, reverse=True)[:6]  # type: ignore
    
    # Enhanced overview
    overview = (
        f"This Standard Operating Procedure provides comprehensive guidance for essential processes and safety protocols. "
        f"The document covers detailed procedural steps, safety requirements, and compliance standards. "
        f"Key operational areas include: {', '.join(top[:4])}. "
        f"The procedure emphasizes safety compliance and quality control throughout all operations."
    )

    # Enhanced key points
    important = ["must", "shall", "required", "ensure", "safety", "warning", "caution", "critical", "important"]
    key_points = [s for s in sentences if any(kw in s.lower() for kw in important)][:10]
    if not key_points:
        key_points = sentences[:8]

    # Enhanced complexity assessment
    avg_len = len(words) / max(len(sentences), 1)
    technical_terms = len(re.findall(r'\b[A-Z]{2,}\b', content))
    safety_mentions = len([s for s in sentences if any(kw in s.lower() for kw in ["safety", "hazard", "warning"])])
    
    if avg_len > 25 or technical_terms > 20 or safety_mentions > 10:
        complexity = "Very High"
    elif avg_len > 20 or technical_terms > 10 or safety_mentions > 5:
        complexity = "High"
    elif avg_len > 15 or technical_terms > 5:
        complexity = "Medium"
    else:
        complexity = "Low"

    # Document type classification
    content_lower = content.lower()
    type_scores = {
        "laboratory_procedure": sum(1 for kw in ["lab", "laboratory", "sample", "test", "analysis"] if kw in content_lower),
        "manufacturing_process": sum(1 for kw in ["manufacture", "production", "assembly", "quality"] if kw in content_lower),
        "safety_procedure": sum(1 for kw in ["safety", "emergency", "hazard", "protective"] if kw in content_lower),
        "maintenance_procedure": sum(1 for kw in ["maintenance", "repair", "service", "inspection"] if kw in content_lower),
        "administrative_procedure": sum(1 for kw in ["policy", "documentation", "record", "approval"] if kw in content_lower),
    }
    document_type = max(type_scores, key=type_scores.get) if any(type_scores.values()) else "administrative_procedure"

    # Critical safety items
    critical_safety = [s for s in sentences if any(kw in s.lower() for kw in ["danger", "critical", "must", "never", "prohibited"])][:5]
    
    # Equipment requirements
    equipment = list(set(re.findall(r'\b(?:equipment|tool|device|instrument|machine|apparatus)\w*\b', content, re.I)))[:5]

    return {
        "overview": overview,
        "key_points": key_points,
        "word_count": len(words),
        "complexity": complexity,
        "document_type": document_type,
        "critical_safety_items": critical_safety,
        "regulatory_compliance": ["Standard workplace safety regulations", "Industry best practices"],
        "equipment_requirements": equipment or ["Standard workplace equipment"],
    }


def _mock_training_steps(procedures: list[dict]) -> list[dict]:
    steps = [
        {
            "step_number": 1,
            "title": "Introduction and Document Overview",
            "description": "Review the comprehensive purpose, scope, and regulatory context of this SOP. Understand all safety requirements and compliance standards before proceeding with any procedures.",
            "duration": 8,
            "type": "introduction",
            "key_points": [
                "Understand the complete scope and purpose of this procedure",
                "Review all regulatory compliance requirements and standards",
                "Identify all safety hazards and risk mitigation strategies",
                "Ensure all required materials, equipment, and documentation are available",
            ],
            "safety_notes": ["Complete safety briefing required before proceeding"],
            "complexity_level": "beginner",
            "required_equipment": ["SOP documentation", "Safety manual"],
            "prerequisites": ["Basic workplace safety training"],
        },
        {
            "step_number": 2,
            "title": "Safety Briefing and PPE Verification",
            "description": "Conduct comprehensive safety assessment and verify all personal protective equipment is properly fitted and functional. Review emergency procedures and evacuation routes.",
            "duration": 10,
            "type": "safety_briefing",
            "key_points": [
                "Verify all required PPE is available and properly fitted",
                "Review emergency procedures and evacuation routes",
                "Identify location of safety equipment and first aid stations",
                "Confirm understanding of all safety warnings and cautions",
            ],
            "safety_notes": [
                "All PPE must be inspected before use",
                "Emergency contact information must be readily available",
                "Safety equipment locations must be verified",
            ],
            "complexity_level": "intermediate",
            "required_equipment": ["Personal protective equipment", "Safety checklist"],
            "prerequisites": ["PPE training certification"],
        }
    ]
    
    # Add procedure-specific steps
    for idx, proc in enumerate(procedures[:8], start=3):  # Limit to 8 procedures
        content = proc.get("content") or proc.get("original_text", f"Procedure {idx-2}")
        complexity = proc.get("complexity_score", 0.3)
        is_safety = proc.get("is_safety_related", False)
        tools = proc.get("tools_equipment", [])
        
        complexity_level = "advanced" if complexity > 0.7 else "intermediate" if complexity > 0.4 else "beginner"
        duration = max(5, int(len(content.split()) // 15) + (5 if is_safety else 0))
        
        safety_notes = []
        if is_safety:
            safety_notes.append("Follow all safety protocols and use appropriate protective equipment")
            safety_notes.append("Stop immediately if any unsafe conditions are observed")
        
        steps.append({
            "step_number": idx,
            "title": content[:70] + "..." if len(content) > 70 else content,
            "description": f"Execute the detailed procedure: {content}. Ensure all safety requirements are met and quality standards are maintained throughout the process.",
            "duration": duration,
            "type": "procedure",
            "key_points": [
                f"Follow the established procedure: {content[:80]}...",
                "Maintain quality standards throughout the process",
                "Document all observations and measurements",
                "Verify completion criteria before proceeding",
            ],
            "safety_notes": safety_notes,
            "complexity_level": complexity_level,
            "required_equipment": tools[:3] if tools else ["Standard procedure equipment"],
            "prerequisites": ["Completion of previous steps", "Equipment familiarization"],
        })
    
    # Add quality check step
    steps.append({
        "step_number": len(steps) + 1,
        "title": "Quality Verification and Documentation",
        "description": "Perform comprehensive quality checks on all completed procedures. Verify all acceptance criteria are met and document results according to established protocols.",
        "duration": 12,
        "type": "quality_check",
        "key_points": [
            "Verify all procedures completed according to specifications",
            "Check all quality control points and acceptance criteria",
            "Complete all required documentation and records",
            "Identify and address any deviations or non-conformances",
        ],
        "safety_notes": ["Ensure all safety systems remain active during verification"],
        "complexity_level": "intermediate",
        "required_equipment": ["Quality control checklist", "Measurement tools", "Documentation forms"],
        "prerequisites": ["Completion of all procedure steps"],
    })
    
    # Add final assessment step
    steps.append({
        "step_number": len(steps) + 1,
        "title": "Comprehensive Assessment and Knowledge Verification",
        "description": "Complete the comprehensive evaluation to demonstrate mastery of all procedures, safety requirements, and quality standards. Review any areas requiring additional training.",
        "duration": 15,
        "type": "assessment",
        "key_points": [
            "Demonstrate understanding of all procedural steps",
            "Explain safety requirements and emergency procedures",
            "Show competency with required equipment and tools",
            "Complete evaluation questions with passing score",
        ],
        "safety_notes": [],
        "complexity_level": "intermediate",
        "required_equipment": ["Assessment materials", "Evaluation forms"],
        "prerequisites": ["Successful completion of all training steps"],
    })
    
    return steps


def _mock_questions(count: int) -> list[dict]:
    templates = [
        {
            "id": 1, "type": "multiple-choice",
            "question": "What is the most critical safety requirement that must be verified before beginning any procedure in this SOP?",
            "options": [
                "All required personal protective equipment is properly fitted and functional",
                "Work area is clean and organized",
                "All documentation is readily available",
                "Supervisor approval has been obtained",
            ],
            "correct_answer": 0,
            "explanation": "Personal protective equipment verification is the most critical safety step as it directly protects personnel from identified hazards and must be confirmed before any procedural work begins.",
            "difficulty_level": "intermediate",
            "topic_area": "safety",
            "safety_critical": True,
            "points": 2,
        },
        {
            "id": 2, "type": "true-false",
            "question": "All procedural steps in this SOP must be completed in the exact sequence specified, with no deviations permitted without proper authorization and documentation.",
            "options": None,
            "correct_answer": True,
            "explanation": "SOPs are designed with specific sequences to ensure safety, quality, and regulatory compliance. Any deviations must be properly authorized, documented, and risk-assessed.",
            "difficulty_level": "beginner",
            "topic_area": "procedure",
            "safety_critical": True,
            "points": 1,
        },
        {
            "id": 3, "type": "scenario",
            "question": "During a critical procedure, you notice that a required piece of equipment is malfunctioning and producing readings outside acceptable parameters. What is the most appropriate immediate action?",
            "options": [
                "Stop the procedure immediately, secure the work area, and notify your supervisor",
                "Continue with the procedure but document the equipment issue",
                "Try to adjust the equipment settings to bring readings into range",
                "Complete the current step and then address the equipment issue",
            ],
            "correct_answer": 0,
            "explanation": "When equipment malfunctions during critical procedures, immediate cessation is required to prevent safety hazards, quality issues, or regulatory non-compliance. The work area must be secured and supervision notified.",
            "difficulty_level": "advanced",
            "topic_area": "safety",
            "safety_critical": True,
            "points": 3,
        },
        {
            "id": 4, "type": "short-answer",
            "question": "Describe the three most important quality control checkpoints in this SOP and explain why each is critical to the overall process success.",
            "options": None,
            "correct_answer": None,
            "sample_answer": "Key quality checkpoints include: 1) Initial equipment calibration verification to ensure accurate measurements, 2) Mid-process parameter monitoring to detect deviations early, and 3) Final product/result verification against acceptance criteria to confirm specification compliance.",
            "explanation": "Quality control checkpoints are strategically placed to prevent, detect, and correct issues at critical process stages, ensuring consistent results and regulatory compliance.",
            "difficulty_level": "advanced",
            "topic_area": "quality",
            "safety_critical": False,
            "points": 3,
        },
        {
            "id": 5, "type": "multiple-choice",
            "question": "According to this SOP, what is the required response time for reporting any safety incident or near-miss event?",
            "options": [
                "Immediately upon discovery, within 15 minutes",
                "Within 1 hour of the incident",
                "By the end of the work shift",
                "Within 24 hours of the incident",
            ],
            "correct_answer": 0,
            "explanation": "Safety incidents and near-misses require immediate reporting to enable rapid response, investigation, and prevention of similar occurrences. Delays in reporting can compromise safety and regulatory compliance.",
            "difficulty_level": "intermediate",
            "topic_area": "safety",
            "safety_critical": True,
            "points": 2,
        },
        {
            "id": 6, "type": "scenario",
            "question": "You are training a new employee on this SOP. They ask why a particular step seems redundant with a previous step. How should you respond?",
            "options": [
                "Explain that each step serves a specific purpose in ensuring safety, quality, or compliance, even if it appears similar",
                "Agree that it seems redundant and suggest they can skip it once they're experienced",
                "Tell them to just follow the procedure without questioning it",
                "Suggest they ask the supervisor about modifying the procedure",
            ],
            "correct_answer": 0,
            "explanation": "Every step in an SOP has a specific purpose related to safety, quality, or regulatory compliance. Training should emphasize understanding the rationale behind each step to ensure proper execution and compliance.",
            "difficulty_level": "intermediate",
            "topic_area": "procedure",
            "safety_critical": False,
            "points": 2,
        },
        {
            "id": 7, "type": "true-false",
            "question": "Emergency procedures and evacuation routes must be reviewed and confirmed accessible before beginning any work covered by this SOP.",
            "options": None,
            "correct_answer": True,
            "explanation": "Emergency preparedness is a fundamental safety requirement. Personnel must know evacuation routes and emergency procedures before beginning work that could potentially require emergency response.",
            "difficulty_level": "beginner",
            "topic_area": "safety",
            "safety_critical": True,
            "points": 1,
        },
        {
            "id": 8, "type": "multiple-choice",
            "question": "What is the primary purpose of the documentation requirements specified throughout this SOP?",
            "options": [
                "To provide traceability, enable quality control, and ensure regulatory compliance",
                "To create a paper trail for management review",
                "To slow down the process to ensure careful work",
                "To provide training materials for future employees",
            ],
            "correct_answer": 0,
            "explanation": "Documentation serves multiple critical purposes: providing traceability for quality investigations, enabling statistical process control, and demonstrating regulatory compliance to auditors and inspectors.",
            "difficulty_level": "intermediate",
            "topic_area": "compliance",
            "safety_critical": False,
            "points": 2,
        },
    ]
    return templates[:count]
