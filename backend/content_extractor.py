"""Content extractor: identifies procedures, safety items, and structure from parsed documents."""

import re
from typing import Optional, Dict, List, Tuple

from models import ContentStructure, ProcedureStep


# ---------------------------------------------------------------------------
# Comprehensive keyword lists for better extraction
# ---------------------------------------------------------------------------

SAFETY_KEYWORDS = [
    "safety", "hazard", "danger", "warning", "caution", "risk", "unsafe",
    "protective equipment", "ppe", "safety glasses", "gloves", "helmet", "mask",
    "emergency", "evacuation", "first aid", "accident", "injury", "incident",
    "toxic", "flammable", "corrosive", "explosive", "radioactive", "chemical",
    "ventilation", "fume hood", "containment", "spill", "leak", "exposure",
    "lockout", "tagout", "loto", "confined space", "permit required",
    "do not", "never", "always wear", "must wear", "shall wear",
    "prohibited", "forbidden", "avoid", "prevent", "stop", "cease",
    "fire", "burn", "shock", "electrical", "voltage", "current",
    "pressure", "temperature", "hot", "cold", "sharp", "cutting",
    "lifting", "ergonomic", "strain", "repetitive", "noise", "hearing",
]

COMPLIANCE_KEYWORDS = [
    "regulation", "compliance", "standard", "requirement", "mandatory", "required",
    "osha", "epa", "fda", "iso", "ansi", "nfpa", "astm", "cdc", "niosh",
    "policy", "procedure", "guideline", "protocol", "specification", "sop",
    "audit", "inspection", "certification", "validation", "verification", "approval",
    "documentation", "record", "log", "report", "training", "qualification",
    "authorized", "competent", "qualified", "licensed", "certified",
]

EQUIPMENT_KEYWORDS = [
    "equipment", "tool", "instrument", "device", "machine", "apparatus",
    "gauge", "meter", "sensor", "detector", "monitor", "alarm",
    "pump", "valve", "switch", "control", "panel", "system",
    "container", "vessel", "tank", "pipe", "hose", "fitting",
]

PROCESS_KEYWORDS = [
    "process", "procedure", "method", "technique", "operation", "activity",
    "task", "step", "stage", "phase", "sequence", "order",
    "prepare", "setup", "configure", "adjust", "calibrate", "test",
    "start", "begin", "initiate", "commence", "activate", "engage",
    "stop", "end", "complete", "finish", "terminate", "shutdown",
    "check", "verify", "confirm", "inspect", "examine", "review",
    "measure", "record", "document", "note", "observe", "monitor",
]

QUALITY_KEYWORDS = [
    "quality", "specification", "tolerance", "accuracy", "precision", "standard",
    "defect", "error", "fault", "failure", "malfunction", "problem",
    "acceptable", "unacceptable", "pass", "fail", "reject", "approve",
    "criteria", "limit", "range", "threshold", "minimum", "maximum",
]

STEP_PATTERNS = [
    re.compile(r"^\s*\d+[.)]\s+"),          # 1. or 1)
    re.compile(r"^\s*step\s+\d+", re.I),   # Step 1
    re.compile(r"^\s*[a-z][.)]\s+"),        # a. or a)
    re.compile(r"^\s*\([a-z0-9]+\)\s+"),   # (a) or (1)
    re.compile(r"^\s*[ivx]+[.)]\s+", re.I),  # i. or I)
    re.compile(r"^\s*[•\-*]\s+"),           # bullets
    re.compile(r"^\s*\d+\.\d+[.)]\s+"),     # 1.1. or 1.1)
    re.compile(r"^\s*[A-Z]\.\s+"),          # A. B. C.
    re.compile(r"^\s*\d+\s*[-–—]\s+"),      # 1 - or 1 –
    re.compile(r"^\s*→\s+"),                # arrow bullets
    re.compile(r"^\s*▪\s+"),                # square bullets
    re.compile(r"^\s*◦\s+"),                # circle bullets
]

SECTION_PATTERNS = [
    re.compile(r"^[A-Z\s]{3,}:?\s*$"),                    # ALL CAPS sections
    re.compile(r"^\d+\.\s+[A-Z][a-zA-Z\s]+:?\s*$"),      # 1. Title Case
    re.compile(r"^[A-Z][a-zA-Z\s]+:$"),                   # Title Case:
    re.compile(r"^={3,}.*={3,}$"),                        # ===Title===
    re.compile(r"^-{3,}.*-{3,}$"),                        # ---Title---
    re.compile(r"^\*{3,}.*\*{3,}$"),                      # ***Title***
    re.compile(r"^#{1,6}\s+.*$"),                         # # Markdown headers
]


