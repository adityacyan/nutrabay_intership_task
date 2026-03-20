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

async def generate_summary_streaming(content: str, callback=None):
    """Generate summary with character-by-character streaming like ChatGPT."""
    # Use much more content with 2M token limit
    truncated = content[:750000]
    
    # Detect document context/industry
    content_lower = truncated.lower()
    industry_context = _detect_industry_context(content_lower)
    
    print(f"[AI]   → summary (streaming) ({len(truncated)} chars, ~{len(truncated.split())} words, industry={industry_context})")
    
    # Tailor prompt based on industry
    industry_specific_guidance = _get_industry_specific_guidance(industry_context)
    
    prompt = f"""You are analyzing a Standard Operating Procedure (SOP) document from a {industry_context} environment.

{industry_specific_guidance}

Analyze this comprehensive SOP document and return a COMPLETE JSON object with ALL fields fully populated. Do not truncate or cut off any content.

CRITICAL INSTRUCTIONS:
1. Generate COMPLETE responses for ALL fields
2. Do NOT truncate arrays or text mid-sentence
3. Ensure ALL key_points are complete sentences
4. Ensure ALL safety items are complete descriptions
5. Provide FULL equipment lists
6. Complete ALL regulatory compliance references

Return a JSON object with these exact keys:
- "overview": a detailed paragraph of 4-5 COMPLETE sentences providing comprehensive summary of the document's purpose, scope, and key procedures. Focus on {_get_industry_focus(industry_context)}. MUST be 150-250 words.
- "key_points": a JSON array of exactly 8-12 strings, each being a COMPLETE detailed point (20-40 words each) covering procedures, safety, compliance, and quality aspects relevant to {industry_context}
- "complexity": one of the strings "Low" / "Medium" / "High" / "Very High"
- "document_type": classify as one of "laboratory_procedure" / "manufacturing_process" / "safety_procedure" / "maintenance_procedure" / "administrative_procedure" / "software_development_procedure" / "quality_control_procedure"
- "critical_safety_items": array of 3-5 COMPLETE critical safety requirements (each 15-30 words) - emphasize {_get_safety_focus(industry_context)}
- "regulatory_compliance": array of 2-5 COMPLETE regulatory standards or compliance requirements mentioned (e.g., {_get_compliance_examples(industry_context)})
- "equipment_requirements": array of 3-8 COMPLETE equipment, tools, or systems descriptions

FORMATTING REQUIREMENTS:
- Use proper punctuation and complete sentences
- Each array item must be a complete, standalone statement
- No truncated text or incomplete thoughts
- Professional, clear language appropriate for {industry_context}

Return ONLY the raw JSON object. No markdown formatting, no code blocks, no extra commentary.

COMPREHENSIVE SOP DOCUMENT:
{truncated}"""
    
    try:
        if _gemini_available and _model:
            # Use streaming API
            response = _model.generate_content(prompt, stream=True)
            
            accumulated_text = ""
            for chunk in response:
                if chunk.text:
                    accumulated_text += chunk.text
                    # Stream each character to callback (synchronous callback)
                    if callback:
                        callback(chunk.text)
            
            # Parse the complete accumulated response
            raw = re.sub(r"^```(?:json)?\n?", "", accumulated_text.strip()).rstrip("```").strip()
            data = json.loads(raw)
            
            # Strip emojis from string fields
            for field in ["overview", "complexity", "document_type"]:
                if isinstance(data.get(field), str):
                    data[field] = _strip_emojis(data[field])
            for list_field in ["key_points", "critical_safety_items", "regulatory_compliance", "equipment_requirements"]:
                if isinstance(data.get(list_field), list):
                    data[list_field] = [_strip_emojis(p) for p in data[list_field] if isinstance(p, str)]
            
            data.setdefault("word_count", len(content.split()))
            print(f"[AI]   ✓ summary (streamed) | complexity={data.get('complexity')} points={len(data.get('key_points', []))} type={data.get('document_type')}")
            return data
        else:
            # Fallback to non-streaming
            return await _gemini_summary(content)
            
    except Exception as e:
        print(f"[AI]   ✗ summary streaming failed: {e} → fallback")
        return await _gemini_summary(content)


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
    # Use much more content with 2M token limit - approximately 1.5M words
    # Gemini 2.0 Flash has 1M token context, so we use ~750k characters (~560k words)
    truncated = content[:750000]  # Increased from 150k to 750k characters
    
    # Detect document context/industry
    content_lower = truncated.lower()
    industry_context = _detect_industry_context(content_lower)
    
    print(f"[AI]   → summary  ({len(truncated)} chars, ~{len(truncated.split())} words, industry={industry_context})")
    
    # Tailor prompt based on industry
    industry_specific_guidance = _get_industry_specific_guidance(industry_context)
    
    prompt = f"""You are analyzing a Standard Operating Procedure (SOP) document from a {industry_context} environment.

{industry_specific_guidance}

Analyze this comprehensive SOP document and return a JSON object with these exact keys:
- "overview": a detailed paragraph of 4-5 sentences providing comprehensive summary of the document's purpose, scope, and key procedures. Focus on {_get_industry_focus(industry_context)}.
- "key_points": a JSON array of 8-12 strings, each being a detailed and specific point covering procedures, safety, compliance, and quality aspects relevant to {industry_context}
- "complexity": one of the strings "Low" / "Medium" / "High" / "Very High"
- "document_type": classify as one of "laboratory_procedure" / "manufacturing_process" / "safety_procedure" / "maintenance_procedure" / "administrative_procedure" / "software_development_procedure" / "quality_control_procedure"
- "critical_safety_items": array of the most critical safety requirements (up to 5 items) - emphasize {_get_safety_focus(industry_context)}
- "regulatory_compliance": array of regulatory standards or compliance requirements mentioned (e.g., {_get_compliance_examples(industry_context)})
- "equipment_requirements": array of key equipment, tools, or systems mentioned

Use clear, professional language appropriate for {industry_context}. Include specific details from the document. Return ONLY the raw JSON object. No extra commentary.

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
    # Detect industry context from content
    content_lower = content_hint.lower()
    industry_context = _detect_industry_context(content_lower)
    
    # Use comprehensive procedure context - much more detailed
    proc_text = ""
    for i, p in enumerate(procedures[:50]):  # Increased from 30 to 50 steps
        context_str = " | ".join(p.get('surrounding_context', [])[:3])
        deps_str = ", ".join(p.get('dependencies', [])[:3])
        tools_str = ", ".join(p.get('tools_equipment', [])[:5])
        
        proc_text += f"""
