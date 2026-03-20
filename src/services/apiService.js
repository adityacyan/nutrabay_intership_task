/**
 * API Service — HTTP client for the FastAPI backend
 */

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * Upload and fully process a document (parse + AI content generation)
 * @param {File} file
 * @returns {Promise<Object>} ProcessResponse {success, parsed_document, generated_content, error}
 */
export async function processDocument(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${BASE_URL}/api/process`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Unknown server error' }));
        throw new Error(err.detail || `Server error ${response.status}`);
    }

    return response.json();
}

/**
 * Parse a document only (no AI) — returns parsed structure
 * @param {File} file
 * @returns {Promise<Object>} ProcessResponse {success, parsed_document}
 */
export async function parseDocument(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${BASE_URL}/api/parse`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Unknown server error' }));
        throw new Error(err.detail || `Server error ${response.status}`);
    }

    return response.json();
}

/**
 * Check backend health
 * @returns {Promise<Object>} {status, gemini_configured}
 */
export async function checkHealth() {
    const response = await fetch(`${BASE_URL}/api/health`);
    if (!response.ok) throw new Error('Backend unreachable');
    return response.json();
}
