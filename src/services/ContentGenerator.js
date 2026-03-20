import { AIProcessor } from './AIProcessor';

/**
 * ContentGenerator class for orchestrating the creation of all training materials
 * from processed SOP documents
 */
export class ContentGenerator {
    constructor() {
        this.aiProcessor = new AIProcessor();
    }

    /**
     * Generate all training content from a parsed document
     * @param {Object} parsedDocument - The parsed document object
     * @returns {Promise<Object>} Complete generated content object
     */
    async generateAllContent(parsedDocument) {
        try {
            console.log('Starting content generation for:', parsedDocument.filename);

            // Generate summary
            const summary = await this.createSummary(parsedDocument);

            // Generate training material
            const trainingMaterial = await this.buildTrainingMaterial(parsedDocument);

            // Generate evaluation questions
            const evaluation = await this.createEvaluation(parsedDocument);

            const generatedContent = {
                summary,
                trainingMaterial,
                evaluation,
                sourceDocument: {
                    filename: parsedDocument.filename,
                    id: parsedDocument.id
                },
                generatedAt: new Date()
            };

            console.log('Content generation completed successfully');
            return generatedContent;

        } catch (error) {
            console.error('Error generating content:', error);
            throw new Error(`Content generation failed: ${error.message}`);
        }
    }

    /**
     * Create structured summary from extracted content
     * @param {Object} parsedDocument - The parsed document
     * @returns {Promise<Object>} Summary object
     */
    async createSummary(parsedDocument) {
        const { content, structure } = parsedDocument;

        // Use AI to generate summary
        const aiSummary = await this.aiProcessor.generateSummary(content);

        return {
            title: `Summary: ${parsedDocument.filename}`,
            overview: aiSummary.overview,
            keyPoints: aiSummary.keyPoints || [],
            safetyRequirements: this.extractSafetyRequirements(content),
            procedureCount: structure.procedures.length,
            estimatedReadTime: Math.ceil(content.split(' ').length / 200) // ~200 words per minute
        };
    }

    /**
     * Build comprehensive training material from procedures
     * @param {Object} parsedDocument - The parsed document
     * @returns {Promise<Object>} Training material object
     */
    async buildTrainingMaterial(parsedDocument) {
        const { content, structure } = parsedDocument;

        // Generate training steps using AI
        const trainingSteps = await this.aiProcessor.createTrainingSteps(structure.procedures);

        return {
            title: `Training Guide: ${parsedDocument.filename}`,
            learningObjectives: this.generateLearningObjectives(structure.procedures),
            steps: trainingSteps,
            estimatedDuration: this.calculateTrainingDuration(trainingSteps),
            prerequisites: this.identifyPrerequisites(content),
            materials: this.identifyRequiredMaterials(content)
        };
    }

    /**
     * Create evaluation questions based on content
     * @param {Object} parsedDocument - The parsed document
     * @returns {Promise<Object>} Evaluation object
     */
    async createEvaluation(parsedDocument) {
        const { content } = parsedDocument;

        // Generate 3-5 questions using AI
        const questions = await this.aiProcessor.generateQuestions(content, 4);

        return {
            title: `Evaluation: ${parsedDocument.filename}`,
            questions,
            passingScore: 75, // 75% passing score
            instructions: 'Answer all questions to demonstrate understanding of the SOP procedures and safety requirements.',
            estimatedTime: questions.length * 2 // 2 minutes per question
        };
    }

    /**
     * Extract safety requirements from content using keyword matching
     * @param {string} content - Document content
     * @returns {Array} Array of safety requirements
     */
    extractSafetyRequirements(content) {
        const safetyKeywords = [
            'safety', 'hazard', 'warning', 'caution', 'danger', 'risk',
            'protective equipment', 'PPE', 'emergency', 'accident',
            'injury', 'compliance', 'regulation', 'standard'
        ];

        const safetyRequirements = [];
        const sentences = content.split(/[.!?]+/);

        sentences.forEach(sentence => {
            const lowerSentence = sentence.toLowerCase();
            if (safetyKeywords.some(keyword => lowerSentence.includes(keyword))) {
                safetyRequirements.push(sentence.trim());
            }
        });

        return safetyRequirements.slice(0, 10); // Limit to top 10 safety requirements
    }

    /**
     * Generate learning objectives based on procedures
     * @param {Array} procedures - Array of procedure objects
     * @returns {Array} Array of learning objective strings
     */
    generateLearningObjectives(procedures) {
        const objectives = [
            'Understand the purpose and scope of this Standard Operating Procedure',
            'Identify key safety requirements and compliance standards',
            'Follow step-by-step procedures accurately and safely'
        ];

        // Add procedure-specific objectives
        procedures.forEach((procedure, index) => {
            if (procedure.title) {
                objectives.push(`Execute ${procedure.title.toLowerCase()} according to established protocols`);
            }
        });

        return objectives.slice(0, 6); // Limit to 6 objectives
    }

    /**
     * Calculate estimated training duration based on content
     * @param {Array} steps - Array of training steps
     * @returns {number} Duration in minutes
     */
    calculateTrainingDuration(steps) {
        // Base time: 5 minutes per step + 10 minutes for introduction/review
        return (steps.length * 5) + 10;
    }

    /**
     * Identify prerequisites from content
     * @param {string} content - Document content
     * @returns {Array} Array of prerequisite strings
     */
    identifyPrerequisites(content) {
        const prerequisites = [];
        const lowerContent = content.toLowerCase();

        // Common prerequisite indicators
        if (lowerContent.includes('training') || lowerContent.includes('certification')) {
            prerequisites.push('Completion of required safety training');
        }
        if (lowerContent.includes('experience') || lowerContent.includes('qualified')) {
            prerequisites.push('Demonstrated competency in related procedures');
        }
        if (lowerContent.includes('authorization') || lowerContent.includes('approval')) {
            prerequisites.push('Proper authorization and approval to perform procedures');
        }

        return prerequisites.length > 0 ? prerequisites : ['Basic understanding of workplace safety protocols'];
    }

    /**
     * Identify required materials from content
     * @param {string} content - Document content
     * @returns {Array} Array of required material strings
     */
    identifyRequiredMaterials(content) {
        const materials = [];
        const lowerContent = content.toLowerCase();

        // Common material indicators
        if (lowerContent.includes('equipment') || lowerContent.includes('tool')) {
            materials.push('Required equipment and tools as specified in procedure');
        }
        if (lowerContent.includes('form') || lowerContent.includes('checklist')) {
            materials.push('Relevant forms and checklists');
        }
        if (lowerContent.includes('ppe') || lowerContent.includes('protective')) {
            materials.push('Personal protective equipment (PPE)');
        }

        return materials.length > 0 ? materials : ['Standard workplace materials and documentation'];
    }
}