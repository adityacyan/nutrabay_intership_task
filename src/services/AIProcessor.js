/**
 * AIProcessor class for integrating with AI services to generate content
 * This is a mock implementation that simulates AI processing
 * In production, this would integrate with actual AI APIs like OpenAI GPT or Google Gemini
 */
export class AIProcessor {
    constructor() {
        this.isProcessing = false;
    }

    /**
     * Generate a structured summary of the content
     * @param {string} content - The document content to summarize
     * @returns {Promise<Object>} Summary object with overview and key points
     */
    async generateSummary(content) {
        this.isProcessing = true;

        try {
            // Simulate API processing time
            await this.delay(1500);

            // Extract key information using basic NLP techniques
            const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
            const words = content.toLowerCase().split(/\s+/);

            // Identify key topics
            const keyTopics = this.extractKeyTopics(words);

            // Generate overview
            const overview = this.generateOverview(sentences, keyTopics);

            // Extract key points
            const keyPoints = this.extractKeyPoints(sentences);

            return {
                overview,
                keyPoints,
                wordCount: words.length,
                complexity: this.assessComplexity(content)
            };

        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Create structured training steps from procedures
     * @param {Array} procedures - Array of procedure objects
     * @returns {Promise<Array>} Array of training step objects
     */
    async createTrainingSteps(procedures) {
        this.isProcessing = true;

        try {
            // Simulate API processing time
            await this.delay(2000);

            const trainingSteps = [];

            // Add introduction step
            trainingSteps.push({
                stepNumber: 1,
                title: 'Introduction and Safety Overview',
                description: 'Review the purpose of this SOP and understand all safety requirements before proceeding.',
                duration: 5,
                type: 'introduction',
                keyPoints: [
                    'Understand the scope and purpose of this procedure',
                    'Review all safety requirements and precautions',
                    'Ensure all required materials and equipment are available'
                ]
            });

            // Process each procedure into training steps
            procedures.forEach((procedure, index) => {
                const stepNumber = index + 2;

                trainingSteps.push({
                    stepNumber,
                    title: procedure.title || `Procedure ${stepNumber - 1}`,
                    description: this.generateStepDescription(procedure),
                    duration: this.estimateStepDuration(procedure),
                    type: 'procedure',
                    keyPoints: this.extractProcedureKeyPoints(procedure),
                    safetyNotes: this.extractSafetyNotes(procedure)
                });
            });

            // Add review and assessment step
            trainingSteps.push({
                stepNumber: trainingSteps.length + 1,
                title: 'Review and Assessment',
                description: 'Complete the evaluation questions to demonstrate understanding of the procedures.',
                duration: 10,
                type: 'assessment',
                keyPoints: [
                    'Review all completed procedures',
                    'Complete evaluation questions',
                    'Demonstrate competency in key safety requirements'
                ]
            });

            return trainingSteps;

        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Generate evaluation questions based on content
     * @param {string} content - The document content
     * @param {number} count - Number of questions to generate (3-5)
     * @returns {Promise<Array>} Array of question objects
     */
    async generateQuestions(content, count = 4) {
        this.isProcessing = true;

        try {
            // Simulate API processing time
            await this.delay(1800);

            const questions = [];
            const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);

            // Generate different types of questions
            const questionTypes = ['multiple-choice', 'true-false', 'scenario', 'short-answer'];

            for (let i = 0; i < count; i++) {
                const questionType = questionTypes[i % questionTypes.length];
                const question = this.generateQuestionByType(questionType, sentences, i + 1);
                questions.push(question);
            }

            return questions;

        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Extract key topics from word frequency analysis
     * @param {Array} words - Array of words from the content
     * @returns {Array} Array of key topic strings
     */
    extractKeyTopics(words) {
        const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these', 'those', 'a', 'an']);

        const wordFreq = {};
        words.forEach(word => {
            const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
            if (cleanWord.length > 3 && !stopWords.has(cleanWord)) {
                wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1;
            }
        });

        return Object.entries(wordFreq)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8)
            .map(([word]) => word);
    }

    /**
     * Generate overview text based on content analysis
     * @param {Array} sentences - Array of sentences
     * @param {Array} keyTopics - Array of key topics
     * @returns {string} Overview text
     */
    generateOverview(sentences, keyTopics) {
        const firstSentences = sentences.slice(0, 3).join('. ');
        const topicsText = keyTopics.slice(0, 4).join(', ');

        return `This Standard Operating Procedure covers essential processes and requirements. ${firstSentences}. Key areas include: ${topicsText}. This document provides detailed guidance for safe and effective execution of all procedures.`;
    }

    /**
     * Extract key points from sentences
     * @param {Array} sentences - Array of sentences
     * @returns {Array} Array of key point strings
     */
    extractKeyPoints(sentences) {
        const keyPoints = [];
        const importantIndicators = ['must', 'shall', 'required', 'important', 'critical', 'ensure', 'verify', 'safety', 'warning', 'caution'];

        sentences.forEach(sentence => {
            const lowerSentence = sentence.toLowerCase();
            if (importantIndicators.some(indicator => lowerSentence.includes(indicator))) {
                keyPoints.push(sentence.trim());
            }
        });

        return keyPoints.slice(0, 6); // Limit to 6 key points
    }

    /**
     * Assess content complexity
     * @param {string} content - Document content
     * @returns {string} Complexity level
     */
    assessComplexity(content) {
        const sentences = content.split(/[.!?]+/);
        const avgSentenceLength = content.split(' ').length / sentences.length;

        if (avgSentenceLength > 20) return 'High';
        if (avgSentenceLength > 15) return 'Medium';
        return 'Low';
    }

    /**
     * Generate step description for a procedure
     * @param {Object} procedure - Procedure object
     * @returns {string} Step description
     */
    generateStepDescription(procedure) {
        if (procedure.content) {
            const sentences = procedure.content.split(/[.!?]+/).filter(s => s.trim().length > 10);
            return sentences.slice(0, 2).join('. ') + '.';
        }
        return `Follow the established procedure for ${procedure.title || 'this step'} according to safety protocols and organizational standards.`;
    }

    /**
     * Estimate duration for a training step
     * @param {Object} procedure - Procedure object
     * @returns {number} Duration in minutes
     */
    estimateStepDuration(procedure) {
        if (procedure.content) {
            const wordCount = procedure.content.split(' ').length;
            return Math.max(3, Math.ceil(wordCount / 100)); // ~100 words per minute + practice time
        }
        return 5; // Default 5 minutes
    }

    /**
     * Extract key points from a procedure
     * @param {Object} procedure - Procedure object
     * @returns {Array} Array of key points
     */
    extractProcedureKeyPoints(procedure) {
        const keyPoints = [];
        if (procedure.content) {
            const sentences = procedure.content.split(/[.!?]+/).filter(s => s.trim().length > 10);
            keyPoints.push(...sentences.slice(0, 3));
        }

        if (keyPoints.length === 0) {
            keyPoints.push(`Complete ${procedure.title || 'this procedure'} following all safety guidelines`);
        }

        return keyPoints;
    }

    /**
     * Extract safety notes from a procedure
     * @param {Object} procedure - Procedure object
     * @returns {Array} Array of safety notes
     */
    extractSafetyNotes(procedure) {
        const safetyNotes = [];
        if (procedure.content) {
            const lowerContent = procedure.content.toLowerCase();
            if (lowerContent.includes('safety') || lowerContent.includes('caution') || lowerContent.includes('warning')) {
                safetyNotes.push('Follow all safety protocols and use appropriate protective equipment');
            }
        }
        return safetyNotes;
    }

    /**
     * Generate a question based on type
     * @param {string} type - Question type
     * @param {Array} sentences - Content sentences
     * @param {number} questionNumber - Question number
     * @returns {Object} Question object
     */
    generateQuestionByType(type, sentences, questionNumber) {
        const baseQuestion = {
            id: questionNumber,
            type,
            points: 1
        };

        switch (type) {
            case 'multiple-choice':
                return {
                    ...baseQuestion,
                    question: 'What is the primary safety requirement when following this SOP?',
                    options: [
                        'Wear appropriate personal protective equipment',
                        'Work as quickly as possible',
                        'Skip safety checks to save time',
                        'Ignore warning signs'
                    ],
                    correctAnswer: 0,
                    explanation: 'Personal protective equipment is essential for safety compliance in all SOP procedures.'
                };

            case 'true-false':
                return {
                    ...baseQuestion,
                    question: 'All steps in this SOP must be followed in the exact order specified.',
                    correctAnswer: true,
                    explanation: 'SOPs are designed with specific sequences to ensure safety and effectiveness.'
                };

            case 'scenario':
                return {
                    ...baseQuestion,
                    question: 'If you encounter an unexpected situation while following this SOP, what should you do?',
                    options: [
                        'Stop the procedure and consult your supervisor',
                        'Continue and hope for the best',
                        'Skip the problematic step',
                        'Make up your own solution'
                    ],
                    correctAnswer: 0,
                    explanation: 'When unexpected situations arise, it is important to stop and seek guidance to maintain safety.'
                };

            case 'short-answer':
                return {
                    ...baseQuestion,
                    question: 'List three key safety considerations mentioned in this SOP.',
                    sampleAnswer: 'Personal protective equipment, following proper procedures, and emergency protocols.',
                    explanation: 'Safety considerations are fundamental to all SOP compliance and workplace safety.'
                };

            default:
                return baseQuestion;
        }
    }

    /**
     * Utility method to simulate processing delay
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Promise that resolves after delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}