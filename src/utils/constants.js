// Application constants
export const FILE_TYPES = {
    PDF: 'application/pdf',
    TEXT: 'text/plain',
    DOC: 'application/msword',
    DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

export const SUPPORTED_FILE_TYPES = [
    FILE_TYPES.PDF,
    FILE_TYPES.TEXT
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const PROCESSING_STAGES = {
    UPLOAD: 'upload',
    PARSING: 'parsing',
    EXTRACTION: 'extraction',
    AI_PROCESSING: 'ai_processing',
    GENERATION: 'generation',
    FORMATTING: 'formatting',
    COMPLETE: 'complete',
    ERROR: 'error'
};

export const QUESTION_TYPES = {
    MULTIPLE_CHOICE: 'multiple_choice',
    TRUE_FALSE: 'true_false',
    SCENARIO: 'scenario'
};