Procedure {i+1}: {p.get('content') or p.get('original_text', '')}
- Section: {p.get('section', 'N/A')}
- Safety critical: {'Yes' if p.get('is_safety_related') else 'No'}
- Complexity: {p.get('complexity_score', 0):.2f}
- Context: {context_str}
- Dependencies: {deps_str}
- Equipment: {tools_str}
- Actions: {', '.join(p.get('action_verbs', [])[:3])}
"""
    
    # Include comprehensive training context - use up to 500k characters
    full_context = f"""
COMPREHENSIVE TRAINING CONTEXT:
{content_hint[:500000]}  # Increased from 50k to 500k characters

DETAILED PROCEDURES:
{proc_text}
"""
    
    print(f"[AI]   → training  ({len(procedures)} procedures, {len(full_context)} chars context, industry={industry_context})")

    # Industry-specific training guidance
    training_guidance = _get_training_guidance(industry_context)
    role_specific_examples = _get_role_examples(industry_context)

    prompt = f"""You are creating a comprehensive training guide for a {industry_context} environment.

{training_guidance}

Create a structured training guide as a JSON array of step objects for this SOP based on the detailed analysis provided.

INDUSTRY-SPECIFIC CONSIDERATIONS FOR {industry_context.upper()}:
{role_specific_examples}