# ---------------------------------------------------------------------------
# Public class
# ---------------------------------------------------------------------------

class ContentExtractor:
    """Extract structured content from a parsed SOP document with comprehensive analysis."""

    def extract_procedures(self, content: str) -> list[ProcedureStep]:
        """Extract all procedural steps with enhanced context and metadata."""
        lines = content.splitlines()
        procedures: list[ProcedureStep] = []
        step_number = 0
        current_section: Optional[str] = None
        context_buffer: List[str] = []  # Store surrounding context
        
        for i, raw_line in enumerate(lines):
            line = raw_line.strip()
            if not line:
                continue

            # Maintain context buffer (3 lines before and after)
            start_idx = max(0, i - 3)
            end_idx = min(len(lines), i + 4)
            surrounding_context = [l.strip() for l in lines[start_idx:end_idx] if l.strip()]

            step_match = _identify_step(line)
            if step_match:
                step_number += 1
                
                # Extract additional metadata
                dependencies = _extract_dependencies(line, surrounding_context)
                timing_info = _extract_timing(line, surrounding_context)
                tools_equipment = _extract_tools_equipment(line, surrounding_context)
                quality_checks = _extract_quality_indicators(line, surrounding_context)
                
                procedures.append(ProcedureStep(
                    id=f"step_{step_number}",
                    step_number=step_number,
                    content=step_match["content"],
                    original_text=line,
                    section=current_section,
                    line_number=i + 1,
                    type=step_match["type"],
                    is_safety_related=_has_safety(line),
                    is_compliance_related=_has_compliance(line),
                    # Enhanced metadata for AI processing
                    surrounding_context=surrounding_context,
                    dependencies=dependencies,
                    timing_info=timing_info,
                    tools_equipment=tools_equipment,
                    quality_checks=quality_checks,
                    complexity_score=_assess_complexity(line, surrounding_context),
                    action_verbs=_extract_action_verbs(line),
                ))
            else:
                section = _identify_section(line)
                if section:
                    current_section = section

        return procedures

    def identify_safety_requirements(self, content: str) -> list[dict]:
        """Enhanced safety requirement extraction with comprehensive analysis."""
        lines = content.splitlines()
        result = []
        req_id = 0
        
        for i, raw_line in enumerate(lines):
            line = raw_line.strip()
            if line and _has_safety(line):
                req_id += 1
                
                # Get surrounding context for better AI understanding
                start_idx = max(0, i - 2)
                end_idx = min(len(lines), i + 3)
                context = [l.strip() for l in lines[start_idx:end_idx] if l.strip()]
                
                result.append({
                    "id": f"safety_{req_id}",
                    "content": line,
                    "line_number": i + 1,
                    "severity": _assess_severity(line),
                    "type": _categorize_safety(line),
                    "context": context,
                    "ppe_required": _extract_ppe_requirements(line),
                    "emergency_related": _is_emergency_related(line),
                    "regulatory_basis": _extract_regulatory_references(line),
                    "consequences": _extract_consequences(line, context),
                })
        return result

    def extract_comprehensive_structure(self, content: str) -> Dict:
        """Extract comprehensive document structure for AI processing."""
        lines = content.splitlines()
        
        # Document-level analysis
        structure = {
            "document_stats": {
                "total_lines": len(lines),
                "non_empty_lines": len([l for l in lines if l.strip()]),
                "word_count": len(content.split()),
                "character_count": len(content),
                "average_line_length": sum(len(l) for l in lines) / len(lines) if lines else 0,
            },
            "sections": self._extract_sections_with_content(lines),
            "procedures": [p.dict() for p in self.extract_procedures(content)],
            "safety_requirements": self.identify_safety_requirements(content),
            "equipment_mentions": self._extract_equipment_mentions(content),
            "process_flow": self._analyze_process_flow(content),
            "quality_requirements": self._extract_quality_requirements(content),
            "compliance_references": self._extract_compliance_references(content),
            "document_type_indicators": self._classify_document_type(content),
            "complexity_analysis": self._analyze_document_complexity(content),
            "key_terminology": self._extract_key_terminology(content),
        }
        
        return structure

    def _extract_sections_with_content(self, lines: List[str]) -> List[Dict]:
        """Extract sections with their content for comprehensive AI context."""
        sections = []
        current_section = None
        current_content = []
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
                
            section_match = _identify_section(line)
            if section_match:
                # Save previous section
                if current_section:
                    sections.append({
                        "title": current_section,
                        "content": "\n".join(current_content),
                        "line_count": len(current_content),
                        "word_count": len(" ".join(current_content).split()),
                        "has_procedures": any(_identify_step(l) for l in current_content),
                        "safety_mentions": sum(1 for l in current_content if _has_safety(l)),
                        "compliance_mentions": sum(1 for l in current_content if _has_compliance(l)),
                    })
                
                current_section = section_match
                current_content = []
            else:
                if current_section:
                    current_content.append(line)
        
        # Add final section
        if current_section and current_content:
            sections.append({
                "title": current_section,
                "content": "\n".join(current_content),
                "line_count": len(current_content),
                "word_count": len(" ".join(current_content).split()),
                "has_procedures": any(_identify_step(l) for l in current_content),
                "safety_mentions": sum(1 for l in current_content if _has_safety(l)),
                "compliance_mentions": sum(1 for l in current_content if _has_compliance(l)),
            })
        
        return sections

    def _extract_equipment_mentions(self, content: str) -> List[Dict]:
        """Extract equipment and tools mentioned in the document."""
        equipment = []
        lines = content.splitlines()
        
        for i, line in enumerate(lines):
            line_lower = line.lower()
            for keyword in EQUIPMENT_KEYWORDS:
                if keyword in line_lower:
                    # Extract the specific equipment mention
                    words = line.split()
                    for j, word in enumerate(words):
                        if keyword in word.lower():
                            # Get context around the equipment mention
                            start = max(0, j - 3)
                            end = min(len(words), j + 4)
                            context = " ".join(words[start:end])
                            
                            equipment.append({
                                "keyword": keyword,
                                "context": context,
                                "line_number": i + 1,
                                "full_line": line.strip(),
                            })
                            break
        
        return equipment

    def _analyze_process_flow(self, content: str) -> Dict:
        """Analyze the overall process flow and dependencies."""
        procedures = self.extract_procedures(content)
        
        flow_analysis = {
            "total_steps": len(procedures),
            "sequential_steps": sum(1 for p in procedures if p.type == "numbered"),
            "parallel_activities": sum(1 for p in procedures if p.type == "bulleted"),
            "decision_points": len(re.findall(r'\b(if|when|unless|choose|select|decide)\b', content, re.I)),
            "loops_iterations": len(re.findall(r'\b(repeat|until|while|continue|again)\b', content, re.I)),
            "conditional_steps": len(re.findall(r'\b(if.*then|when.*do|unless.*skip)\b', content, re.I)),
            "verification_points": len(re.findall(r'\b(check|verify|confirm|ensure|validate)\b', content, re.I)),
        }
        
        return flow_analysis

    def _extract_quality_requirements(self, content: str) -> List[Dict]:
        """Extract quality control and acceptance criteria."""
        quality_reqs = []
        lines = content.splitlines()
        
        for i, line in enumerate(lines):
            line_lower = line.lower()
            if any(keyword in line_lower for keyword in QUALITY_KEYWORDS):
                # Extract specific quality criteria
                criteria = []
                if re.search(r'\d+%|\d+\.\d+%', line):
                    criteria.append("percentage_based")
                if re.search(r'±\s*\d+|\+/-\s*\d+', line):
                    criteria.append("tolerance_based")
                if re.search(r'\b(min|max|minimum|maximum)\b', line_lower):
                    criteria.append("limit_based")
                
                quality_reqs.append({
                    "line_number": i + 1,
                    "content": line.strip(),
                    "criteria_type": criteria,
                    "measurable": bool(re.search(r'\d+', line)),
                })
        
        return quality_reqs

    def _extract_compliance_references(self, content: str) -> List[Dict]:
        """Extract regulatory and compliance references."""
        compliance_refs = []
        
        # Look for specific regulatory patterns
        patterns = [
            (r'\b(OSHA|EPA|FDA|ISO|ANSI|NFPA|ASTM|CDC|NIOSH)\s*\d+', "standard_reference"),
            (r'\b\d{2}\s*CFR\s*\d+', "federal_regulation"),
            (r'\bSection\s+\d+\.\d+', "section_reference"),
            (r'\bChapter\s+\d+', "chapter_reference"),
        ]
        
        for pattern, ref_type in patterns:
            matches = re.finditer(pattern, content, re.I)
            for match in matches:
                compliance_refs.append({
                    "reference": match.group(),
                    "type": ref_type,
                    "position": match.start(),
                })
        
        return compliance_refs

    def _classify_document_type(self, content: str) -> Dict:
        """Classify the type of SOP document."""
        content_lower = content.lower()
        
        indicators = {
            "laboratory_procedure": sum(1 for kw in ["lab", "laboratory", "sample", "test", "analysis", "chemical"] if kw in content_lower),
            "manufacturing_process": sum(1 for kw in ["manufacture", "production", "assembly", "quality control"] if kw in content_lower),
            "safety_procedure": sum(1 for kw in ["safety", "emergency", "hazard", "protective"] if kw in content_lower),
            "maintenance_procedure": sum(1 for kw in ["maintenance", "repair", "service", "inspection"] if kw in content_lower),
            "administrative_procedure": sum(1 for kw in ["policy", "documentation", "record", "approval"] if kw in content_lower),
        }
        
        return indicators

    def _analyze_document_complexity(self, content: str) -> Dict:
        """Analyze document complexity for training material generation."""
        lines = content.splitlines()
        procedures = self.extract_procedures(content)
        
        complexity = {
            "readability_score": self._calculate_readability_score(content),
            "technical_density": len(re.findall(r'\b[A-Z]{2,}\b', content)) / len(content.split()),
            "procedure_complexity": sum(p.complexity_score for p in procedures) / len(procedures) if procedures else 0,
            "safety_complexity": len(self.identify_safety_requirements(content)) / len(lines) * 100,
            "decision_complexity": len(re.findall(r'\b(if|when|choose|decide)\b', content, re.I)),
            "prerequisite_complexity": len(re.findall(r'\b(before|after|prior|following)\b', content, re.I)),
        }
        
        return complexity

    def _extract_key_terminology(self, content: str) -> List[Dict]:
        """Extract key technical terms and definitions."""
        # Find terms that are defined or explained
        definition_patterns = [
            r'(\w+)\s+(?:is|means|refers to|defined as)\s+([^.!?]+)',
            r'(\w+):\s*([^.!?]+)',
            r'The term\s+(\w+)\s+([^.!?]+)',
        ]
        
        terminology = []
        for pattern in definition_patterns:
            matches = re.finditer(pattern, content, re.I)
            for match in matches:
                terminology.append({
                    "term": match.group(1),
                    "definition": match.group(2).strip(),
                    "context": "definition",
                })
        
        # Find frequently used technical terms
        words = re.findall(r'\b[A-Z]{2,}\b|\b[a-z]+(?:-[a-z]+)+\b', content)
        word_freq = {}
        for word in words:
            word_freq[word] = word_freq.get(word, 0) + 1
        
        # Add high-frequency technical terms
        for term, freq in sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:20]:
            if freq > 2:  # Only include terms used multiple times
                terminology.append({
                    "term": term,
                    "frequency": freq,
                    "context": "technical_term",
                })
        
        return terminology

    def _calculate_readability_score(self, content: str) -> float:
        """Calculate a simple readability score."""
        sentences = len(re.findall(r'[.!?]+', content))
        words = len(content.split())
        syllables = sum(max(1, len(re.findall(r'[aeiouAEIOU]', word))) for word in content.split())
        
        if sentences == 0:
            return 0
        
        # Simplified Flesch Reading Ease formula
        score = 206.835 - (1.015 * (words / sentences)) - (84.6 * (syllables / words))
        return max(0, min(100, score))


