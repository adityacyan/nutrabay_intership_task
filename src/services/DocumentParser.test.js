import DocumentParser from './DocumentParser';

// Mock pdfjs-dist
jest.mock('pdfjs-dist', () => ({
    GlobalWorkerOptions: {
        workerSrc: ''
    },
    getDocument: jest.fn(),
    version: '3.0.279'
}));

const mockPdfjsLib = require('pdfjs-dist');

describe('DocumentParser', () => {
    let parser;

    beforeEach(() => {
        parser = new DocumentParser();
        jest.clearAllMocks();
    });

    describe('validateFile', () => {
        test('validates file size correctly', () => {
            const largeFile = {
                size: 11 * 1024 * 1024, // 11MB
                name: 'test.txt',
                type: 'text/plain'
            };

            const result = parser.validateFile(largeFile);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('File size exceeds limit');
        });

        test('validates file type correctly', () => {
            const invalidFile = {
                size: 1024,
                name: 'test.doc',
                type: 'application/msword'
            };

            const result = parser.validateFile(invalidFile);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Unsupported file format');
        });

        test('accepts valid text file', () => {
            const validFile = {
                size: 1024,
                name: 'test.txt',
                type: 'text/plain'
            };

            const result = parser.validateFile(validFile);
            expect(result.isValid).toBe(true);
            expect(result.error).toBeNull();
        });

        test('accepts valid PDF file', () => {
            const validFile = {
                size: 1024,
                name: 'test.pdf',
                type: 'application/pdf'
            };

            const result = parser.validateFile(validFile);
            expect(result.isValid).toBe(true);
            expect(result.error).toBeNull();
        });

        test('accepts files based on extension when MIME type is missing', () => {
            const txtFile = {
                size: 1024,
                name: 'test.txt',
                type: ''
            };

            const pdfFile = {
                size: 1024,
                name: 'test.pdf',
                type: ''
            };

            expect(parser.validateFile(txtFile).isValid).toBe(true);
            expect(parser.validateFile(pdfFile).isValid).toBe(true);
        });

        test('handles null file', () => {
            const result = parser.validateFile(null);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('No file provided');
        });
    });

    describe('parseDocument', () => {
        test('throws error for invalid file', async () => {
            const invalidFile = {
                size: 11 * 1024 * 1024,
                name: 'test.txt',
                type: 'text/plain'
            };

            await expect(parser.parseDocument(invalidFile)).rejects.toThrow('File size exceeds limit');
        });

        test('parses text file successfully', async () => {
            const textFile = new File(['This is a test SOP document.\nStep 1: Do something\nStep 2: Do something else'], 'test.txt', {
                type: 'text/plain',
                lastModified: Date.now()
            });

            const result = await parser.parseDocument(textFile);

            expect(result).toHaveProperty('id');
            expect(result.filename).toBe('test.txt');
            expect(result.content).toContain('This is a test SOP document');
            expect(result.metadata.mimeType).toBe('text/plain');
            expect(result.metadata.wordCount).toBeGreaterThan(0);
            expect(result.structure.procedures).toHaveLength(2);
        });

        test('parses PDF file successfully', async () => {
            // Create a mock file with arrayBuffer method
            const pdfFile = {
                name: 'test.pdf',
                type: 'application/pdf',
                size: 1024,
                arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8))
            };

            // Mock PDF.js response
            const mockPage = {
                getTextContent: jest.fn().mockResolvedValue({
                    items: [
                        { str: 'This is extracted PDF text.' },
                        { str: 'Step 1: First procedure' },
                        { str: 'Step 2: Second procedure' }
                    ]
                })
            };

            const mockPdf = {
                numPages: 2,
                getPage: jest.fn().mockResolvedValue(mockPage)
            };

            mockPdfjsLib.getDocument.mockReturnValue({
                promise: Promise.resolve(mockPdf)
            });

            const result = await parser.parseDocument(pdfFile);

            expect(result.filename).toBe('test.pdf');
            expect(result.content).toContain('This is extracted PDF text');
            expect(result.metadata.pageCount).toBe(2);
            expect(result.structure.procedures).toHaveLength(2);
        });

        test('handles PDF parsing errors', async () => {
            const pdfFile = {
                name: 'test.pdf',
                type: 'application/pdf',
                size: 1024,
                arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8))
            };

            mockPdfjsLib.getDocument.mockReturnValue({
                promise: Promise.reject(new Error('Invalid PDF'))
            });

            await expect(parser.parseDocument(pdfFile)).rejects.toThrow('Failed to parse document: PDF parsing failed: Invalid PDF');
        });
    });

    describe('analyzeStructure', () => {
        test('identifies headings correctly', () => {
            const content = `SAFETY PROCEDURES
1. GENERAL REQUIREMENTS
A. Equipment Setup
This is regular text`;

            const structure = parser.analyzeStructure(content);

            expect(structure.headings).toHaveLength(3);
            expect(structure.headings[0].text).toBe('SAFETY PROCEDURES');
            expect(structure.headings[1].text).toBe('1. GENERAL REQUIREMENTS');
            expect(structure.headings[2].text).toBe('A. Equipment Setup');
        });

        test('identifies procedure steps correctly', () => {
            const content = `Step 1: First procedure
Step 2: Second procedure
Procedure 3: Third procedure
1. Fourth procedure`;

            const structure = parser.analyzeStructure(content);

            expect(structure.procedures).toHaveLength(4);
            expect(structure.procedures[0].stepNumber).toBe(1);
            expect(structure.procedures[1].stepNumber).toBe(2);
            expect(structure.procedures[2].stepNumber).toBe(3);
            expect(structure.procedures[3].stepNumber).toBe(1);
        });

        test('identifies numbered lists correctly', () => {
            const content = `1. First item
2. Second item
3. Third item`;

            const structure = parser.analyzeStructure(content);

            expect(structure.numberedLists).toHaveLength(3);
        });

        test('identifies bullet points correctly', () => {
            const content = `- First bullet
• Second bullet
* Third bullet`;

            const structure = parser.analyzeStructure(content);

            expect(structure.bulletPoints).toHaveLength(3);
        });
    });

    describe('utility methods', () => {
        test('counts words correctly', () => {
            const text = 'This is a test document with multiple words';
            expect(parser.countWords(text)).toBe(8);
        });

        test('counts lines correctly', () => {
            const text = 'Line 1\nLine 2\nLine 3';
            expect(parser.countLines(text)).toBe(3);
        });

        test('detects MIME type from filename', () => {
            expect(parser.detectMimeType('test.pdf')).toBe('application/pdf');
            expect(parser.detectMimeType('test.txt')).toBe('text/plain');
            expect(parser.detectMimeType('test.unknown')).toBe('application/octet-stream');
        });

        test('generates unique IDs', () => {
            const id1 = parser.generateId();
            const id2 = parser.generateId();

            expect(id1).not.toBe(id2);
            expect(typeof id1).toBe('string');
            expect(id1.length).toBeGreaterThan(0);
        });
    });

    describe('isHeading', () => {
        test('identifies all caps headings', () => {
            expect(parser.isHeading('SAFETY PROCEDURES')).toBe(true);
            expect(parser.isHeading('GENERAL REQUIREMENTS')).toBe(true);
            expect(parser.isHeading('AB')).toBe(false); // Too short
            expect(parser.isHeading('Mixed Case')).toBe(false);
        });

        test('identifies numbered headings', () => {
            expect(parser.isHeading('1. GENERAL REQUIREMENTS')).toBe(true);
            expect(parser.isHeading('A. Equipment Setup')).toBe(true);
            expect(parser.isHeading('1. lowercase heading')).toBe(false);
        });

        test('identifies section headings', () => {
            expect(parser.isHeading('SECTION 1')).toBe(true);
            expect(parser.isHeading('CHAPTER 2')).toBe(true);
            expect(parser.isHeading('PROCEDURE 3')).toBe(true);
        });
    });

    describe('isProcedureStep', () => {
        test('identifies step patterns', () => {
            expect(parser.isProcedureStep('Step 1: Do something')).toBe(true);
            expect(parser.isProcedureStep('Procedure 2: Do something')).toBe(true);
            expect(parser.isProcedureStep('1. Do something')).toBe(true);
            expect(parser.isProcedureStep('Regular text')).toBe(false);
        });
    });

    describe('extractMetadata', () => {
        test('extracts metadata correctly', () => {
            const document = {
                id: 'test-id',
                filename: 'test.txt',
                content: 'Test content',
                metadata: {
                    wordCount: 10,
                    lineCount: 5,
                    mimeType: 'text/plain',
                    originalSize: 1024
                },
                structure: {
                    headings: [1, 2],
                    procedures: [1, 2, 3],
                    sections: []
                },
                createdAt: new Date()
            };

            const metadata = parser.extractMetadata(document);

            expect(metadata.id).toBe('test-id');
            expect(metadata.filename).toBe('test.txt');
            expect(metadata.wordCount).toBe(10);
            expect(metadata.structure.headingCount).toBe(2);
            expect(metadata.structure.procedureCount).toBe(3);
        });
    });
});