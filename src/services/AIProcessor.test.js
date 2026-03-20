import AIProcessor from './AIProcessor';

// Mock the Google Generative AI
jest.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
            generateContent: jest.fn()
        })
    }))
}));

describe('AIProcessor', () => {
    let processor;
    let mockModel;
    let mockGenAI;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Create mock model
        mockModel = {
            generateContent: jest.fn()
        };

        // Create mock GenAI
        mockGenAI = {
            getGenerativeModel: jest.fn().mockReturnValue(mockModel)
        };

        // Mock the GoogleGenerativeAI constructor
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        GoogleGenerativeAI.mockImplementation(() => mockGenAI);

        processor = new AIProcessor('test-api-key');
    });

    describe('initialization', () => {
        test('should create processor with API key', () => {
            expect(processor.apiKey).toBe('test-api-key');
            expect(processor.initialized).toBe(false);
        });

        test('should initialize successfully with valid API key', () => {
            const result = processor.initialize('valid-key');

            expect(result).toBe(true);
            expect(processor.initialized).toBe(true);
            expect(processor.isInitialized()).toBe(true);
        });

        test('should throw error when initializing without API key', () => {
            const processorWithoutKey = new AIProcessor();

            expect(() => processorWithoutKey.initialize()).toThrow('Gemini API key is required');
        });

        test('should use environment variable for API key', () => {
            process.env.REACT_APP_GEMINI_API_KEY = 'env-api-key';
            const processorFromEnv = new AIProcessor();

            processorFromEnv.initialize();

            expect(processorFromEnv.apiKey).toBe('env-api-key');
            expect(processorFromEnv.initialized).toBe(true);

            delete process.env.REACT_APP_GEMINI_API_KEY;
        });
    });

    describe('generateSummary', () => {
        beforeEach(() => {
            processor.initialize();
        });

        test('should throw error if not initialized', async () => {
            const uninitializedProcessor = new AIProcessor();

            await expect(uninitializedProcessor.generateSummary({}))
                .rejects.toThrow('AI service not initialized');
        });

        test('should throw error for invalid content', async () => {
            await expect(processor.generateSummary(null))
                .rejects.toThrow('Invalid content provided');

            await expect(processor.generateSummary({}))
                .rejects.toThrow('Invalid content provided');

            await expect(processor.generateSummary({ procedures: 'not-array' }))
                .rejects.toThrow('Invalid content provided');
        });

        test('should generate summary successfully', async () => {
            const mockContent = {
                procedures: [
                    { content: 'Step 1: Wear safety equipment', isSafetyRelated: true },
                    { content: 'Step 2: Check equipment', isSafetyRelated: false }
                ],
                safetyRequirements: [
                    { content: 'Wear PPE', severity: 'high' }
                ],
                structure: {
                    documentType: 'safety_procedure'
                }
            };

            const mockResponse = {
                response: {
                    text: () => JSON.stringify({
                        title: 'Safety Equipment Procedure',
                        overview: 'This procedure covers proper safety equipment usage.',
                        keyPoints: ['Wear PPE', 'Check equipment'],
                        safetyHighlights: ['PPE is mandatory'],
                        estimatedTime: '15 minutes',
                        prerequisites: ['Safety training'],
                        riskLevel: 'medium'
                    })
                }
            };

            mockModel.generateContent.mockResolvedValue(mockResponse);

            const result = await processor.generateSummary(mockContent);

            expect(result).toMatchObject({
                title: 'Safety Equipment Procedure',
                overview: 'This procedure covers proper safety equipment usage.',
                keyPoints: expect.arrayContaining(['Wear PPE', 'Check equipment']),
                riskLevel: 'medium'
            });

            expect(mockModel.generateContent).toHaveBeenCalledWith(expect.stringContaining('Step 1: Wear safety equipment'));
        });

        test('should handle malformed JSON response', async () => {
            const mockContent = {
                procedures: [{ content: 'Test step' }],
                safetyRequirements: [],
                structure: {}
            };

            const mockResponse = {
                response: {
                    text: () => 'This is not valid JSON but contains useful information about the procedure.'
                }
            };

            mockModel.generateContent.mockResolvedValue(mockResponse);

            const result = await processor.generateSummary(mockContent);

            expect(result).toMatchObject({
                title: 'SOP Summary',
                overview: expect.stringContaining('This is not valid JSON'),
                keyPoints: expect.arrayContaining(['Summary generated from AI response'])
            });
        });
    });

    describe('createTrainingSteps', () => {
        beforeEach(() => {
            processor.initialize();
        });

        test('should throw error for invalid procedures', async () => {
            await expect(processor.createTrainingSteps(null))
                .rejects.toThrow('Invalid procedures provided');

            await expect(processor.createTrainingSteps([]))
                .rejects.toThrow('Invalid procedures provided');

            await expect(processor.createTrainingSteps('not-array'))
                .rejects.toThrow('Invalid procedures provided');
        });

        test('should create training steps successfully', async () => {
            const mockProcedures = [
                {
                    content: 'Put on safety glasses',
                    isSafetyRelated: true,
                    additionalContext: ['Required for all lab work']
                },
                {
                    content: 'Check equipment status',
                    isSafetyRelated: false
                }
            ];

            const mockResponse = {
                response: {
                    text: () => JSON.stringify({
                        title: 'Safety Training Module',
                        learningObjectives: ['Understand safety procedures', 'Perform equipment checks'],
                        estimatedDuration: '20 minutes',
                        trainingSteps: [
                            {
                                stepNumber: 1,
                                title: 'Safety Equipment',
                                instruction: 'Always wear safety glasses before starting work',
                                keyPoints: ['Safety glasses are mandatory'],
                                safetyNotes: ['Check for cracks or damage'],
                                commonMistakes: ['Forgetting to wear glasses'],
                                checkpoints: ['Glasses are properly fitted']
                            }
                        ],
                        summary: 'Completed safety training',
                        nextSteps: 'Begin supervised practice'
                    })
                }
            };

            mockModel.generateContent.mockResolvedValue(mockResponse);

            const result = await processor.createTrainingSteps(mockProcedures);

            expect(result).toMatchObject({
                title: 'Safety Training Module',
                learningObjectives: expect.arrayContaining(['Understand safety procedures']),
                trainingSteps: expect.arrayContaining([
                    expect.objectContaining({
                        stepNumber: 1,
                        title: 'Safety Equipment',
                        instruction: expect.stringContaining('safety glasses')
                    })
                ])
            });

            expect(mockModel.generateContent).toHaveBeenCalledWith(expect.stringContaining('Put on safety glasses [SAFETY CRITICAL]'));
        });
    });

    describe('generateQuestions', () => {
        beforeEach(() => {
            processor.initialize();
        });

        test('should throw error for invalid parameters', async () => {
            await expect(processor.generateQuestions(null))
                .rejects.toThrow('Content is required');

            await expect(processor.generateQuestions({}, 2))
                .rejects.toThrow('Question count must be between 3 and 5');

            await expect(processor.generateQuestions({}, 6))
                .rejects.toThrow('Question count must be between 3 and 5');
        });

        test('should generate questions successfully', async () => {
            const mockContent = {
                procedures: [
                    { content: 'Wear safety equipment', isSafetyRelated: true },
                    { content: 'Start the machine', isSafetyRelated: false }
                ],
                safetyRequirements: [
                    { content: 'PPE required', severity: 'high' }
                ]
            };

            const mockResponse = {
                response: {
                    text: () => JSON.stringify({
                        instructions: 'Answer all questions carefully',
                        passingScore: 80,
                        questions: [
                            {
                                id: 1,
                                type: 'multiple_choice',
                                question: 'What safety equipment is required?',
                                options: ['Safety glasses', 'Hard hat', 'Gloves', 'All of the above'],
                                correctAnswer: 'All of the above',
                                explanation: 'All listed safety equipment is required',
                                difficulty: 'medium',
                                category: 'safety'
                            },
                            {
                                id: 2,
                                type: 'true_false',
                                question: 'You can start the machine without safety equipment',
                                options: ['True', 'False'],
                                correctAnswer: 'False',
                                explanation: 'Safety equipment is always required',
                                difficulty: 'easy',
                                category: 'safety'
                            }
                        ]
                    })
                }
            };

            mockModel.generateContent.mockResolvedValue(mockResponse);

            const result = await processor.generateQuestions(mockContent, 4);

            expect(result).toMatchObject({
                instructions: expect.stringContaining('Answer all questions'),
                passingScore: 80,
                questions: expect.arrayContaining([
                    expect.objectContaining({
                        id: 1,
                        type: 'multiple_choice',
                        question: expect.stringContaining('safety equipment'),
                        category: 'safety'
                    })
                ])
            });

            expect(mockModel.generateContent).toHaveBeenCalledWith(expect.stringContaining('create 4 evaluation questions'));
        });
    });

    describe('error handling and retry logic', () => {
        beforeEach(() => {
            processor.initialize();
        });

        test('should retry on rate limit errors', async () => {
            const mockContent = {
                procedures: [{ content: 'Test step' }],
                safetyRequirements: [],
                structure: {}
            };

            // First call fails with rate limit, second succeeds
            mockModel.generateContent
                .mockRejectedValueOnce(new Error('rate limit exceeded'))
                .mockResolvedValueOnce({
                    response: {
                        text: () => JSON.stringify({
                            title: 'Test Summary',
                            overview: 'Test overview',
                            keyPoints: ['Test point'],
                            safetyHighlights: [],
                            estimatedTime: '5 minutes',
                            prerequisites: [],
                            riskLevel: 'low'
                        })
                    }
                });

            const result = await processor.generateSummary(mockContent);

            expect(result.title).toBe('Test Summary');
            expect(mockModel.generateContent).toHaveBeenCalledTimes(2);
        });

        test('should fail after max retries', async () => {
            // Increase timeout for this test
            jest.setTimeout(10000);

            const mockContent = {
                procedures: [{ content: 'Test step' }],
                safetyRequirements: [],
                structure: {}
            };

            // Always fail with rate limit error
            mockModel.generateContent.mockRejectedValue(new Error('rate limit exceeded'));

            await expect(processor.generateSummary(mockContent))
                .rejects.toThrow('Summary generation failed');

            expect(mockModel.generateContent).toHaveBeenCalledTimes(4); // Initial + 3 retries
        }, 10000); // 10 second timeout

        test('should not retry on non-retryable errors', async () => {
            const mockContent = {
                procedures: [{ content: 'Test step' }],
                safetyRequirements: [],
                structure: {}
            };

            mockModel.generateContent.mockRejectedValue(new Error('invalid API key'));

            await expect(processor.generateSummary(mockContent))
                .rejects.toThrow('Summary generation failed');

            expect(mockModel.generateContent).toHaveBeenCalledTimes(1); // No retries
        });

        test('should handle empty responses', async () => {
            const mockContent = {
                procedures: [{ content: 'Test step' }],
                safetyRequirements: [],
                structure: {}
            };

            mockModel.generateContent.mockResolvedValue({
                response: {
                    text: () => ''
                }
            });

            await expect(processor.generateSummary(mockContent))
                .rejects.toThrow('Empty response from AI service');
        });
    });

    describe('private helper methods', () => {
        test('_shouldRetry should identify retryable errors', () => {
            expect(processor._shouldRetry(new Error('rate limit exceeded'))).toBe(true);
            expect(processor._shouldRetry(new Error('quota exceeded'))).toBe(true);
            expect(processor._shouldRetry(new Error('service unavailable'))).toBe(true);
            expect(processor._shouldRetry(new Error('timeout occurred'))).toBe(true);
            expect(processor._shouldRetry(new Error('network error'))).toBe(true);
            expect(processor._shouldRetry(new Error('temporary failure'))).toBe(true);

            expect(processor._shouldRetry(new Error('invalid API key'))).toBe(false);
            expect(processor._shouldRetry(new Error('authentication failed'))).toBe(false);
            expect(processor._shouldRetry(new Error('malformed request'))).toBe(false);
        });

        test('_delay should create proper delay', async () => {
            const start = Date.now();
            await processor._delay(100);
            const end = Date.now();

            expect(end - start).toBeGreaterThanOrEqual(90); // Allow some variance
            expect(end - start).toBeLessThan(150);
        });

        test('_buildSummaryPrompt should include all content', () => {
            const content = {
                procedures: [
                    { content: 'Step 1: Test' },
                    { content: 'Step 2: Verify' }
                ],
                safetyRequirements: [
                    { content: 'Wear PPE', severity: 'high' }
                ],
                structure: {
                    documentType: 'safety_procedure'
                }
            };

            const prompt = processor._buildSummaryPrompt(content);

            expect(prompt).toContain('Step 1: Test');
            expect(prompt).toContain('Step 2: Verify');
            expect(prompt).toContain('Wear PPE');
            expect(prompt).toContain('safety_procedure');
            expect(prompt).toContain('JSON format');
        });

        test('_buildTrainingPrompt should format procedures correctly', () => {
            const procedures = [
                {
                    content: 'Safety step',
                    isSafetyRelated: true,
                    additionalContext: ['Important context']
                },
                {
                    content: 'Regular step',
                    isSafetyRelated: false
                }
            ];

            const prompt = processor._buildTrainingPrompt(procedures);

            expect(prompt).toContain('Safety step [SAFETY CRITICAL]');
            expect(prompt).toContain('Context: Important context');
            expect(prompt).toContain('Regular step');
            expect(prompt).toContain('trainingSteps');
        });

        test('_buildQuestionPrompt should include question count', () => {
            const content = {
                procedures: [{ content: 'Test step', isSafetyRelated: true }],
                safetyRequirements: [{ content: 'Safety req', severity: 'medium' }]
            };

            const prompt = processor._buildQuestionPrompt(content, 3);

            expect(prompt).toContain('create 3 evaluation questions');
            expect(prompt).toContain('Test step [SAFETY]');
            expect(prompt).toContain('Safety req (medium severity)');
        });
    });

    describe('response parsing', () => {
        test('_parseSummaryResponse should handle valid JSON', () => {
            const validJson = JSON.stringify({
                title: 'Test Title',
                overview: 'Test overview',
                keyPoints: ['Point 1'],
                riskLevel: 'low'
            });

            const result = processor._parseSummaryResponse(`Some text ${validJson} more text`);

            expect(result).toMatchObject({
                title: 'Test Title',
                overview: 'Test overview',
                keyPoints: ['Point 1'],
                riskLevel: 'low'
            });
        });

        test('_parseSummaryResponse should handle invalid JSON', () => {
            const invalidResponse = 'This is not JSON but contains useful information';

            const result = processor._parseSummaryResponse(invalidResponse);

            expect(result).toMatchObject({
                title: 'SOP Summary',
                overview: expect.stringContaining('This is not JSON'),
                keyPoints: ['Summary generated from AI response']
            });
        });

        test('_parseTrainingResponse should create fallback structure', () => {
            const invalidResponse = 'Training content without JSON structure';

            const result = processor._parseTrainingResponse(invalidResponse);

            expect(result).toMatchObject({
                title: 'Training Module',
                learningObjectives: expect.arrayContaining(['Complete the procedure safely and effectively']),
                trainingSteps: expect.arrayContaining([
                    expect.objectContaining({
                        stepNumber: 1,
                        title: 'Generated Training Content'
                    })
                ])
            });
        });

        test('_parseQuestionResponse should create fallback questions', () => {
            const invalidResponse = 'Question content without JSON';

            const result = processor._parseQuestionResponse(invalidResponse);

            expect(result).toMatchObject({
                instructions: expect.stringContaining('Answer all questions'),
                passingScore: 80,
                questions: expect.arrayContaining([
                    expect.objectContaining({
                        id: 1,
                        type: 'multiple_choice',
                        question: expect.stringContaining('important aspect'),
                        category: 'safety'
                    })
                ])
            });
        });
    });
});