Each step object must have:
- "step_number": integer
- "title": descriptive title (50-80 characters) - use terminology appropriate for {industry_context}
- "description": detailed 2-3 sentences explaining what the trainee does and why, using language familiar to {industry_context} professionals
- "duration": integer number of minutes (realistic estimate for {industry_context} environment)
- "type": one of "introduction" / "safety_briefing" / "procedure" / "quality_check" / "assessment" / "hands_on_practice"
- "key_points": array of 3-5 specific, actionable strings relevant to {industry_context}
- "safety_notes": array of specific safety considerations (empty array if none) - emphasize {_get_safety_focus(industry_context)}
- "complexity_level": one of "beginner" / "intermediate" / "advanced"
- "required_equipment": array of specific equipment/tools/systems needed
- "prerequisites": array of specific prerequisites for this step

Create 8-15 comprehensive training steps including:
1. Introduction step explaining purpose, scope, and relevance to {industry_context}
2. Safety briefing covering critical safety requirements for {industry_context}
3. Multiple detailed procedure steps based on the analysis
4. Hands-on practice steps where applicable
5. Quality check/verification steps
6. Final assessment step

Use industry-appropriate terminology and examples. Make training practical and role-specific. Return ONLY the raw JSON array.

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
    # Detect industry context
    content_lower = content.lower()
    industry_context = _detect_industry_context(content_lower)
    
    # Use much more content for comprehensive question generation
    truncated = content[:500000]  # Increased from 100k to 500k characters
    print(f"[AI]   → questions ({count} requested, {len(truncated)} chars, ~{len(truncated.split())} words, industry={industry_context})")
    
    # Industry-specific evaluation guidance
    evaluation_guidance = _get_evaluation_guidance(industry_context)
    scenario_examples = _get_scenario_examples(industry_context)
    
    prompt = f"""You are creating an evaluation assessment for a {industry_context} environment.

{evaluation_guidance}

Generate {count} comprehensive evaluation questions as a JSON array for this SOP document. Create diverse, challenging questions that test deep understanding in a {industry_context} context.

INDUSTRY-SPECIFIC EVALUATION FOCUS FOR {industry_context.upper()}:
{scenario_examples}

Question types to include:
- Multiple-choice (4 options): Test specific knowledge and procedures relevant to {industry_context}
- True-false: Test understanding of safety rules, compliance, and best practices
- Scenario-based (4 options): Test application of procedures in realistic {industry_context} situations
- Short-answer: Test ability to explain processes and requirements

Each question object must have:
- "id": integer (1-based)
- "type": one of "multiple-choice" / "true-false" / "scenario" / "short-answer"
- "question": detailed, specific question string using {industry_context} terminology and scenarios
- "options": array of 4 detailed answer strings for multiple-choice/scenario, null for others
- "correct_answer": 0-based integer index for multiple-choice/scenario, boolean for true-false, null for short-answer
- "explanation": comprehensive explanation string (2-3 sentences) with {industry_context} context
- "difficulty_level": one of "beginner" / "intermediate" / "advanced"
- "topic_area": one of "safety" / "procedure" / "compliance" / "equipment" / "quality" / "troubleshooting" / "best_practices"
- "safety_critical": boolean (true if safety-related)
- "points": integer 1-3 based on difficulty

Focus on {industry_context}-specific areas:
- Critical safety procedures and requirements for {industry_context}
- Key procedural steps and their sequence
- Equipment/system usage and safety considerations
- Compliance and regulatory requirements
- Quality control and verification steps
- Common issues and troubleshooting
- Best practices and industry standards

Make questions specific to the actual document content and realistic for {industry_context} professionals. Return ONLY the raw JSON array.

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
# Industry Context Detection and Guidance
# ---------------------------------------------------------------------------

def _detect_industry_context(content_lower: str) -> str:
    """Detect the industry/domain context from document content."""
    
    # Define industry indicators with weighted scoring
    industry_indicators = {
        "software_development": [
            ("code", 3), ("software", 3), ("development", 2), ("programming", 3), 
            ("git", 3), ("repository", 2), ("deployment", 2), ("api", 2),
            ("testing", 1), ("debug", 2), ("version control", 3), ("agile", 2),
            ("sprint", 2), ("pull request", 3), ("merge", 2), ("branch", 2),
            ("ci/cd", 3), ("docker", 3), ("kubernetes", 3), ("devops", 3)
        ],
        "manufacturing": [
            ("manufacturing", 3), ("production", 2), ("assembly", 3), ("machine", 2),
            ("quality control", 2), ("defect", 2), ("batch", 2), ("line", 1),
            ("operator", 2), ("tooling", 2), ("cnc", 3), ("fabrication", 3),
            ("welding", 3), ("molding", 3), ("casting", 3), ("machining", 3),
            ("inventory", 1), ("warehouse", 2), ("shipping", 1)
        ],
        "laboratory": [
            ("laboratory", 3), ("lab", 2), ("sample", 2), ("test", 1), ("analysis", 2),
            ("chemical", 2), ("reagent", 3), ("pipette", 3), ("centrifuge", 3),
            ("microscope", 3), ("specimen", 3), ("culture", 2), ("assay", 3),
            ("titration", 3), ("chromatography", 3), ("spectroscopy", 3),
            ("incubation", 3), ("sterilization", 2), ("contamination", 2)
        ],
        "healthcare": [
            ("patient", 3), ("medical", 3), ("clinical", 3), ("diagnosis", 3),
            ("treatment", 2), ("medication", 3), ("dosage", 3), ("physician", 3),
            ("nurse", 3), ("hospital", 2), ("clinic", 2), ("surgery", 3),
            ("infection control", 3), ("hipaa", 3), ("vital signs", 3),
            ("prescription", 3), ("therapy", 2), ("examination", 2)
        ],
        "food_service": [
            ("food", 2), ("kitchen", 3), ("cooking", 3), ("preparation", 1),
            ("sanitation", 3), ("hygiene", 3), ("temperature", 1), ("storage", 1),
            ("allergen", 3), ("cross-contamination", 3), ("haccp", 3),
            ("food safety", 3), ("serving", 2), ("menu", 2), ("recipe", 2)
        ],
        "it_operations": [
            ("server", 2), ("network", 2), ("database", 2), ("backup", 2),
            ("security", 1), ("firewall", 3), ("monitoring", 1), ("incident", 1),
            ("ticket", 2), ("infrastructure", 2), ("cloud", 2), ("aws", 3),
            ("azure", 3), ("linux", 3), ("windows server", 3), ("active directory", 3),
            ("vpn", 3), ("dns", 3), ("dhcp", 3)
        ],
        "construction": [
            ("construction", 3), ("building", 1), ("site", 1), ("contractor", 3),
            ("excavation", 3), ("concrete", 3), ("foundation", 2), ("framing", 3),
            ("scaffold", 3), ("crane", 3), ("blueprint", 3), ("permit", 2),
            ("inspection", 1), ("structural", 2), ("electrical", 1), ("plumbing", 2)
        ],
        "retail": [
            ("customer", 2), ("sales", 2), ("cashier", 3), ("register", 2),
            ("merchandise", 3), ("inventory", 1), ("stock", 1), ("display", 2),
            ("return", 1), ("refund", 2), ("pos", 3), ("transaction", 2),
            ("pricing", 2), ("promotion", 2), ("store", 1)
        ],
    }
    
    # Calculate scores for each industry
    industry_scores = {}
    for industry, indicators in industry_indicators.items():
        score = 0
        for keyword, weight in indicators:
            count = content_lower.count(keyword)
            score += count * weight
        industry_scores[industry] = score
    
    # Get the industry with highest score
    max_score = max(industry_scores.values())
    if max_score == 0:
        return "general_workplace"
    
    detected_industry = max(industry_scores, key=industry_scores.get)
    
    # Require minimum threshold
    if max_score < 5:
        return "general_workplace"
    
    return detected_industry


def _get_industry_specific_guidance(industry: str) -> str:
    """Get industry-specific guidance for summary generation."""
    guidance = {
        "software_development": """
