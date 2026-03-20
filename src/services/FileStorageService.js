/**
 * FileStorageService - Manages organized output storage for processed SOP documents.
 * Handles hierarchical folder structure creation, file naming conventions,
 * and cleanup utilities for generated content.
 *
 * Requirements: 6.3, 6.4
 */
export class FileStorageService {
    constructor() {
        // Root key used in localStorage/sessionStorage for persisted metadata
        this.storageKey = 'sop_processor_storage';

        // Content type definitions with folder names and file suffixes
        this.contentTypes = {
            summary: { folder: 'summary', suffix: '_summary' },
            trainingMaterial: { folder: 'training', suffix: '_training' },
            evaluation: { folder: 'evaluation', suffix: '_evaluation' },
            presentation: { folder: 'presentation', suffix: '_presentation' },
            metadata: { folder: 'metadata', suffix: '_metadata' }
        };
    }

    // -------------------------------------------------------------------------
    // Folder structure helpers
    // -------------------------------------------------------------------------

    /**
     * Builds the hierarchical folder structure descriptor for a processed SOP.
     * Does not write to disk (browser environment); returns a plain object that
     * describes the intended layout and can be used by callers to organise
     * in-memory or cloud storage.
     *
     * @param {string} documentName - Original SOP filename (with or without extension)
     * @returns {Object} Folder structure descriptor
     */
    createOutputFolderStructure(documentName) {
        const baseName = this.sanitizeFileName(this.stripExtension(documentName));
        const timestamp = this.getTimestamp();
        const folderName = `${baseName}_${timestamp}`;

        const structure = {
            root: folderName,
            baseName,
            timestamp,
            createdAt: new Date().toISOString(),
            subFolders: {}
        };

        // Build sub-folder entries for every content type
        Object.entries(this.contentTypes).forEach(([type, config]) => {
            structure.subFolders[type] = {
                path: `${folderName}/${config.folder}`,
                folder: config.folder
            };
        });

        return structure;
    }

    /**
     * Returns the full virtual path for a specific content type within a folder structure.
     *
     * @param {Object} folderStructure - Result of createOutputFolderStructure()
     * @param {string} contentType - One of the keys in this.contentTypes
     * @returns {string} Virtual path string
     */
    getContentPath(folderStructure, contentType) {
        if (!this.contentTypes[contentType]) {
            throw new Error(`Unknown content type: ${contentType}`);
        }
        return folderStructure.subFolders[contentType].path;
    }

    // -------------------------------------------------------------------------
    // File naming conventions
    // -------------------------------------------------------------------------

    /**
     * Generates a consistent, descriptive file name for a piece of generated content.
     *
     * @param {string} documentName - Original SOP document name
     * @param {string} contentType - Content type key (summary, trainingMaterial, etc.)
     * @param {string} [extension='json'] - File extension without leading dot
     * @returns {string} Generated file name
     */
    generateFileName(documentName, contentType, extension = 'json') {
        if (!this.contentTypes[contentType]) {
            throw new Error(`Unknown content type: ${contentType}`);
        }

        const baseName = this.sanitizeFileName(this.stripExtension(documentName));
        const suffix = this.contentTypes[contentType].suffix;
        const timestamp = this.getTimestamp();

        return `${baseName}${suffix}_${timestamp}.${extension}`;
    }

    /**
     * Generates a full virtual file path (folder path + file name).
     *
     * @param {Object} folderStructure - Result of createOutputFolderStructure()
     * @param {string} contentType - Content type key
     * @param {string} [extension='json'] - File extension
     * @returns {string} Full virtual path
     */
    generateFilePath(folderStructure, contentType, extension = 'json') {
        const contentPath = this.getContentPath(folderStructure, contentType);
        const fileName = this.generateFileName(folderStructure.baseName, contentType, extension);
        return `${contentPath}/${fileName}`;
    }

    // -------------------------------------------------------------------------
    // Storage operations (browser localStorage-backed)
    // -------------------------------------------------------------------------

    /**
     * Stores generated content with organised metadata.
     * In a browser context this persists to localStorage; the method returns a
     * storage record that callers can use to retrieve or download the content.
     *
     * @param {Object} folderStructure - Result of createOutputFolderStructure()
     * @param {string} contentType - Content type key
     * @param {*} content - Content to store (will be JSON-serialised)
     * @param {string} [extension='json'] - File extension
     * @returns {Object} Storage record with path, fileName, size, storedAt
     */
    storeContent(folderStructure, contentType, content, extension = 'json') {
        const filePath = this.generateFilePath(folderStructure, contentType, extension);
        const fileName = filePath.split('/').pop();
        const serialized = JSON.stringify(content, null, 2);

        const record = {
            path: filePath,
            fileName,
            contentType,
            size: serialized.length,
            storedAt: new Date().toISOString(),
            folderRoot: folderStructure.root
        };

        // Persist to localStorage when available
        try {
            const existing = this._loadIndex();
            existing[filePath] = { record, data: serialized };
            localStorage.setItem(this.storageKey, JSON.stringify(existing));
        } catch (e) {
            // localStorage unavailable (e.g. SSR / test env) – silently continue
        }

        return record;
    }

