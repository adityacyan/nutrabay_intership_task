/**
 * ContentExtractor class for analyzing SOP documents and extracting key structural elements
 * Implements procedure step identification, safety requirement detection, and content structure mapping
 */
class ContentExtractor {
    constructor() {
        // Common procedure step indicators
        this.stepIndicators = [
            /^\s*\d+[\.\)]\s+/,                    // 1. or 1)
            /^\s*step\s+\d+/i,                     // Step 1
            /^\s*[a-z][\.\)]\s+/,                  // a. or a)
            /^\s*\([a-z0-9]+\)\s+/,               // (a) or (1)
            /^\s*[ivx]+[\.\)]\s+/i,               // i. or I)
            /^\s*•\s+/,                           // bullet points
            /^\s*-\s+/,                           // dash points
            /^\s*\*\s+/                           // asterisk points
        ];

        // Safety-related keywords and phrases
        this.safetyKeywords = [
            'safety', 'hazard', 'danger', 'warning', 'caution', 'risk',
            'protective equipment', 'ppe', 'safety glasses', 'gloves',
            'emergency', 'evacuation', 'first aid', 'accident', 'injury',
            'toxic', 'flammable', 'corrosive', 'explosive', 'radioactive',
            'ventilation', 'fume hood', 'containment', 'spill', 'leak',
            'lockout', 'tagout', 'loto', 'confined space', 'permit required',
            'do not', 'never', 'always wear', 'must wear', 'required',
            'prohibited', 'forbidden', 'avoid', 'prevent', 'ensure'
        ];

        // Section heading patterns
        this.headingPatterns = [
            /^#{1,6}\s+(.+)$/m,                   // Markdown headers
            /^(.+)\n[=-]{3,}$/m,                  // Underlined headers
            /^\s*([A-Z][A-Z\s]{2,})\s*$/m,       // ALL CAPS headers
            /^\s*\d+\.\s*([A-Z].+)$/m,           // Numbered sections
            /^([A-Z][a-z\s]+):?\s*$/m            // Title case headers
        ];

        // Compliance and regulatory keywords
        this.complianceKeywords = [
            'regulation', 'compliance', 'standard', 'requirement', 'mandatory',
            'osha', 'epa', 'fda', 'iso', 'ansi', 'nfpa', 'astm',
            'policy', 'procedure', 'guideline', 'protocol', 'specification',
            'audit', 'inspection', 'certification', 'validation', 'verification'
        ];
    }

    /**
     * Extracts procedure steps from document content
     * @param {Object} document - Parsed document object with content and metadata
     * @returns {Array} Array of procedure step objects
     */
    extractProcedures(document) {
        if (!document || !document.content) {
            throw new Error('Invalid document provided to extractProcedures');
        }

        const lines = document.content.split('\n');
        const procedures = [];
        let currentSection = null;
        let stepNumber = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (!line) continue;

            // Check if this line is a procedure step
            const stepMatch = this._identifyStep(line);
            if (stepMatch) {
                stepNumber++;
                const procedure = {
                    id: `step_${stepNumber}`,
                    stepNumber: stepNumber,
                    content: stepMatch.content,
                    originalText: line,
                    section: currentSection,
                    lineNumber: i + 1,
                    type: stepMatch.type,
                    isSafetyRelated: this._containsSafetyKeywords(line),
                    isComplianceRelated: this._containsComplianceKeywords(line)
                };

                // Look ahead for additional context (next 2 lines)
                const context = this._extractContext(lines, i, 2);
                if (context.length > 0) {
                    procedure.additionalContext = context;
                }

                procedures.push(procedure);
            } else {
                // Check if this is a section header
                const sectionMatch = this._identifySection(line);
                if (sectionMatch) {
                    currentSection = sectionMatch;
                }
            }
        }

        return procedures;
    }

    /**
     * Identifies safety requirements and compliance points in the document
     * @param {Object} document - Parsed document object
     * @returns {Array} Array of safety requirement objects
     */
    identifySafetyRequirements(document) {
        if (!document || !document.content) {
            throw new Error('Invalid document provided to identifySafetyRequirements');
        }

        const lines = document.content.split('\n');
        const safetyRequirements = [];
        let requirementId = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (!line) continue;

            // Check for safety-related content
            if (this._containsSafetyKeywords(line)) {
                requirementId++;

                const requirement = {
                    id: `safety_${requirementId}`,
                    content: line,
                    lineNumber: i + 1,
                    severity: this._assessSafetySeverity(line),
                    keywords: this._extractMatchedKeywords(line, this.safetyKeywords),
                    type: this._categorizeSafetyRequirement(line),
                    isCompliance: this._containsComplianceKeywords(line)
                };

                // Extract surrounding context for better understanding
                const context = this._extractContext(lines, i, 1);
                if (context.length > 0) {
                    requirement.context = context;
                }

                safetyRequirements.push(requirement);
            }
        }

        return safetyRequirements;
    }

    /**
     * Maps the overall content structure of the document
     * @param {Object} document - Parsed document object
     * @returns {Object} Content structure object with sections, hierarchy, and metadata
     */
    mapContentStructure(document) {
        if (!document || !document.content) {
            throw new Error('Invalid document provided to mapContentStructure');
        }

        const lines = document.content.split('\n');
        const structure = {
            title: this._extractTitle(document),
            sections: [],
            totalLines: lines.length,
            wordCount: this._countWords(document.content),
            hasNumberedSteps: false,
            hasSafetySection: false,
            hasComplianceSection: false,
            documentType: this._identifyDocumentType(document.content)
        };

        let currentSection = null;
        let sectionId = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (!line) continue;

            // Check for section headers
            const sectionMatch = this._identifySection(line);
            if (sectionMatch) {
                // Save previous section if it exists
                if (currentSection) {
                    structure.sections.push(currentSection);
                }

                sectionId++;
                currentSection = {
                    id: `section_${sectionId}`,
                    title: sectionMatch,
                    startLine: i + 1,
                    content: [],
                    stepCount: 0,
                    safetyItemCount: 0,
                    complianceItemCount: 0
                };

                // Check if this is a safety or compliance section
                if (this._containsSafetyKeywords(sectionMatch)) {
                    structure.hasSafetySection = true;
                }
                if (this._containsComplianceKeywords(sectionMatch)) {
                    structure.hasComplianceSection = true;
                }
            } else if (currentSection) {
                // Add content to current section
                currentSection.content.push(line);

                // Count steps and safety items in this section
                if (this._identifyStep(line)) {
                    currentSection.stepCount++;
                    structure.hasNumberedSteps = true;
                }
                if (this._containsSafetyKeywords(line)) {
                    currentSection.safetyItemCount++;
                }
                if (this._containsComplianceKeywords(line)) {
                    currentSection.complianceItemCount++;
                }
            } else {
                // Content before any section header - create a default section
                sectionId++;
                currentSection = {
                    id: `section_${sectionId}`,
                    title: 'Introduction',
                    startLine: i + 1,
                    content: [line],
                    stepCount: 0,
                    safetyItemCount: 0,
                    complianceItemCount: 0
                };

                // Count steps and safety items
                if (this._identifyStep(line)) {
                    currentSection.stepCount++;
                    structure.hasNumberedSteps = true;
                }
                if (this._containsSafetyKeywords(line)) {
                    currentSection.safetyItemCount++;
                }
                if (this._containsComplianceKeywords(line)) {
                    currentSection.complianceItemCount++;
                }
            }
        }

        // Add the last section
        if (currentSection) {
            structure.sections.push(currentSection);
        }

        // Calculate additional metrics
        structure.averageWordsPerSection = structure.sections.length > 0
            ? Math.round(structure.wordCount / structure.sections.length)
            : 0;

        structure.totalSteps = structure.sections.reduce((sum, section) => sum + section.stepCount, 0);
        structure.totalSafetyItems = structure.sections.reduce((sum, section) => sum + section.safetyItemCount, 0);

        return structure;
    }

    // Private helper methods

    /**
     * Identifies if a line contains a procedure step
     * @param {string} line - Line of text to analyze
     * @returns {Object|null} Step match object or null
     */
    _identifyStep(line) {
        for (const pattern of this.stepIndicators) {
            const match = line.match(pattern);
            if (match) {
                return {
                    content: line.replace(pattern, '').trim(),
                    type: this._getStepType(pattern),
                    indicator: match[0].trim()
                };
            }
        }
        return null;
    }

    /**
     * Identifies section headers in the text
     * @param {string} line - Line of text to analyze
     * @returns {string|null} Section title or null
     */
    _identifySection(line) {
        // First check if this looks like a step - if so, it's not a section header
        if (this._identifyStep(line)) {
            return null;
        }

        for (const pattern of this.headingPatterns) {
            const match = line.match(pattern);
            if (match) {
                return match[1] || match[0];
            }
        }
        return null;
    }

    /**
     * Checks if text contains safety-related keywords
     * @param {string} text - Text to analyze
     * @returns {boolean} True if safety keywords are found
     */
    _containsSafetyKeywords(text) {
        const lowerText = text.toLowerCase();
        return this.safetyKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
    }

    /**
     * Checks if text contains compliance-related keywords
     * @param {string} text - Text to analyze
     * @returns {boolean} True if compliance keywords are found
     */
    _containsComplianceKeywords(text) {
        const lowerText = text.toLowerCase();
        return this.complianceKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
    }

    /**
     * Extracts matched keywords from text
     * @param {string} text - Text to analyze
     * @param {Array} keywords - Keywords to search for
     * @returns {Array} Array of matched keywords
     */
    _extractMatchedKeywords(text, keywords) {
        const lowerText = text.toLowerCase();
        return keywords.filter(keyword => lowerText.includes(keyword.toLowerCase()));
    }

    /**
     * Assesses the severity level of a safety requirement
     * @param {string} text - Safety requirement text
     * @returns {string} Severity level (high, medium, low)
     */
    _assessSafetySeverity(text) {
        const lowerText = text.toLowerCase();

        const highSeverityKeywords = ['danger', 'fatal', 'death', 'explosive', 'toxic', 'never', 'prohibited'];
        const mediumSeverityKeywords = ['warning', 'caution', 'hazard', 'injury', 'must', 'required'];

        if (highSeverityKeywords.some(keyword => lowerText.includes(keyword))) {
            return 'high';
        } else if (mediumSeverityKeywords.some(keyword => lowerText.includes(keyword))) {
            return 'medium';
        }
        return 'low';
    }

    /**
     * Categorizes the type of safety requirement
     * @param {string} text - Safety requirement text
     * @returns {string} Category of safety requirement
     */
    _categorizeSafetyRequirement(text) {
        const lowerText = text.toLowerCase();

        if (lowerText.includes('ppe') || lowerText.includes('protective equipment') ||
            lowerText.includes('gloves') || lowerText.includes('safety glasses')) {
            return 'personal_protective_equipment';
        } else if (lowerText.includes('emergency') || lowerText.includes('evacuation') ||
            lowerText.includes('first aid')) {
            return 'emergency_procedure';
        } else if (lowerText.includes('ventilation') || lowerText.includes('fume hood') ||
            lowerText.includes('containment')) {
            return 'environmental_control';
        } else if (lowerText.includes('lockout') || lowerText.includes('tagout') ||
            lowerText.includes('loto')) {
            return 'lockout_tagout';
        }
        return 'general_safety';
    }

    /**
     * Extracts surrounding context lines
     * @param {Array} lines - All document lines
     * @param {number} currentIndex - Current line index
     * @param {number} contextSize - Number of lines to extract before/after
     * @returns {Array} Context lines
     */
    _extractContext(lines, currentIndex, contextSize) {
        const context = [];
        const start = Math.max(0, currentIndex - contextSize);
        const end = Math.min(lines.length, currentIndex + contextSize + 1);

        for (let i = start; i < end; i++) {
            if (i !== currentIndex && lines[i].trim()) {
                context.push(lines[i].trim());
            }
        }

        return context;
    }

    /**
     * Determines the type of step indicator
     * @param {RegExp} pattern - The regex pattern that matched
     * @returns {string} Step type
     */
    _getStepType(pattern) {
        const patternString = pattern.toString();
        if (patternString.includes('\\d+')) return 'numbered';
        if (patternString.includes('[a-z]')) return 'lettered';
        if (patternString.includes('[ivx]')) return 'roman';
        if (patternString.includes('•') || patternString.includes('-') || patternString.includes('\\*')) return 'bulleted';
        return 'other';
    }

    /**
     * Extracts document title from content or metadata
     * @param {Object} document - Document object
     * @returns {string} Document title
     */
    _extractTitle(document) {
        if (document.metadata && document.metadata.title) {
            return document.metadata.title;
        }

        // Try to extract title from first few lines
        const lines = document.content.split('\n');
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            const line = lines[i].trim();
            if (line && line.length > 10 && line.length < 100) {
                // Check if it looks like a title (not a step or bullet point)
                if (!this._identifyStep(line) && !line.includes(':')) {
                    return line;
                }
            }
        }

        return document.filename || 'Untitled Document';
    }

    /**
     * Counts words in text
     * @param {string} text - Text to count words in
     * @returns {number} Word count
     */
    _countWords(text) {
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    /**
     * Identifies the type of document based on content analysis
     * @param {string} content - Document content
     * @returns {string} Document type
     */
    _identifyDocumentType(content) {
        const lowerContent = content.toLowerCase();

        if (lowerContent.includes('standard operating procedure') || lowerContent.includes('sop')) {
            return 'standard_operating_procedure';
        } else if (lowerContent.includes('work instruction') || lowerContent.includes('wi')) {
            return 'work_instruction';
        } else if (lowerContent.includes('policy') || lowerContent.includes('guideline')) {
            return 'policy_document';
        } else if (lowerContent.includes('safety') && lowerContent.includes('procedure')) {
            return 'safety_procedure';
        } else if (lowerContent.includes('training') || lowerContent.includes('manual')) {
            return 'training_manual';
        }

        return 'general_procedure';
    }
}

export default ContentExtractor;