This is a software development procedure. Focus on:
- Code quality, testing, and deployment processes
- Version control and collaboration workflows
- Security considerations and best practices
- Development environment setup and configuration
- CI/CD pipeline and automation
- Documentation and code review standards""",
        
        "manufacturing": """
This is a manufacturing procedure. Focus on:
- Production line operations and workflow
- Quality control checkpoints and tolerances
- Equipment operation and maintenance
- Safety protocols for machinery and materials
- Inventory management and material handling
- Defect prevention and corrective actions""",
        
        "laboratory": """
This is a laboratory procedure. Focus on:
- Sample handling and preparation techniques
- Equipment calibration and operation
- Chemical safety and hazard management
- Contamination prevention and sterile technique
- Data recording and result interpretation
- Waste disposal and environmental controls""",
        
        "healthcare": """
This is a healthcare procedure. Focus on:
- Patient safety and care protocols
- Infection control and hygiene standards
- Medical equipment usage and sterilization
- Documentation and HIPAA compliance
- Emergency response procedures
- Medication administration and dosing""",
        
        "food_service": """
This is a food service procedure. Focus on:
- Food safety and sanitation standards
- Temperature control and monitoring
- Cross-contamination prevention
- Allergen management and labeling
- HACCP principles and critical control points
- Personal hygiene and handwashing protocols""",
        
        "it_operations": """
