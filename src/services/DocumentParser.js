import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

class DocumentParser {
    constructor() {
        this.supportedTypes = {
            'text/plain': ['.txt'],
            'application/pdf': ['.pdf']
        };
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
    }

    /**
     * Validates if a file meets the requirements for processing
     * @param {File} file - The file to validate
     * @returns {Object} - Validation result with success flag and error message
     */
    validateFile(file) {
        if (!file) {
            return {
                isValid: false,
                error: 'No file provided'
            };
        }

        // Check file size
        if (file.size > this.maxFileSize) {
            return {
                isValid: false,
                error: `File size exceeds limit. Maximum size allowed is ${this.maxFileSize / (1024 * 1024)}MB.`
            };
        }

        // Check file type
        const isValidType = Object.keys(this.supportedTypes).includes(file.type) ||
            file.name.toLowerCase().endsWith('.txt') ||
            file.name.toLowerCase().endsWith('.pdf');

        if (!isValidType) {
            return {
                isValid: false,
                error: 'Unsupported file format. Please upload text (.txt) or PDF (.pdf) files only.'
            };
        }

        return {
            isValid: true,
            error: null
        };
    }

    /**
     * Parses a document file and extracts text content
     * @param {File} file - The file to parse
     * @returns {Promise<Object>} - Parsed document object
     */
    async parseDocument(file) {
        const validation = this.validateFile(file);
        if (!validation.isValid) {
            throw new Error(validation.error);
        }

        try {
            let content = '';
            let metadata = {};

            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                const result = await this.parsePDF(file);
                content = result.content;
                metadata = result.metadata;
            } else if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
                const result = await this.parseTextFile(file);
                content = result.content;
                metadata = result.metadata;
            } else {
                throw new Error('Unsupported file type');
            }