# ---------------------------------------------------------------------------
# Enhanced helper functions
# ---------------------------------------------------------------------------

def _identify_step(line: str) -> Optional[dict]:
    """Enhanced step identification with better pattern matching."""
    for pattern in STEP_PATTERNS:
        m = pattern.match(line)
        if m:
            content = line[m.end():].strip()
            ptype = "numbered" if re.search(r"\d", m.group()) else "bulleted"
            return {"content": content, "type": ptype}
    return None


def _identify_section(line: str) -> Optional[str]:
    """Enhanced section identification with multiple patterns."""
    if _identify_step(line):
        return None
    
    for pattern in SECTION_PATTERNS:
        if pattern.match(line):
            return line.rstrip(":=*-#").strip()
    
    return None


def _has_safety(text: str) -> bool:
    """Enhanced safety detection."""
    lc = text.lower()
    return any(kw in lc for kw in SAFETY_KEYWORDS)


def _has_compliance(text: str) -> bool:
    """Enhanced compliance detection."""
    lc = text.lower()
    return any(kw in lc for kw in COMPLIANCE_KEYWORDS)


def _assess_severity(text: str) -> str:
    """Enhanced severity assessment."""
    lc = text.lower()
    if any(k in lc for k in ["danger", "fatal", "death", "explosive", "toxic", "never", "prohibited", "lethal"]):
        return "critical"
    if any(k in lc for k in ["warning", "caution", "hazard", "injury", "must", "required", "shall"]):
        return "high"
    if any(k in lc for k in ["notice", "important", "should", "recommended", "advised"]):
        return "medium"
    return "low"