This is an IT operations procedure. Focus on:
- System reliability and uptime requirements
- Security protocols and access controls
- Backup and disaster recovery procedures
- Incident response and troubleshooting
- Change management and documentation
- Monitoring and alerting configurations""",
        
        "construction": """
This is a construction procedure. Focus on:
- Site safety and hazard identification
- Equipment operation and inspection
- Building codes and permit requirements
- Material handling and storage
- Fall protection and PPE requirements
- Quality inspections and documentation""",
        
        "retail": """
This is a retail procedure. Focus on:
- Customer service standards and protocols
- Point-of-sale operations and transactions
- Inventory management and stock control
- Loss prevention and security measures
- Return and refund policies
- Store opening and closing procedures""",
        
        "general_workplace": """
This is a general workplace procedure. Focus on:
- Clear step-by-step instructions
- Safety requirements and precautions
- Quality standards and verification
- Compliance with regulations
- Equipment and resource requirements
- Documentation and record-keeping"""
    }
    
    return guidance.get(industry, guidance["general_workplace"])


def _get_industry_focus(industry: str) -> str:
    """Get the main focus area for each industry."""
    focus = {
        "software_development": "code quality, deployment processes, and development best practices",
        "manufacturing": "production efficiency, quality control, and equipment safety",
        "laboratory": "sample integrity, analytical accuracy, and contamination prevention",
        "healthcare": "patient safety, infection control, and clinical protocols",
        "food_service": "food safety, sanitation, and allergen management",
        "it_operations": "system reliability, security, and incident response",
        "construction": "site safety, building codes, and quality standards",
        "retail": "customer service, transaction accuracy, and loss prevention",
        "general_workplace": "safety, quality, and compliance"
    }
    return focus.get(industry, focus["general_workplace"])


def _get_safety_focus(industry: str) -> str:
    """Get safety focus for each industry."""
    safety = {
        "software_development": "data security, access controls, and secure coding practices",
        "manufacturing": "machine guarding, lockout/tagout, and material handling safety",
        "laboratory": "chemical hazards, biological safety, and contamination control",
        "healthcare": "infection control, patient safety, and medical waste disposal",
        "food_service": "food safety, cross-contamination, and allergen controls",
        "it_operations": "cybersecurity, data protection, and system access controls",
        "construction": "fall protection, equipment safety, and site hazards",
        "retail": "workplace violence prevention, robbery response, and customer safety",
        "general_workplace": "general workplace safety and hazard prevention"
    }
    return safety.get(industry, safety["general_workplace"])


def _get_compliance_examples(industry: str) -> str:
    """Get compliance examples for each industry."""
    compliance = {
        "software_development": "ISO 27001, SOC 2, GDPR, PCI DSS",
        "manufacturing": "ISO 9001, OSHA, EPA, industry-specific standards",
        "laboratory": "ISO 17025, CLIA, GLP, safety data sheets",
        "healthcare": "HIPAA, Joint Commission, CDC guidelines, state regulations",
        "food_service": "FDA Food Code, HACCP, local health department",
        "it_operations": "ISO 27001, NIST, SOC 2, GDPR, HIPAA",
        "construction": "OSHA, building codes, ADA, environmental regulations",
        "retail": "PCI DSS, ADA, OSHA, consumer protection laws",
        "general_workplace": "OSHA, EPA, industry standards"
    }
    return compliance.get(industry, compliance["general_workplace"])


def _get_training_guidance(industry: str) -> str:
    """Get training-specific guidance for each industry."""
    guidance = {
        "software_development": """
