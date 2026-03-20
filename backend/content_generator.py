"""Content generator: orchestrates parse → extract → AI → assemble pipeline with comprehensive data."""

import asyncio
import re
from datetime import datetime, timezone
from typing import Dict, List, Any

from models import (
    GeneratedContent,
    Summary,
    TrainingMaterial,
    TrainingStep,
    Evaluation,
    Question,
    ParsedDocument,
)
from content_extractor import ContentExtractor
from ai_processor import generate_summary, create_training_steps, generate_questions


class ContentGenerator:
    def __init__(self):
        self.extractor = ContentExtractor()

    async def generate_all_content(self, parsed: ParsedDocument) -> GeneratedContent:
        """Generate comprehensive training content with maximum context for AI processing."""
        content = parsed.content
        
        # Extract comprehensive structure and context
        print("[GEN]  Extracting comprehensive document structure...")
        comprehensive_structure = self.extractor.extract_comprehensive_structure(content)
        procedures_detailed = comprehensive_structure["procedures"]
        
        print(f"[GEN]  Extracted {len(procedures_detailed)} procedures with full context | words={len(content.split())}")
        print(f"[GEN]  Document analysis: {comprehensive_structure['document_stats']['word_count']} words, "
              f"{len(comprehensive_structure['sections'])} sections, "
              f"{len(comprehensive_structure['safety_requirements'])} safety items")

        # Prepare comprehensive context for AI with maximum information
        ai_context = self._prepare_comprehensive_ai_context(parsed, comprehensive_structure)
        
        print(f"[GEN]  Prepared comprehensive AI context: {len(str(ai_context))} characters")
        print("[GEN]  Firing AI calls sequentially with comprehensive context...")
        
        # Generate summary with full context
        print("[GEN]  -> Requesting comprehensive summary...")
        ai_summary_raw = await generate_summary(ai_context["full_content_with_analysis"])
        await asyncio.sleep(2)
        
        # Generate training steps with detailed procedure context
        print("[GEN]  -> Requesting detailed training steps...")
        training_steps_raw = await create_training_steps(
            procedures_detailed, 
            content_hint=ai_context["training_context"]
        )
        await asyncio.sleep(2)
        
        # Generate questions with comprehensive document context
        print("[GEN]  -> Requesting comprehensive evaluation questions...")
        questions_raw = await generate_questions(
            ai_context["evaluation_context"], 
            count=5  # Increased from 4 to 5
        )
        
        print("[GEN]  All AI calls complete with comprehensive context")

        # Build enhanced output structures
        summary = self._build_enhanced_summary(parsed, ai_summary_raw, comprehensive_structure)
        training_material = self._build_enhanced_training(parsed, training_steps_raw, comprehensive_structure)
        evaluation = self._build_enhanced_evaluation(parsed, questions_raw, comprehensive_structure)
        
        print(f"[GEN]  Built enhanced content: summary + {len(training_material.steps)} training steps + {len(evaluation.questions)} questions")

        return GeneratedContent(
            summary=summary,
            training_material=training_material,
            evaluation=evaluation,
            source_document={"filename": parsed.filename, "id": parsed.id},
            generated_at=datetime.now(timezone.utc).isoformat(),
        )

    def _prepare_comprehensive_ai_context(self, parsed: ParsedDocument, structure: Dict) -> Dict[str, str]:
        """Prepare comprehensive context for AI processing to maximize information utilization."""
        
        # Full content with structural analysis
        full_analysis = f"""
DOCUMENT: {parsed.filename}
TOTAL CONTENT: {structure['document_stats']['word_count']} words, {structure['document_stats']['total_lines']} lines

DOCUMENT STATISTICS:
- Character count: {structure['document_stats']['character_count']}
- Average line length: {structure['document_stats']['average_line_length']:.1f}
- Non-empty lines: {structure['document_stats']['non_empty_lines']}

DOCUMENT TYPE ANALYSIS:
{self._format_document_type_analysis(structure['document_type_indicators'])}

COMPLEXITY ANALYSIS:
- Readability score: {structure['complexity_analysis']['readability_score']:.1f}
- Technical density: {structure['complexity_analysis']['technical_density']:.3f}
- Procedure complexity: {structure['complexity_analysis']['procedure_complexity']:.3f}
- Safety complexity: {structure['complexity_analysis']['safety_complexity']:.1f}%
- Decision points: {structure['complexity_analysis']['decision_complexity']}
- Prerequisites: {structure['complexity_analysis']['prerequisite_complexity']}

SECTIONS WITH DETAILED ANALYSIS:
{self._format_sections_analysis(structure['sections'])}

PROCEDURES WITH COMPREHENSIVE CONTEXT:
{self._format_procedures_analysis(structure['procedures'])}

SAFETY REQUIREMENTS WITH FULL CONTEXT:
{self._format_safety_analysis(structure['safety_requirements'])}

EQUIPMENT AND TOOLS MENTIONED:
{self._format_equipment_analysis(structure['equipment_mentions'])}

PROCESS FLOW ANALYSIS:
{self._format_process_flow_analysis(structure['process_flow'])}

QUALITY REQUIREMENTS:
{self._format_quality_analysis(structure['quality_requirements'])}

COMPLIANCE REFERENCES:
{self._format_compliance_analysis(structure['compliance_references'])}

KEY TERMINOLOGY:
{self._format_terminology_analysis(structure['key_terminology'])}

FULL DOCUMENT CONTENT:
{parsed.content}
"""

        # Training-specific context
        training_context = f"""
TRAINING MATERIAL CONTEXT for {parsed.filename}:

LEARNING COMPLEXITY: {structure['complexity_analysis']['readability_score']:.1f} readability score
ESTIMATED TRAINING TIME: {self._estimate_training_time(structure)} minutes

PROCEDURAL BREAKDOWN:
- Total procedures: {structure['process_flow']['total_steps']}
- Sequential steps: {structure['process_flow']['sequential_steps']}
- Parallel activities: {structure['process_flow']['parallel_activities']}
- Decision points: {structure['process_flow']['decision_points']}
- Verification points: {structure['process_flow']['verification_points']}

SAFETY TRAINING REQUIREMENTS:
{self._format_safety_training_context(structure['safety_requirements'])}

EQUIPMENT TRAINING NEEDS:
{self._format_equipment_training_context(structure['equipment_mentions'])}

PREREQUISITE ANALYSIS:
{self._analyze_prerequisites(parsed.content, structure)}

DETAILED PROCEDURES FOR TRAINING:
{self._format_detailed_procedures_for_training(structure['procedures'])}
"""

        # Evaluation-specific context
        evaluation_context = f"""
EVALUATION CONTEXT for {parsed.filename}:

ASSESSMENT COMPLEXITY: {structure['complexity_analysis']['procedure_complexity']:.3f}
CRITICAL SAFETY AREAS: {len(structure['safety_requirements'])} safety requirements
COMPLIANCE AREAS: {len(structure['compliance_references'])} regulatory references

KEY LEARNING OBJECTIVES TO TEST:
{self._identify_key_learning_objectives(structure)}

CRITICAL SAFETY KNOWLEDGE TO ASSESS:
{self._format_critical_safety_for_evaluation(structure['safety_requirements'])}

PROCEDURAL COMPETENCIES TO EVALUATE:
{self._format_procedural_competencies(structure['procedures'])}

COMPLIANCE KNOWLEDGE REQUIREMENTS:
{self._format_compliance_for_evaluation(structure['compliance_references'])}

TECHNICAL TERMINOLOGY TO TEST:
{self._format_terminology_for_evaluation(structure['key_terminology'])}

SCENARIO-BASED ASSESSMENT OPPORTUNITIES:
{self._identify_scenario_opportunities(structure)}

FULL DOCUMENT FOR QUESTION GENERATION:
{parsed.content}
"""

        return {
            "full_content_with_analysis": full_analysis,
            "training_context": training_context,
            "evaluation_context": evaluation_context,
        }

    def _format_document_type_analysis(self, type_indicators: Dict) -> str:
        """Format document type analysis for AI context."""
        analysis = []
        for doc_type, score in type_indicators.items():
            if score > 0:
                analysis.append(f"- {doc_type.replace('_', ' ').title()}: {score} indicators")
        return "\n".join(analysis) if analysis else "- General procedure document"

    def _format_sections_analysis(self, sections: List[Dict]) -> str:
        """Format sections analysis with comprehensive details."""
        if not sections:
            return "No distinct sections identified."
        
        analysis = []
        for i, section in enumerate(sections, 1):
            analysis.append(f"""
Section {i}: {section['title']}
- Content length: {section['word_count']} words, {section['line_count']} lines
- Contains procedures: {'Yes' if section['has_procedures'] else 'No'}
- Safety mentions: {section['safety_mentions']}
- Compliance mentions: {section['compliance_mentions']}
- Content preview: {section['content'][:200]}...
""")
        return "\n".join(analysis)

    def _format_procedures_analysis(self, procedures: List[Dict]) -> str:
        """Format procedures with comprehensive context for AI."""
        if not procedures:
            return "No procedures identified."
        
        analysis = []
        for proc in procedures[:15]:  # Limit to first 15 for space
            context_str = " | ".join(proc.get('surrounding_context', [])[:3])
            deps_str = ", ".join(proc.get('dependencies', [])[:3])
            tools_str = ", ".join(proc.get('tools_equipment', [])[:5])
            
            analysis.append(f"""
Step {proc['step_number']}: {proc['content']}
- Section: {proc.get('section', 'N/A')}
- Type: {proc['type']} | Safety: {'Yes' if proc['is_safety_related'] else 'No'} | Compliance: {'Yes' if proc['is_compliance_related'] else 'No'}
- Complexity: {proc.get('complexity_score', 0):.2f}
- Context: {context_str}
- Dependencies: {deps_str}
- Tools/Equipment: {tools_str}
- Action verbs: {', '.join(proc.get('action_verbs', [])[:3])}
- Quality checks: {', '.join(proc.get('quality_checks', [])[:3])}
""")
        
        if len(procedures) > 15:
            analysis.append(f"... and {len(procedures) - 15} more procedures")
        
        return "\n".join(analysis)

    def _format_safety_analysis(self, safety_reqs: List[Dict]) -> str:
        """Format safety requirements with comprehensive context."""
        if not safety_reqs:
            return "No specific safety requirements identified."
        
        analysis = []
        for req in safety_reqs[:10]:  # Limit for space
            context_str = " | ".join(req.get('context', [])[:2])
            ppe_str = ", ".join(req.get('ppe_required', []))
            refs_str = ", ".join(req.get('regulatory_basis', []))
            consequences_str = ", ".join(req.get('consequences', []))
            
            analysis.append(f"""
Safety Requirement {req['id']}: {req['content']}
- Severity: {req['severity']} | Type: {req['type']}
- Emergency related: {'Yes' if req.get('emergency_related') else 'No'}
- PPE required: {ppe_str}
- Regulatory basis: {refs_str}
- Context: {context_str}
- Potential consequences: {consequences_str}
""")
        
        if len(safety_reqs) > 10:
            analysis.append(f"... and {len(safety_reqs) - 10} more safety requirements")
        
        return "\n".join(analysis)

    def _format_equipment_analysis(self, equipment: List[Dict]) -> str:
        """Format equipment mentions for AI context."""
        if not equipment:
            return "No specific equipment mentioned."
        
        # Group by keyword
        equipment_groups = {}
        for item in equipment:
            keyword = item['keyword']
            if keyword not in equipment_groups:
                equipment_groups[keyword] = []
            equipment_groups[keyword].append(item)
        
        analysis = []
        for keyword, items in list(equipment_groups.items())[:10]:  # Limit for space
            contexts = [item['context'] for item in items[:3]]
            analysis.append(f"- {keyword}: {len(items)} mentions | Examples: {' | '.join(contexts)}")
        
        return "\n".join(analysis)

    def _format_process_flow_analysis(self, flow: Dict) -> str:
        """Format process flow analysis."""
        return f"""
- Total steps: {flow['total_steps']}
- Sequential procedures: {flow['sequential_steps']}
- Parallel activities: {flow['parallel_activities']}
- Decision points: {flow['decision_points']}
- Loops/iterations: {flow['loops_iterations']}
- Conditional steps: {flow['conditional_steps']}
- Verification points: {flow['verification_points']}
"""

    def _format_quality_analysis(self, quality_reqs: List[Dict]) -> str:
        """Format quality requirements analysis."""
        if not quality_reqs:
            return "No specific quality requirements identified."
        
        analysis = []
        for req in quality_reqs[:8]:  # Limit for space
            criteria_str = ", ".join(req['criteria_type'])
            analysis.append(f"- Line {req['line_number']}: {req['content'][:100]}... | Criteria: {criteria_str} | Measurable: {'Yes' if req['measurable'] else 'No'}")
        
        return "\n".join(analysis)

    def _format_compliance_analysis(self, compliance_refs: List[Dict]) -> str:
        """Format compliance references analysis."""
        if not compliance_refs:
            return "No specific regulatory references identified."
        
        analysis = []
        for ref in compliance_refs[:10]:  # Limit for space
            analysis.append(f"- {ref['reference']} ({ref['type']})")
        
        return "\n".join(analysis)

    def _format_terminology_analysis(self, terminology: List[Dict]) -> str:
        """Format key terminology analysis."""
        if not terminology:
            return "No key terminology identified."
        
        definitions = [term for term in terminology if term.get('context') == 'definition']
        technical_terms = [term for term in terminology if term.get('context') == 'technical_term']
        
        analysis = []
        if definitions:
            analysis.append("DEFINITIONS:")
            for term in definitions[:5]:
                analysis.append(f"- {term['term']}: {term['definition']}")
        
        if technical_terms:
            analysis.append("\nTECHNICAL TERMS (by frequency):")
            for term in technical_terms[:10]:
                analysis.append(f"- {term['term']} (used {term['frequency']} times)")
        
        return "\n".join(analysis)

    def _estimate_training_time(self, structure: Dict) -> int:
        """Estimate training time based on document complexity."""
        base_time = structure['document_stats']['word_count'] // 150  # Reading time
        procedure_time = len(structure['procedures']) * 3  # 3 min per procedure
        safety_time = len(structure['safety_requirements']) * 2  # 2 min per safety item
        complexity_multiplier = 1 + (structure['complexity_analysis']['procedure_complexity'] * 0.5)
        
        total_time = int((base_time + procedure_time + safety_time) * complexity_multiplier)
        return max(15, total_time)  # Minimum 15 minutes

    def _format_safety_training_context(self, safety_reqs: List[Dict]) -> str:
        """Format safety requirements for training context."""
        if not safety_reqs:
            return "No specific safety training requirements."
        
        critical_safety = [req for req in safety_reqs if req['severity'] in ['critical', 'high']]
        ppe_requirements = []
        emergency_procedures = []
        
        for req in safety_reqs:
            if req.get('ppe_required'):
                ppe_requirements.extend(req['ppe_required'])
            if req.get('emergency_related'):
                emergency_procedures.append(req['content'])
        
        context = []
        if critical_safety:
            context.append(f"CRITICAL SAFETY ITEMS: {len(critical_safety)} high-priority requirements")
        if ppe_requirements:
            context.append(f"PPE TRAINING NEEDED: {', '.join(set(ppe_requirements))}")
        if emergency_procedures:
            context.append(f"EMERGENCY PROCEDURES: {len(emergency_procedures)} emergency-related items")
        
        return "\n".join(context)

    def _format_equipment_training_context(self, equipment: List[Dict]) -> str:
        """Format equipment mentions for training context."""
        if not equipment:
            return "No specific equipment training identified."
        
        unique_equipment = set(item['keyword'] for item in equipment)
        return f"EQUIPMENT TRAINING REQUIRED: {', '.join(list(unique_equipment)[:10])}"

    def _analyze_prerequisites(self, content: str, structure: Dict) -> str:
        """Analyze prerequisites for training."""
        content_lower = content.lower()
        prerequisites = []
        
        if any(keyword in content_lower for keyword in ['training', 'certification', 'qualified']):
            prerequisites.append("Prior training or certification required")
        if any(keyword in content_lower for keyword in ['experience', 'familiar', 'knowledge']):
            prerequisites.append("Previous experience or knowledge expected")
        if structure['complexity_analysis']['technical_density'] > 0.1:
            prerequisites.append("Technical background recommended")
        if len(structure['safety_requirements']) > 5:
            prerequisites.append("Safety training mandatory")
        
        return "\n".join(f"- {prereq}" for prereq in prerequisites) if prerequisites else "- Basic workplace safety knowledge"

    def _format_detailed_procedures_for_training(self, procedures: List[Dict]) -> str:
        """Format procedures with training-specific details."""
        if not procedures:
            return "No procedures for training."
        
        training_details = []
        for proc in procedures[:10]:  # Limit for space
            details = f"""
Training Step {proc['step_number']}: {proc['content']}
- Learning complexity: {proc.get('complexity_score', 0):.2f}
- Safety critical: {'Yes' if proc['is_safety_related'] else 'No'}
- Equipment needed: {', '.join(proc.get('tools_equipment', [])[:3])}
- Key actions: {', '.join(proc.get('action_verbs', [])[:3])}
- Prerequisites: {', '.join(proc.get('dependencies', [])[:2])}
"""
            training_details.append(details)
        
        return "\n".join(training_details)

    def _identify_key_learning_objectives(self, structure: Dict) -> str:
        """Identify key learning objectives for evaluation."""
        objectives = []
        
        if structure['procedures']:
            objectives.append(f"Execute {len(structure['procedures'])} procedural steps correctly")
        if structure['safety_requirements']:
            objectives.append(f"Demonstrate understanding of {len(structure['safety_requirements'])} safety requirements")
        if structure['compliance_references']:
            objectives.append("Apply relevant regulatory compliance standards")
        if structure['equipment_mentions']:
            objectives.append("Properly use required equipment and tools")
        if structure['quality_requirements']:
            objectives.append("Meet quality control standards and criteria")
        
        return "\n".join(f"- {obj}" for obj in objectives)

    def _format_critical_safety_for_evaluation(self, safety_reqs: List[Dict]) -> str:
        """Format critical safety knowledge for evaluation."""
        critical_items = [req for req in safety_reqs if req['severity'] in ['critical', 'high']]
        
        if not critical_items:
            return "No critical safety items identified."
        
        evaluation_points = []
        for item in critical_items[:5]:  # Limit for space
            evaluation_points.append(f"- {item['type']}: {item['content'][:80]}...")
        
        return "\n".join(evaluation_points)

    def _format_procedural_competencies(self, procedures: List[Dict]) -> str:
        """Format procedural competencies for evaluation."""
        if not procedures:
            return "No procedural competencies identified."
        
        complex_procedures = [p for p in procedures if p.get('complexity_score', 0) > 0.5]
        safety_procedures = [p for p in procedures if p['is_safety_related']]
        
        competencies = []
        if complex_procedures:
            competencies.append(f"Complex procedures: {len(complex_procedures)} high-complexity steps")
        if safety_procedures:
            competencies.append(f"Safety-critical procedures: {len(safety_procedures)} safety-related steps")
        
        return "\n".join(competencies) if competencies else "Basic procedural execution"

    def _format_compliance_for_evaluation(self, compliance_refs: List[Dict]) -> str:
        """Format compliance knowledge for evaluation."""
        if not compliance_refs:
            return "No specific compliance requirements."
        
        ref_types = set(ref['type'] for ref in compliance_refs)
        return f"Regulatory knowledge required: {', '.join(ref_types)}"

    def _format_terminology_for_evaluation(self, terminology: List[Dict]) -> str:
        """Format terminology for evaluation."""
        technical_terms = [term for term in terminology if term.get('frequency', 0) > 2]
        
        if not technical_terms:
            return "No critical terminology identified."
        
        return f"Key terms to test: {', '.join([term['term'] for term in technical_terms[:8]])}"

    def _identify_scenario_opportunities(self, structure: Dict) -> str:
        """Identify scenario-based assessment opportunities."""
        scenarios = []
        
        if structure['process_flow']['decision_points'] > 0:
            scenarios.append(f"Decision-making scenarios: {structure['process_flow']['decision_points']} decision points")
        
        emergency_safety = [req for req in structure['safety_requirements'] if req.get('emergency_related')]
        if emergency_safety:
            scenarios.append(f"Emergency response scenarios: {len(emergency_safety)} emergency situations")
        
        if structure['quality_requirements']:
            scenarios.append(f"Quality control scenarios: {len(structure['quality_requirements'])} quality checkpoints")
        
        return "\n".join(f"- {scenario}" for scenario in scenarios) if scenarios else "- Basic procedural scenarios"

    # ------------------------------------------------------------------
    # Enhanced content building methods
    # ------------------------------------------------------------------

    def _build_enhanced_summary(self, parsed: ParsedDocument, ai: dict, structure: Dict) -> Summary:
        """Build enhanced summary with comprehensive analysis."""
        # Enhanced safety requirements extraction
        safety_sentences = []
        for req in structure['safety_requirements']:
            safety_sentences.append(req['content'])
        
        # Add context-aware safety information
        critical_safety = [req for req in structure['safety_requirements'] if req['severity'] in ['critical', 'high']]
        if critical_safety:
            safety_sentences.insert(0, f"CRITICAL: {len(critical_safety)} high-priority safety requirements identified.")

        return Summary(
            title=f"Comprehensive Summary: {parsed.filename}",
            overview=ai.get("overview", ""),
            key_points=ai.get("key_points", []),
            safety_requirements=safety_sentences[:15],  # Increased from 10
            procedure_count=len(structure['procedures']),
            estimated_read_time=max(1, structure['document_stats']['word_count'] // 200),
            # Enhanced metadata
            document_complexity=structure['complexity_analysis']['readability_score'],
            safety_complexity=len(structure['safety_requirements']),
            compliance_references=len(structure['compliance_references']),
            equipment_count=len(set(item['keyword'] for item in structure['equipment_mentions'])),
        )

    def _build_enhanced_training(self, parsed: ParsedDocument, steps_raw: list[dict], structure: Dict) -> TrainingMaterial:
        """Build enhanced training material with comprehensive context."""
        steps = []
        for s in steps_raw:
            steps.append(TrainingStep(
                step_number=s.get("step_number", 0),
                title=s.get("title", ""),
                description=s.get("description", ""),
                duration=s.get("duration", 5),
                type=s.get("type", "procedure"),
                key_points=s.get("key_points", []),
                safety_notes=s.get("safety_notes", []),
                # Enhanced training metadata
                complexity_level=s.get("complexity_level", "medium"),
                required_equipment=s.get("required_equipment", []),
                prerequisites=s.get("prerequisites", []),
            ))

        # Enhanced prerequisites based on comprehensive analysis
        prerequisites = self._identify_enhanced_prerequisites(structure)
        materials = self._identify_enhanced_materials(structure)
        
        # Enhanced learning objectives
        learning_objectives = self._enhanced_learning_objectives(steps, structure)

        return TrainingMaterial(
            title=f"Comprehensive Training Guide: {parsed.filename}",
            learning_objectives=learning_objectives,
            steps=steps,
            estimated_duration=self._calculate_enhanced_duration(steps, structure),
            prerequisites=prerequisites,
            materials=materials,
            # Enhanced training metadata
            difficulty_level=self._assess_training_difficulty(structure),
            safety_emphasis=len(structure['safety_requirements']) > 5,
            hands_on_components=len([p for p in structure['procedures'] if p.get('tools_equipment')]),
        )

    def _build_enhanced_evaluation(self, parsed: ParsedDocument, questions_raw: list[dict], structure: Dict) -> Evaluation:
        """Build enhanced evaluation with comprehensive assessment."""
        questions = []
        for q in questions_raw:
            questions.append(Question(
                id=q.get("id", 1),
                type=q.get("type", "multiple-choice"),
                question=q.get("question", ""),
                options=q.get("options"),
                correct_answer=q.get("correct_answer"),
                explanation=q.get("explanation", ""),
                sample_answer=q.get("sample_answer"),
                points=q.get("points", 1),
                # Enhanced question metadata
                difficulty_level=q.get("difficulty_level", "medium"),
                topic_area=q.get("topic_area", "general"),
                safety_critical=q.get("safety_critical", False),
            ))

        # Enhanced evaluation parameters
        passing_score = self._calculate_passing_score(structure)
        estimated_time = self._calculate_evaluation_time(questions, structure)

        return Evaluation(
            title=f"Comprehensive Evaluation: {parsed.filename}",
            questions=questions,
            passing_score=passing_score,
            instructions=self._generate_enhanced_instructions(structure),
            estimated_time=estimated_time,
            # Enhanced evaluation metadata
            safety_weight=self._calculate_safety_weight(structure),
            compliance_requirements=len(structure['compliance_references']) > 0,
            practical_components=len([p for p in structure['procedures'] if p.get('complexity_score', 0) > 0.5]),
        )

    # ------------------------------------------------------------------
    # Enhanced helper methods
    # ------------------------------------------------------------------

    def _enhanced_learning_objectives(self, steps: list[TrainingStep], structure: Dict) -> list[str]:
        """Generate enhanced learning objectives based on comprehensive analysis."""
        objectives = [
            "Demonstrate comprehensive understanding of the SOP purpose, scope, and regulatory context",
            "Execute all procedural steps safely and accurately according to established protocols",
        ]
        
        # Add safety-specific objectives
        if len(structure['safety_requirements']) > 3:
            objectives.append("Identify and mitigate all safety hazards and risks associated with the procedures")
            objectives.append("Properly select, use, and maintain required personal protective equipment")
        
        # Add compliance objectives
        if structure['compliance_references']:
            objectives.append("Apply relevant regulatory standards and compliance requirements")
        
        # Add equipment objectives
        equipment_count = len(set(item['keyword'] for item in structure['equipment_mentions']))
        if equipment_count > 3:
            objectives.append(f"Demonstrate competency with {equipment_count} types of equipment and tools")
        
        # Add quality objectives
        if structure['quality_requirements']:
            objectives.append("Meet all quality control standards and acceptance criteria")
        
        # Add procedure-specific objectives
        complex_procedures = [p for p in structure['procedures'] if p.get('complexity_score', 0) > 0.5]
        if complex_procedures:
            objectives.append(f"Successfully complete {len(complex_procedures)} complex procedural sequences")
        
        return objectives[:8]  # Limit to 8 objectives

    def _identify_enhanced_prerequisites(self, structure: Dict) -> list[str]:
        """Identify enhanced prerequisites based on comprehensive analysis."""
        prerequisites = []
        
        # Safety prerequisites
        critical_safety = [req for req in structure['safety_requirements'] if req['severity'] in ['critical', 'high']]
        if critical_safety:
            prerequisites.append("Completion of advanced safety training and hazard recognition")
        elif structure['safety_requirements']:
            prerequisites.append("Basic workplace safety training and PPE familiarization")
        
        # Technical prerequisites
        if structure['complexity_analysis']['technical_density'] > 0.1:
            prerequisites.append("Technical background or relevant work experience")
        
        # Equipment prerequisites
        equipment_count = len(set(item['keyword'] for item in structure['equipment_mentions']))
        if equipment_count > 5:
            prerequisites.append("Familiarity with specialized equipment and instrumentation")
        
        # Compliance prerequisites
        if structure['compliance_references']:
            prerequisites.append("Understanding of relevant regulatory standards and requirements")
        
        # Complexity prerequisites
        if structure['complexity_analysis']['procedure_complexity'] > 0.7:
            prerequisites.append("Previous experience with similar complex procedures")
        
        return prerequisites or ["Basic understanding of workplace safety and standard operating procedures"]

    def _identify_enhanced_materials(self, structure: Dict) -> list[str]:
        """Identify enhanced materials based on comprehensive analysis."""
        materials = []
        
        # Equipment materials
        unique_equipment = set(item['keyword'] for item in structure['equipment_mentions'])
        if unique_equipment:
            materials.append(f"Required equipment: {', '.join(list(unique_equipment)[:8])}")
        
        # Safety materials
        ppe_items = set()
        for req in structure['safety_requirements']:
            ppe_items.update(req.get('ppe_required', []))
        if ppe_items:
            materials.append(f"Personal protective equipment: {', '.join(list(ppe_items)[:6])}")
        
        # Documentation materials
        if structure['compliance_references']:
            materials.append("Relevant regulatory standards and compliance documentation")
        
        # Quality materials
        if structure['quality_requirements']:
            materials.append("Quality control checklists and measurement tools")
        
        # Emergency materials
        emergency_items = [req for req in structure['safety_requirements'] if req.get('emergency_related')]
        if emergency_items:
            materials.append("Emergency response procedures and contact information")
        
        return materials or ["Standard workplace materials and SOP documentation"]

    def _calculate_enhanced_duration(self, steps: list[TrainingStep], structure: Dict) -> int:
        """Calculate enhanced training duration based on comprehensive analysis."""
        base_duration = sum(s.duration for s in steps)
        
        # Add time for complexity
        complexity_multiplier = 1 + (structure['complexity_analysis']['procedure_complexity'] * 0.5)
        
        # Add time for safety emphasis
        safety_time = len(structure['safety_requirements']) * 2
        
        # Add time for equipment familiarization
        equipment_time = len(set(item['keyword'] for item in structure['equipment_mentions'])) * 3
        
        total_duration = int((base_duration + safety_time + equipment_time) * complexity_multiplier)
        return max(30, total_duration)  # Minimum 30 minutes

    def _assess_training_difficulty(self, structure: Dict) -> str:
        """Assess overall training difficulty."""
        difficulty_score = 0
        
        # Complexity factors
        difficulty_score += structure['complexity_analysis']['procedure_complexity'] * 30
        difficulty_score += structure['complexity_analysis']['technical_density'] * 20
        difficulty_score += (len(structure['safety_requirements']) / 10) * 15
        difficulty_score += (len(structure['procedures']) / 20) * 10
        difficulty_score += structure['complexity_analysis']['decision_complexity'] * 5
        
        if difficulty_score > 70:
            return "advanced"
        elif difficulty_score > 40:
            return "intermediate"
        else:
            return "beginner"

    def _calculate_passing_score(self, structure: Dict) -> int:
        """Calculate appropriate passing score based on safety and complexity."""
        base_score = 75
        
        # Increase for safety-critical procedures
        critical_safety = [req for req in structure['safety_requirements'] if req['severity'] in ['critical', 'high']]
        if critical_safety:
            base_score = 85
        
        # Increase for regulatory compliance
        if structure['compliance_references']:
            base_score = max(base_score, 80)
        
        # Increase for high complexity
        if structure['complexity_analysis']['procedure_complexity'] > 0.7:
            base_score = max(base_score, 80)
        
        return min(95, base_score)  # Cap at 95%

    def _calculate_evaluation_time(self, questions: list[Question], structure: Dict) -> int:
        """Calculate evaluation time based on question complexity and content."""
        base_time = len(questions) * 3  # 3 minutes per question
        
        # Add time for complex procedures
        if structure['complexity_analysis']['procedure_complexity'] > 0.5:
            base_time += 10
        
        # Add time for safety-critical content
        if len(structure['safety_requirements']) > 5:
            base_time += 5
        
        return max(15, base_time)  # Minimum 15 minutes

    def _generate_enhanced_instructions(self, structure: Dict) -> str:
        """Generate enhanced evaluation instructions."""
        base_instructions = "Answer all questions to demonstrate comprehensive understanding of the SOP procedures, safety requirements, and compliance standards."
        
        # Add safety emphasis
        critical_safety = [req for req in structure['safety_requirements'] if req['severity'] in ['critical', 'high']]
        if critical_safety:
            base_instructions += f" Pay special attention to the {len(critical_safety)} critical safety requirements."
        
        # Add compliance emphasis
        if structure['compliance_references']:
            base_instructions += " Demonstrate knowledge of relevant regulatory standards and compliance requirements."
        
        # Add practical emphasis
        complex_procedures = [p for p in structure['procedures'] if p.get('complexity_score', 0) > 0.5]
        if complex_procedures:
            base_instructions += f" Show understanding of the {len(complex_procedures)} complex procedural sequences."
        
        return base_instructions

    def _calculate_safety_weight(self, structure: Dict) -> float:
        """Calculate the weight of safety content in evaluation."""
        total_content = len(structure['procedures']) + len(structure['safety_requirements'])
        if total_content == 0:
            return 0.0
        
        safety_weight = len(structure['safety_requirements']) / total_content
        
        # Boost weight for critical safety items
        critical_safety = [req for req in structure['safety_requirements'] if req['severity'] in ['critical', 'high']]
        if critical_safety:
            safety_weight *= 1.5
        
        return min(1.0, safety_weight)