def _categorize_safety(text: str) -> str:
    """Enhanced safety categorization."""
    lc = text.lower()
    if any(k in lc for k in ["ppe", "protective equipment", "gloves", "safety glasses", "helmet", "mask"]):
        return "personal_protective_equipment"
    if any(k in lc for k in ["emergency", "evacuation", "first aid", "accident", "incident"]):
        return "emergency_procedure"
    if any(k in lc for k in ["ventilation", "fume hood", "containment", "exposure", "air quality"]):
        return "environmental_control"
    if any(k in lc for k in ["lockout", "tagout", "loto", "energy isolation"]):
        return "lockout_tagout"
    if any(k in lc for k in ["fire", "explosion", "flammable", "ignition"]):
        return "fire_safety"
    if any(k in lc for k in ["electrical", "shock", "voltage", "current"]):
        return "electrical_safety"
    if any(k in lc for k in ["chemical", "toxic", "corrosive", "reactive"]):
        return "chemical_safety"
    return "general_safety"


def _extract_dependencies(line: str, context: List[str]) -> List[str]:
    """Extract dependencies and prerequisites from step context."""
    dependencies = []
    combined_text = " ".join([line] + context).lower()
    
    dependency_patterns = [
        r'after\s+([^,.]+)',
        r'before\s+([^,.]+)',
        r'following\s+([^,.]+)',
        r'prior\s+to\s+([^,.]+)',
        r'once\s+([^,.]+)',
        r'when\s+([^,.]+)',
        r'if\s+([^,.]+)',
        r'ensure\s+([^,.]+)',
        r'verify\s+([^,.]+)',
    ]
    
    for pattern in dependency_patterns:
        matches = re.findall(pattern, combined_text)
        dependencies.extend([match.strip() for match in matches])
    
    return dependencies[:5]  # Limit to top 5 dependencies