Create training that emphasizes:
- Hands-on coding exercises and practical examples
- Code review and collaboration workflows
- Testing methodologies and debugging techniques
- Security best practices and common vulnerabilities
- Tool usage and development environment setup
- Real-world scenarios and edge cases""",
        
        "manufacturing": """
Create training that emphasizes:
- Hands-on equipment operation and practice
- Quality inspection techniques and measurements
- Safety procedures and emergency response
- Troubleshooting common production issues
- Standard work and continuous improvement
- Visual aids and step-by-step demonstrations""",
        
        "laboratory": """
Create training that emphasizes:
- Proper technique demonstration and practice
- Equipment operation and calibration
- Safety protocols and emergency procedures
- Quality control and result validation
- Documentation and record-keeping
- Contamination prevention and sterile technique""",
        
        "healthcare": """
Create training that emphasizes:
- Patient-centered care and communication
- Infection control and hand hygiene
- Proper use of medical equipment
- Documentation and compliance requirements
- Emergency response and critical thinking
- Ethical considerations and patient privacy""",
        
        "food_service": """
Create training that emphasizes:
- Food safety and sanitation practices
- Proper food handling techniques
- Temperature monitoring and control
- Cross-contamination prevention
- Allergen awareness and management
- Personal hygiene and handwashing""",
        
        "it_operations": """
Create training that emphasizes:
- System architecture and dependencies
- Troubleshooting methodologies
- Security protocols and access management
- Incident response procedures
- Documentation and change management
- Monitoring and alerting systems""",
        
        "construction": """
Create training that emphasizes:
- Hazard recognition and prevention
- Proper use of tools and equipment
- Fall protection and PPE requirements
- Blueprint reading and specifications
- Quality standards and inspections
- Emergency response and first aid""",
        
        "retail": """
Create training that emphasizes:
- Customer service skills and scenarios
- POS system operation and transactions
- Product knowledge and merchandising
- Loss prevention and security awareness
- Conflict resolution and de-escalation
- Store policies and procedures""",
        
        "general_workplace": """
Create training that emphasizes:
- Clear procedural steps and demonstrations
- Safety awareness and hazard recognition
- Quality standards and verification
- Practical application and practice
- Common issues and troubleshooting
- Documentation and compliance"""
    }
    return guidance.get(industry, guidance["general_workplace"])


def _get_role_examples(industry: str) -> str:
    """Get role-specific examples for training."""
    examples = {
        "software_development": """