    /**
     * Stores all generated content types for a processed SOP in one call.
     *
     * @param {string} documentName - Original SOP document name
     * @param {Object} generatedContent - Object with summary, trainingMaterial, evaluation keys
     * @returns {Object} { folderStructure, records } where records maps contentType → storage record
     */
    storeAllContent(documentName, generatedContent) {
        const folderStructure = this.createOutputFolderStructure(documentName);
        const records = {};

        const typeMap = {
            summary: generatedContent.summary,
            trainingMaterial: generatedContent.trainingMaterial,
            evaluation: generatedContent.evaluation
        };

        Object.entries(typeMap).forEach(([type, content]) => {
            if (content !== undefined && content !== null) {
                records[type] = this.storeContent(folderStructure, type, content);
            }
        });

        // Always store a metadata record
        const meta = {
            documentName,
            processedAt: generatedContent.generatedAt || new Date().toISOString(),
            contentTypes: Object.keys(records),
            folderStructure
        };
        records.metadata = this.storeContent(folderStructure, 'metadata', meta);

        return { folderStructure, records };
    }

    /**
     * Retrieves stored content by its virtual file path.
     *
     * @param {string} filePath - Virtual path returned by storeContent
     * @returns {*} Parsed content, or null if not found
     */
    retrieveContent(filePath) {
        try {
            const index = this._loadIndex();
            const entry = index[filePath];
            return entry ? JSON.parse(entry.data) : null;
        } catch (e) {
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // Cleanup and file management utilities
    // -------------------------------------------------------------------------

    /**
     * Lists all storage records, optionally filtered by folder root.
     *
     * @param {string} [folderRoot] - Optional folder root to filter by
     * @returns {Array<Object>} Array of storage records
     */
    listStoredFiles(folderRoot) {
        try {
            const index = this._loadIndex();
            const records = Object.values(index).map(entry => entry.record);
            if (folderRoot) {
                return records.filter(r => r.folderRoot === folderRoot);
            }
            return records;
        } catch (e) {
            return [];
        }
    }

    /**
     * Removes all stored files for a given folder root.
     *
     * @param {string} folderRoot - Folder root to delete
     * @returns {number} Number of files removed
     */
    deleteFolder(folderRoot) {
        try {
            const index = this._loadIndex();
            let removed = 0;

            Object.keys(index).forEach(path => {
                if (index[path].record.folderRoot === folderRoot) {
                    delete index[path];
                    removed++;
                }
            });

            localStorage.setItem(this.storageKey, JSON.stringify(index));
            return removed;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Removes stored files older than the specified number of days.
     *
     * @param {number} [maxAgeDays=30] - Maximum age in days
     * @returns {number} Number of files removed
     */
    cleanupOldFiles(maxAgeDays = 30) {
        try {
            const index = this._loadIndex();
            const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
            let removed = 0;

            Object.keys(index).forEach(path => {
                const storedAt = new Date(index[path].record.storedAt).getTime();
                if (storedAt < cutoff) {
                    delete index[path];
                    removed++;
                }
            });

            localStorage.setItem(this.storageKey, JSON.stringify(index));
            return removed;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Clears all stored SOP processor data.
     *
     * @returns {boolean} True if successful
     */
    clearAllStorage() {
        try {
            localStorage.removeItem(this.storageKey);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Returns storage usage statistics.
     *
     * @returns {Object} { totalFiles, totalSize, folders }
     */
    getStorageStats() {
        try {
            const index = this._loadIndex();
            const records = Object.values(index).map(e => e.record);

            const folders = [...new Set(records.map(r => r.folderRoot))];
            const totalSize = records.reduce((sum, r) => sum + (r.size || 0), 0);

            return {
                totalFiles: records.length,
                totalSize,
                folders: folders.map(root => ({
                    root,
                    fileCount: records.filter(r => r.folderRoot === root).length
                }))
            };
        } catch (e) {
            return { totalFiles: 0, totalSize: 0, folders: [] };
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Loads the storage index from localStorage.
     * @returns {Object}
     */
    _loadIndex() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    /**
     * Sanitizes a string for use as a file/folder name component.
     * Replaces spaces and special characters with underscores.
     *
     * @param {string} name - Raw name
     * @returns {string} Sanitized name
     */
    sanitizeFileName(name) {
        return name
            .replace(/[^a-zA-Z0-9_\-]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .toLowerCase();
    }

    /**
     * Strips the file extension from a filename.
     *
     * @param {string} filename - Filename with or without extension
     * @returns {string} Filename without extension
     */
    stripExtension(filename) {
        return filename.replace(/\.[^/.]+$/, '');
    }

    /**
     * Returns a compact timestamp string suitable for file names (YYYYMMDD_HHmmss).
     *
     * @returns {string} Timestamp string
     */
    getTimestamp() {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        return (
            `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
            `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
        );
    }
}

export default FileStorageService;