def _extract_timing(line: str, context: List[str]) -> Dict:
    """Extract timing information from step context."""
    combined_text = " ".join([line] + context).lower()
    
    timing_info = {
        "duration_mentioned": bool(re.search(r'\d+\s*(min|minute|hour|sec|second)', combined_text)),
        "urgency_indicators": len(re.findall(r'\b(immediate|urgent|quickly|slowly|wait)\b', combined_text)),
        "sequence_indicators": len(re.findall(r'\b(first|next|then|finally|last)\b', combined_text)),
    }
    
    # Extract specific durations
    duration_matches = re.findall(r'(\d+)\s*(min|minute|hour|sec|second)', combined_text)
    if duration_matches:
        timing_info["estimated_duration"] = duration_matches[0]
    
    return timing_info


def _extract_tools_equipment(line: str, context: List[str]) -> List[str]:
    """Extract tools and equipment mentioned in step context."""
    combined_text = " ".join([line] + context).lower()
    tools = []
    
    for keyword in EQUIPMENT_KEYWORDS:
        if keyword in combined_text:
            # Try to extract the specific tool/equipment name
            pattern = rf'\b\w*{keyword}\w*\b'
            matches = re.findall(pattern, combined_text)
            tools.extend(matches)
    
    return list(set(tools))[:10]  # Remove duplicates and limit


def _extract_quality_indicators(line: str, context: List[str]) -> List[str]:
    """Extract quality control indicators from step context."""
    combined_text = " ".join([line] + context).lower()
    indicators = []
    
    quality_patterns = [
        r'\b(check|verify|confirm|inspect|test|measure)\b',
        r'\b(acceptable|unacceptable|pass|fail|correct|incorrect)\b',
        r'\b(tolerance|specification|standard|criteria)\b',
        r'\d+%|\d+\.\d+%',  # Percentages
        r'±\s*\d+|\+/-\s*\d+',  # Tolerances
    ]
    
    for pattern in quality_patterns:
        matches = re.findall(pattern, combined_text)
        indicators.extend(matches)
    
    return list(set(indicators))


