/**
 * API Service — HTTP client for the FastAPI backend
 */

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * Upload and fully process a document with streaming (parse + AI content generation)
 * @param {File} file
 * @param {Object} callbacks - { onStatus, onParsed, onSummary, onTraining, onEvaluation, onComplete, onError }
 * @returns {Promise<void>}
 */
export async function processDocumentStreaming(file, callbacks = {}) {
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

    // Handle Server-Sent Events stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete messages (SSE format: "data: {...}\n\n")
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || ''; // Keep incomplete message in buffer

        for (const message of messages) {
            if (!message.trim() || !message.startsWith('data: ')) continue;

            try {
                const jsonStr = message.substring(6); // Remove "data: " prefix
                const event = JSON.parse(jsonStr);

                switch (event.type) {
                    case 'status':
                        callbacks.onStatus?.(event.message, event.step);
                        break;
                    case 'parsed':
                        callbacks.onParsed?.(event.data);
                        break;
                    case 'summary_chunk':
                        callbacks.onSummaryChunk?.(event.text);
                        break;
                    case 'summary_complete':
                        callbacks.onSummaryComplete?.(event.data);
                        break;
                    case 'training':
                        callbacks.onTraining?.(event.data);
                        break;
                    case 'evaluation':
                        callbacks.onEvaluation?.(event.data);
                        break;
                    case 'complete':
                        callbacks.onComplete?.(event.project_id);
                        break;
                    case 'error':
                        callbacks.onError?.(event.message);
                        break;
                }
            } catch (e) {
                console.error('Failed to parse SSE message:', e, message);
            }
        }
    }
}

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

/**
 * List all saved projects
 * @returns {Promise<Object>} { projects: [...] }
 */
export async function listProjects() {
    const response = await fetch(`${BASE_URL}/api/projects`);
    if (!response.ok) throw new Error('Failed to load projects');
    return response.json();
}

/**
 * Get full content for a saved project
 * @param {string} projectId
 * @returns {Promise<Object>} { metadata, summary, training_material, evaluation }
 */
export async function getProject(projectId) {
    const response = await fetch(`${BASE_URL}/api/projects/${projectId}`);
    if (!response.ok) throw new Error('Project not found');
    return response.json();
}

/**
 * Delete a saved project
 * @param {string} projectId
 * @returns {Promise<Object>} { success: true }
 */
export async function deleteProject(projectId) {
    const response = await fetch(`${BASE_URL}/api/projects/${projectId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete project');
    return response.json();
}

// ---------------------------------------------------------------------------
// Automation API
// ---------------------------------------------------------------------------

/**
 * Configure folder watcher for automatic processing
 * @param {string} folderPath - Path to folder to monitor
 * @param {Object} settings - Watcher settings
 * @returns {Promise<Object>} Configuration result
 */
export async function configureWatcher(folderPath, settings = {}) {
    const response = await fetch(`${BASE_URL}/api/automation/configure-watcher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            folder_path: folderPath,
            file_patterns: settings.filePatterns || ['*.txt', '*.pdf'],
            recursive: settings.recursive || false,
            debounce_seconds: settings.debounceSeconds || 2
        })
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Failed to configure watcher' }));
        throw new Error(err.detail);
    }
    return response.json();
}

/**
 * Stop monitoring a folder
 * @param {string} watchId - Watch ID (folder path)
 * @returns {Promise<Object>} { success: true }
 */
export async function stopWatcher(watchId) {
    const response = await fetch(`${BASE_URL}/api/automation/watcher/${encodeURIComponent(watchId)}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to stop watcher');
    return response.json();
}

/**
 * List all active folder watchers
 * @returns {Promise<Object>} { watchers: [...] }
 */
export async function listWatchers() {
    const response = await fetch(`${BASE_URL}/api/automation/watchers`);
    if (!response.ok) throw new Error('Failed to list watchers');
    return response.json();
}

/**
 * Add Google Drive folder to monitor
 * @param {string} folderId - Google Drive folder ID
 * @param {Object} options - Optional settings
 * @returns {Promise<Object>} Result
 */
export async function addGoogleDriveFolder(folderId, options = {}) {
    const response = await fetch(`${BASE_URL}/api/automation/google-drive/add-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            folder_id: folderId,
            folder_name: options.folderName,
            file_types: options.fileTypes || ['application/pdf', 'text/plain']
        })
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Failed to add Google Drive folder' }));
        throw new Error(err.detail);
    }
    return response.json();
}

/**
 * Remove Google Drive folder from monitoring
 * @param {string} folderId - Google Drive folder ID
 * @returns {Promise<Object>} { success: true }
 */
export async function removeGoogleDriveFolder(folderId) {
    const response = await fetch(`${BASE_URL}/api/automation/google-drive/folder/${folderId}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to remove Google Drive folder');
    return response.json();
}

/**
 * Get Google Drive monitoring status
 * @returns {Promise<Object>} Status information
 */
export async function getGoogleDriveStatus() {
    const response = await fetch(`${BASE_URL}/api/automation/google-drive/status`);
    if (!response.ok) throw new Error('Failed to get Google Drive status');
    return response.json();
}

/**
 * Start automation processing worker
 * @returns {Promise<Object>} { success: true }
 */
export async function startAutomationWorker() {
    const response = await fetch(`${BASE_URL}/api/automation/start-worker`, {
        method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to start automation worker');
    return response.json();
}

/**
 * Stop automation processing worker
 * @returns {Promise<Object>} { success: true }
 */
export async function stopAutomationWorker() {
    const response = await fetch(`${BASE_URL}/api/automation/stop-worker`, {
        method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to stop automation worker');
    return response.json();
}

/**
 * Get automation notifications
 * @returns {Promise<Object>} { notifications: [...] }
 */
export async function getAutomationNotifications() {
    const response = await fetch(`${BASE_URL}/api/automation/notifications`);
    if (!response.ok) throw new Error('Failed to get notifications');
    return response.json();
}