- For junior developers: Focus on coding standards, testing basics, and tool usage
- For senior developers: Emphasize architecture decisions, code review, and mentoring
- For DevOps engineers: Focus on deployment pipelines, monitoring, and infrastructure
- Include practical coding examples and common pitfalls""",
        
        "manufacturing": """
- For machine operators: Focus on equipment operation, safety, and quality checks
- For quality inspectors: Emphasize measurement techniques and defect identification
- For supervisors: Focus on line management, troubleshooting, and continuous improvement
- Include visual aids and hands-on practice opportunities""",
        
        "laboratory": """
- For lab technicians: Focus on technique, equipment operation, and safety
- For analysts: Emphasize data interpretation, quality control, and troubleshooting
- For supervisors: Focus on compliance, training, and quality assurance
- Include demonstration videos and practice exercises""",
        
        "healthcare": """
- For nurses: Focus on patient care, medication administration, and documentation
- For physicians: Emphasize clinical decision-making and protocols
- For support staff: Focus on patient interaction, safety, and assistance
- Include patient scenarios and critical thinking exercises""",
        
        "food_service": """
- For line cooks: Focus on food preparation, safety, and quality
- For servers: Emphasize customer service, allergen awareness, and order accuracy
- For managers: Focus on food safety compliance, training, and operations
- Include practical demonstrations and sanitation checks""",
        
        "it_operations": """
- For system administrators: Focus on server management, security, and troubleshooting
- For network engineers: Emphasize network configuration, monitoring, and security
- For support staff: Focus on incident response, documentation, and escalation
- Include real-world scenarios and hands-on labs""",
        
        "construction": """
- For laborers: Focus on safety, tool usage, and basic techniques
- For skilled trades: Emphasize craft-specific skills and quality standards
- For supervisors: Focus on site management, safety compliance, and coordination
- Include safety demonstrations and equipment operation""",
        
        "retail": """
- For sales associates: Focus on customer service, product knowledge, and transactions
- For cashiers: Emphasize POS operation, accuracy, and loss prevention
- For managers: Focus on operations, team leadership, and problem resolution
- Include customer interaction scenarios and role-playing""",
        
        "general_workplace": """
- For new employees: Focus on basic procedures, safety, and expectations
- For experienced staff: Emphasize efficiency, quality, and best practices
- For supervisors: Focus on oversight, training, and compliance
- Include practical examples and common scenarios"""
    }
    return examples.get(industry, examples["general_workplace"])


def _get_evaluation_guidance(industry: str) -> str:
    """Get evaluation-specific guidance for each industry."""
    guidance = {
        "software_development": """
Create assessments that test:
- Understanding of code quality and best practices
- Knowledge of security vulnerabilities and mitigations
- Ability to troubleshoot and debug issues
- Understanding of deployment and CI/CD processes
- Knowledge of version control workflows
- Practical problem-solving skills""",
        
        "manufacturing": """
Create assessments that test:
- Equipment operation knowledge and safety
- Quality control procedures and tolerances
- Troubleshooting common production issues
- Understanding of safety protocols
- Knowledge of standard work procedures
- Ability to identify and prevent defects""",
        
        "laboratory": """
Create assessments that test:
- Proper technique and methodology
- Equipment operation and calibration
- Safety protocols and emergency response
- Quality control and result interpretation
- Contamination prevention measures
- Documentation and compliance requirements""",
        
        "healthcare": """
Create assessments that test:
- Patient safety and care protocols
- Infection control procedures
- Medical equipment usage
- Emergency response procedures
- Documentation and HIPAA compliance
- Clinical decision-making skills""",
        
        "food_service": """
Create assessments that test:
- Food safety and sanitation knowledge
- Temperature control requirements
- Cross-contamination prevention
- Allergen management procedures
- Personal hygiene standards
- HACCP critical control points""",
        
        "it_operations": """