def _assess_complexity(line: str, context: List[str]) -> float:
    """Assess the complexity of a step based on various factors."""
    combined_text = " ".join([line] + context)
    
    complexity_factors = {
        "word_count": len(combined_text.split()) / 20,  # Normalize to 0-1 scale
        "technical_terms": len(re.findall(r'\b[A-Z]{2,}\b', combined_text)) / 10,
        "conditional_statements": len(re.findall(r'\b(if|when|unless|choose)\b', combined_text.lower())),
        "safety_mentions": len([kw for kw in SAFETY_KEYWORDS if kw in combined_text.lower()]) / 5,
        "equipment_mentions": len([kw for kw in EQUIPMENT_KEYWORDS if kw in combined_text.lower()]) / 5,
        "measurement_precision": len(re.findall(r'\d+\.\d+|\d+%|±', combined_text)) / 3,
    }
    
    # Calculate weighted complexity score
    weights = {
        "word_count": 0.2,
        "technical_terms": 0.3,
        "conditional_statements": 0.2,
        "safety_mentions": 0.1,
        "equipment_mentions": 0.1,
        "measurement_precision": 0.1,
    }
    
    complexity_score = sum(complexity_factors[factor] * weights[factor] for factor in weights)
    return min(1.0, complexity_score)  # Cap at 1.0


def _extract_action_verbs(line: str) -> List[str]:
    """Extract action verbs from a step."""
    action_verbs = [
        "prepare", "setup", "configure", "adjust", "calibrate", "test", "check", "verify",
        "start", "begin", "initiate", "activate", "engage", "operate", "run", "execute",
        "stop", "end", "complete", "finish", "terminate", "shutdown", "close", "secure",
        "measure", "record", "document", "note", "observe", "monitor", "inspect", "examine",
        "clean", "wash", "rinse", "dry", "store", "dispose", "remove", "install", "connect",
        "disconnect", "replace", "repair", "maintain", "service", "lubricate", "tighten",
    ]
    
    line_lower = line.lower()
    found_verbs = [verb for verb in action_verbs if verb in line_lower]
    return found_verbs


def _extract_ppe_requirements(line: str) -> List[str]:
    """Extract PPE requirements from safety-related text."""
    ppe_items = [
        "safety glasses", "goggles", "gloves", "helmet", "hard hat", "mask", "respirator",
        "face shield", "safety shoes", "steel toes", "lab coat", "apron", "coveralls",
        "hearing protection", "earplugs", "safety harness", "fall protection",
    ]
    
    line_lower = line.lower()
    required_ppe = [item for item in ppe_items if item in line_lower]
    return required_ppe


def _is_emergency_related(line: str) -> bool:
    """Check if a safety requirement is emergency-related."""
    emergency_keywords = [
        "emergency", "evacuation", "first aid", "accident", "incident", "spill",
        "leak", "fire", "explosion", "alarm", "alert", "immediate", "urgent",
    ]
    
    line_lower = line.lower()
    return any(keyword in line_lower for keyword in emergency_keywords)


def _extract_regulatory_references(line: str) -> List[str]:
    """Extract regulatory references from compliance text."""
    regulatory_patterns = [
        r'\b(OSHA|EPA|FDA|ISO|ANSI|NFPA|ASTM|CDC|NIOSH)\s*\d+',
        r'\b\d{2}\s*CFR\s*\d+',
        r'\bSection\s+\d+\.\d+',
        r'\bChapter\s+\d+',
    ]
    
    references = []
    for pattern in regulatory_patterns:
        matches = re.findall(pattern, line, re.I)
        references.extend(matches)
    
    return references


def _extract_consequences(line: str, context: List[str]) -> List[str]:
    """Extract potential consequences mentioned in safety context."""
    combined_text = " ".join([line] + context).lower()
    
    consequence_patterns = [
        r'may\s+cause\s+([^,.]+)',
        r'can\s+result\s+in\s+([^,.]+)',
        r'will\s+lead\s+to\s+([^,.]+)',
        r'risk\s+of\s+([^,.]+)',
        r'potential\s+for\s+([^,.]+)',
    ]
    
    consequences = []
    for pattern in consequence_patterns:
        matches = re.findall(pattern, combined_text)
        consequences.extend([match.strip() for match in matches])
    
    return consequences[:3]  # Limit to top 3 consequences