            return {
                id: this.generateId(),
                filename: file.name,
                content: content.trim(),
                metadata: {
                    ...metadata,
                    originalSize: file.size,
                    mimeType: file.type || this.detectMimeType(file.name),
                    lastModified: file.lastModified ? new Date(file.lastModified) : null,
                    contentLength: content.length,
                    wordCount: this.countWords(content),
                    lineCount: this.countLines(content)
                },
                structure: this.analyzeStructure(content),
                createdAt: new Date()
            };
        } catch (error) {
            throw new Error(`Failed to parse document: ${error.message}`);
        }
    }

    /**
     * Parses PDF files and extracts text content
     * @param {File} file - PDF file to parse
     * @returns {Promise<Object>} - Extracted content and metadata
     */
    async parsePDF(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            let fullText = '';
            const pageTexts = [];

            // Extract text from each page
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();

                const pageText = textContent.items
                    .map(item => item.str)
                    .join(' ')
                    .replace(/\s+/g, ' ')
                    .trim();

                pageTexts.push(pageText);
                fullText += pageText + '\n';
            }

            return {
                content: fullText.trim(),
                metadata: {
                    pageCount: pdf.numPages,
                    pdfInfo: {},
                    version: null,
                    pageTexts: pageTexts
                }
            };
        } catch (error) {
            throw new Error(`PDF parsing failed: ${error.message}`);
        }
    }

    /**
     * Parses text files with encoding detection
     * @param {File} file - Text file to parse
     * @returns {Promise<Object>} - Extracted content and metadata
     */
    async parseTextFile(file) {
        try {
            // Try UTF-8 first
            let content = await this.readFileAsText(file, 'UTF-8');
            let encoding = 'UTF-8';

            // Check if content looks corrupted (contains replacement characters)
            if (content.includes('\uFFFD')) {
                // Try other common encodings
                const encodings = ['ISO-8859-1', 'Windows-1252'];

                for (const enc of encodings) {
                    try {
                        const testContent = await this.readFileAsText(file, enc);
                        if (!testContent.includes('\uFFFD')) {
                            content = testContent;
                            encoding = enc;
                            break;
                        }
                    } catch (e) {
                        // Continue to next encoding
                    }
                }
            }

            return {
                content,
                metadata: {
                    encoding,
                    detectedEncoding: encoding !== 'UTF-8'
                }
            };
        } catch (error) {
            throw new Error(`Text file parsing failed: ${error.message}`);
        }
    }

    /**
     * Reads file as text with specified encoding
     * @param {File} file - File to read
     * @param {string} encoding - Text encoding to use
     * @returns {Promise<string>} - File content as text
     */
    readFileAsText(file, encoding = 'UTF-8') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (event) => {
                resolve(event.target.result);
            };

            reader.onerror = (error) => {
                reject(new Error(`File reading failed: ${error.message}`));
            };

            // Use readAsText with encoding parameter
            reader.readAsText(file, encoding);
        });
    }

    /**
     * Analyzes document structure to identify headings, sections, etc.
     * @param {string} content - Document content
     * @returns {Object} - Structure analysis
     */
    analyzeStructure(content) {
        const lines = content.split('\n');
        const structure = {
            headings: [],
            sections: [],
            procedures: [],
            numberedLists: [],
            bulletPoints: []
        };

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();

            if (!trimmedLine) return;

            // Detect headings (lines that are all caps, or start with numbers/letters followed by periods)
            if (this.isHeading(trimmedLine)) {
                structure.headings.push({
                    text: trimmedLine,
                    lineNumber: index + 1,
                    level: this.getHeadingLevel(trimmedLine)
                });
            }

            // Detect numbered procedures (1., 2., Step 1, etc.)
            if (this.isProcedureStep(trimmedLine)) {
                structure.procedures.push({
                    text: trimmedLine,
                    lineNumber: index + 1,
                    stepNumber: this.extractStepNumber(trimmedLine)
                });
            }

            // Detect numbered lists
            if (this.isNumberedListItem(trimmedLine)) {
                structure.numberedLists.push({
                    text: trimmedLine,
                    lineNumber: index + 1
                });
            }

            // Detect bullet points
            if (this.isBulletPoint(trimmedLine)) {
                structure.bulletPoints.push({
                    text: trimmedLine,
                    lineNumber: index + 1
                });
            }
        });

        return structure;
    }

    /**
     * Determines if a line is likely a heading
     * @param {string} line - Line to analyze
     * @returns {boolean} - True if line appears to be a heading
     */
    isHeading(line) {
        // All caps (at least 3 characters)
        if (line.length >= 3 && line === line.toUpperCase() && /^[A-Z\s]+$/.test(line)) {
            return true;
        }

        // Starts with number and period or letter and period
        if (/^\d+\.\s+[A-Z]/.test(line) || /^[A-Z]\.\s+[A-Z]/.test(line)) {
            return true;
        }

        // Common heading patterns
        if (/^(SECTION|CHAPTER|PART|PROCEDURE|STEP)\s+\d+/i.test(line)) {
            return true;
        }

        return false;
    }

    /**
     * Gets the heading level (1-6)
     * @param {string} line - Heading line
     * @returns {number} - Heading level
     */
    getHeadingLevel(line) {
        if (/^\d+\.\s/.test(line)) return 1;
        if (/^[A-Z]\.\s/.test(line)) return 2;
        if (line === line.toUpperCase()) return 1;
        return 3;
    }

    /**
     * Determines if a line is a procedure step
     * @param {string} line - Line to analyze
     * @returns {boolean} - True if line is a procedure step
     */
    isProcedureStep(line) {
        return /^(step\s+\d+|procedure\s+\d+|\d+\.\s)/i.test(line);
    }

    /**
     * Extracts step number from procedure line
     * @param {string} line - Procedure line
     * @returns {number|null} - Step number or null
     */
    extractStepNumber(line) {
        const match = line.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : null;
    }

    /**
     * Determines if a line is a numbered list item
     * @param {string} line - Line to analyze
     * @returns {boolean} - True if line is numbered list item
     */
    isNumberedListItem(line) {
        return /^\d+\.\s/.test(line);
    }

    /**
     * Determines if a line is a bullet point
     * @param {string} line - Line to analyze
     * @returns {boolean} - True if line is a bullet point
     */
    isBulletPoint(line) {
        return /^[-•*]\s/.test(line);
    }

    /**
     * Counts words in text
     * @param {string} text - Text to count
     * @returns {number} - Word count
     */
    countWords(text) {
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    /**
     * Counts lines in text
     * @param {string} text - Text to count
     * @returns {number} - Line count
     */
    countLines(text) {
        return text.split('\n').length;
    }

    /**
     * Detects MIME type from file extension
     * @param {string} filename - File name
     * @returns {string} - MIME type
     */
    detectMimeType(filename) {
        const ext = filename.toLowerCase().split('.').pop();
        switch (ext) {
            case 'pdf':
                return 'application/pdf';
            case 'txt':
                return 'text/plain';
            default:
                return 'application/octet-stream';
        }
    }

    /**
     * Generates a unique ID for the document
     * @returns {string} - Unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Extracts metadata from parsed document
     * @param {Object} document - Parsed document
     * @returns {Object} - Document metadata
     */
    extractMetadata(document) {
        return {
            id: document.id,
            filename: document.filename,
            contentLength: document.content.length,
            wordCount: document.metadata.wordCount,
            lineCount: document.metadata.lineCount,
            mimeType: document.metadata.mimeType,
            originalSize: document.metadata.originalSize,
            createdAt: document.createdAt,
            structure: {
                headingCount: document.structure.headings.length,
                procedureCount: document.structure.procedures.length,
                sectionCount: document.structure.sections.length
            }
        };
    }
}

export default DocumentParser;