Create assessments that test:
- System architecture understanding
- Security protocols and access controls
- Incident response procedures
- Troubleshooting methodologies
- Backup and recovery processes
- Change management procedures""",
        
        "construction": """
Create assessments that test:
- Safety hazard identification
- Equipment operation and inspection
- Building code requirements
- Fall protection procedures
- PPE selection and usage
- Emergency response protocols""",
        
        "retail": """
Create assessments that test:
- Customer service standards
- POS operation and transactions
- Loss prevention procedures
- Return and refund policies
- Product knowledge
- Conflict resolution skills""",
        
        "general_workplace": """
Create assessments that test:
- Procedural knowledge and understanding
- Safety awareness and protocols
- Quality standards and verification
- Compliance requirements
- Problem-solving abilities
- Documentation procedures"""
    }
    return guidance.get(industry, guidance["general_workplace"])


def _get_scenario_examples(industry: str) -> str:
    """Get scenario examples for evaluation questions."""
    scenarios = {
        "software_development": """
Example scenarios to test:
- A production deployment fails - what steps should be taken?
- A security vulnerability is discovered - how should it be handled?
- Code review reveals issues - what is the proper response?
- A critical bug is reported - what is the escalation process?
- Merge conflicts occur - how should they be resolved?""",
        
        "manufacturing": """
Example scenarios to test:
- A machine produces out-of-spec parts - what actions are required?
- Equipment malfunctions during production - what is the response?
- Quality inspection reveals defects - what is the procedure?
- Safety hazard is identified - what immediate steps are needed?
- Material shortage occurs - how should it be handled?""",
        
        "laboratory": """
Example scenarios to test:
- Sample contamination is suspected - what actions are required?
- Equipment calibration is out of range - what is the procedure?
- Unexpected test results occur - how should they be investigated?
- Chemical spill occurs - what is the emergency response?
- Quality control fails - what corrective actions are needed?""",
        
        "healthcare": """
Example scenarios to test:
- Patient shows adverse reaction - what is the immediate response?
- Infection control breach occurs - what actions are required?
- Medical equipment malfunctions - what is the procedure?
- Patient privacy concern arises - how should it be handled?
- Emergency situation develops - what is the response protocol?""",
        
        "food_service": """
Example scenarios to test:
- Food temperature is out of safe range - what actions are required?
- Customer reports allergen concern - how should it be handled?
- Cross-contamination is suspected - what is the procedure?
- Equipment breaks during service - what is the response?
- Food safety violation is observed - what steps are needed?""",
        
        "it_operations": """
Example scenarios to test:
- Critical system outage occurs - what is the response procedure?
- Security breach is detected - what immediate actions are required?
- Backup fails to complete - how should it be investigated?
- Performance degradation is reported - what troubleshooting steps?
- Unauthorized access attempt - what is the security response?""",
        
        "construction": """
Example scenarios to test:
- Fall hazard is identified - what immediate actions are required?
- Equipment inspection reveals defect - what is the procedure?
- Weather conditions become unsafe - what is the response?
- Injury occurs on site - what emergency steps are needed?
- Code violation is discovered - how should it be addressed?""",
        
        "retail": """
Example scenarios to test:
- Angry customer demands refund - how should it be handled?
- Suspected shoplifting occurs - what is the proper response?
- POS system malfunctions - what backup procedures exist?
- Product recall is announced - what actions are required?
- Cash drawer discrepancy found - what is the procedure?""",
        
        "general_workplace": """
Example scenarios to test:
- Safety hazard is identified - what actions are required?
- Equipment malfunctions - what is the response procedure?
- Quality issue is discovered - how should it be handled?
- Emergency situation occurs - what steps should be taken?
- Procedure deviation happens - what corrective actions are needed?"""
    }
    return scenarios.get(industry, scenarios["general_workplace"])


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
