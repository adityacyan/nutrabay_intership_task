import React, { useState, useEffect } from 'react';
import {
    checkHealth,
    configureWatcher,
    stopWatcher,
    listWatchers,
    addGoogleDriveFolder,
    removeGoogleDriveFolder,
    getGoogleDriveStatus,
    startAutomationWorker,
    stopAutomationWorker
} from '../services/apiService';
import './AutomationConfig.css';

const AutomationConfig = () => {
    // Backend status
    const [backendStatus, setBackendStatus] = useState(null);
    const [geminiStatus, setGeminiStatus] = useState(false);

    // Local folder monitoring
    const [localFolderPath, setLocalFolderPath] = useState('');
    const [recursive, setRecursive] = useState(false);
    const [activeWatchers, setActiveWatchers] = useState([]);
    const [localError, setLocalError] = useState('');
    const [localSuccess, setLocalSuccess] = useState('');

    // Google Drive monitoring
    const [gdriveFolderId, setGdriveFolderId] = useState('');
    const [gdriveFolderName, setGdriveFolderName] = useState('');
    const [gdriveStatus, setGdriveStatus] = useState(null);
    const [gdriveError, setGdriveError] = useState('');
    const [gdriveSuccess, setGdriveSuccess] = useState('');

    // Worker status
    const [workerRunning, setWorkerRunning] = useState(false);
    const [workerError, setWorkerError] = useState('');

    // Loading states
    const [loading, setLoading] = useState(false);

    // Check backend health on mount
    useEffect(() => {
        checkHealth()
            .then(h => {
                setBackendStatus('ok');
                setGeminiStatus(h.gemini_configured);
            })
            .catch(() => setBackendStatus('error'));
    }, []);

    // Load active watchers and Google Drive status
    useEffect(() => {
        if (backendStatus === 'ok') {
            loadActiveWatchers();
            loadGoogleDriveStatus();
        }
    }, [backendStatus]);

    const loadActiveWatchers = async () => {
        try {
            const result = await listWatchers();
            setActiveWatchers(result.watchers || []);
        } catch (err) {
            console.error('Failed to load watchers:', err);
        }
    };

    const loadGoogleDriveStatus = async () => {
        try {
            const status = await getGoogleDriveStatus();
            setGdriveStatus(status);
        } catch (err) {
            console.error('Failed to load Google Drive status:', err);
        }
    };

    // Local folder monitoring handlers
    const handleAddLocalFolder = async () => {
        if (!localFolderPath.trim()) {
            setLocalError('Please enter a folder path');
            return;
        }

        setLoading(true);
        setLocalError('');
        setLocalSuccess('');

        try {
            await configureWatcher(localFolderPath, { recursive });
            setLocalSuccess(`Started monitoring: ${localFolderPath}`);
            setLocalFolderPath('');
            await loadActiveWatchers();
        } catch (err) {
            setLocalError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStopWatcher = async (watchId) => {
        setLoading(true);
        setLocalError('');

        try {
            await stopWatcher(watchId);
            setLocalSuccess(`Stopped monitoring: ${watchId}`);
            await loadActiveWatchers();
        } catch (err) {
            setLocalError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Google Drive handlers
    const handleAddGoogleDrive = async () => {
        if (!gdriveFolderId.trim()) {
            setGdriveError('Please enter a Google Drive folder ID');
            return;
        }

        setLoading(true);
        setGdriveError('');
        setGdriveSuccess('');

        try {
            await addGoogleDriveFolder(gdriveFolderId, {
                folderName: gdriveFolderName || undefined
            });
            setGdriveSuccess(`Added Google Drive folder: ${gdriveFolderName || gdriveFolderId}`);
            setGdriveFolderId('');
            setGdriveFolderName('');
            await loadGoogleDriveStatus();
        } catch (err) {
            setGdriveError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveGoogleDrive = async (folderId) => {
        setLoading(true);
        setGdriveError('');

        try {
            await removeGoogleDriveFolder(folderId);
            setGdriveSuccess(`Removed Google Drive folder: ${folderId}`);
            await loadGoogleDriveStatus();
        } catch (err) {
            setGdriveError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Worker handlers
    const handleStartWorker = async () => {
        setLoading(true);
        setWorkerError('');

        try {
            await startAutomationWorker();
            setWorkerRunning(true);
        } catch (err) {
            setWorkerError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStopWorker = async () => {
        setLoading(true);
        setWorkerError('');

        try {
            await stopAutomationWorker();
            setWorkerRunning(false);
        } catch (err) {
            setWorkerError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (backendStatus === null) {
        return (
            <div className="automation-config">
                <div className="ac-loading">Checking backend status...</div>
            </div>
        );
    }

    if (backendStatus === 'error') {
        return (
            <div className="automation-config">
                <div className="ac-error-banner">
                    <span className="material-symbols-outlined">error</span>
                    <div>
                        <strong>Backend Offline</strong>
                        <p>Start the backend server to configure automation</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="automation-config">
            {/* Status Bar */}
            <div className="ac-status-bar">
                <div className="ac-status-dot ac-status-dot--ok" />
                <span>
                    Backend online · {geminiStatus ? 'Gemini AI connected' : 'Gemini not configured'}
                </span>
            </div>

            {/* Worker Control */}
            <div className="ac-section">
                <h3 className="ac-section-title">⚙️ Automation Worker</h3>
                <p className="ac-section-desc">
                    The automation worker processes documents detected by folder monitors
                </p>

                <div className="ac-worker-status">
                    <div className="ac-worker-info">
                        <div className={`ac-worker-indicator ${workerRunning ? 'active' : ''}`} />
                        <span>{workerRunning ? 'Worker Running' : 'Worker Stopped'}</span>
                    </div>
                    <button
                        className={`ac-btn ${workerRunning ? 'ac-btn--danger' : 'ac-btn--primary'}`}
                        onClick={workerRunning ? handleStopWorker : handleStartWorker}
                        disabled={loading}
                    >
                        {workerRunning ? 'Stop Worker' : 'Start Worker'}
                    </button>
                </div>

                {workerError && (
                    <div className="ac-error">{workerError}</div>
                )}
            </div>

            {/* Local Folder Monitoring */}
            <div className="ac-section">
                <h3 className="ac-section-title">📁 Local Folder Monitoring</h3>
                <p className="ac-section-desc">
                    Monitor local folders for new SOP documents
                </p>

                <div className="ac-form">
                    <div className="ac-field">
                        <label htmlFor="local-folder-path">Folder Path</label>
                        <input
                            id="local-folder-path"
                            type="text"
                            placeholder="e.g., C:\SOPs\Incoming or /home/user/sops"
                            value={localFolderPath}
                            onChange={(e) => setLocalFolderPath(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="ac-checkbox">
                        <input
                            type="checkbox"
                            id="recursive"
                            checked={recursive}
                            onChange={(e) => setRecursive(e.target.checked)}
                            disabled={loading}
                        />
                        <label htmlFor="recursive">Monitor subdirectories recursively</label>
                    </div>

                    <button
                        className="ac-btn ac-btn--primary"
                        onClick={handleAddLocalFolder}
                        disabled={loading || !localFolderPath.trim()}
                    >
                        {loading ? 'Adding...' : 'Add Folder'}
                    </button>
                </div>

                {localError && (
                    <div className="ac-error">{localError}</div>
                )}
                {localSuccess && (
                    <div className="ac-success">{localSuccess}</div>
                )}

                {/* Active Watchers */}
                {activeWatchers.length > 0 && (
                    <div className="ac-watchers">
                        <h4>Active Monitors</h4>
                        {activeWatchers.map((watcher) => (
                            <div key={watcher.watch_id} className="ac-watcher-item">
                                <div className="ac-watcher-info">
                                    <span className="material-symbols-outlined">folder</span>
                                    <div>
                                        <div className="ac-watcher-path">{watcher.watch_id}</div>
                                        <div className="ac-watcher-status">
                                            {watcher.is_alive ? (
                                                <span className="ac-status-badge ac-status-badge--active">Active</span>
                                            ) : (
                                                <span className="ac-status-badge ac-status-badge--inactive">Inactive</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    className="ac-btn ac-btn--danger-sm"
                                    onClick={() => handleStopWatcher(watcher.watch_id)}
                                    disabled={loading}
                                >
                                    Stop
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Google Drive Monitoring */}
            <div className="ac-section">
                <h3 className="ac-section-title">☁️ Google Drive Monitoring</h3>
                <p className="ac-section-desc">
                    Monitor shared Google Drive folders for new SOP documents
                </p>

                {gdriveStatus && !gdriveStatus.configured && (
                    <div className="ac-info-banner">
                        <span className="material-symbols-outlined">info</span>
                        <div>
                            <strong>Google Drive Not Configured</strong>
                            <p>Set GOOGLE_DRIVE_CREDENTIALS environment variable to enable</p>
                        </div>
                    </div>
                )}

                {gdriveStatus && gdriveStatus.configured && (
                    <>
                        <div className="ac-form">
                            <div className="ac-field">
                                <label htmlFor="gdrive-folder-id">Folder ID</label>
                                <input
                                    id="gdrive-folder-id"
                                    type="text"
                                    placeholder="Google Drive folder ID"
                                    value={gdriveFolderId}
                                    onChange={(e) => setGdriveFolderId(e.target.value)}
                                    disabled={loading}
                                />
                                <small>Find the folder ID in the Google Drive URL</small>
                            </div>

                            <div className="ac-field">
                                <label htmlFor="gdrive-folder-name">Folder Name (optional)</label>
                                <input
                                    id="gdrive-folder-name"
                                    type="text"
                                    placeholder="Display name for this folder"
                                    value={gdriveFolderName}
                                    onChange={(e) => setGdriveFolderName(e.target.value)}
                                    disabled={loading}
                                />
                            </div>

                            <button
                                className="ac-btn ac-btn--primary"
                                onClick={handleAddGoogleDrive}
                                disabled={loading || !gdriveFolderId.trim()}
                            >
                                {loading ? 'Adding...' : 'Add Google Drive Folder'}
                            </button>
                        </div>

                        {gdriveError && (
                            <div className="ac-error">{gdriveError}</div>
                        )}
                        {gdriveSuccess && (
                            <div className="ac-success">{gdriveSuccess}</div>
                        )}

                        {/* Monitored Google Drive Folders */}
                        {gdriveStatus.monitored_folders && gdriveStatus.monitored_folders.length > 0 && (
                            <div className="ac-watchers">
                                <h4>Monitored Folders</h4>
                                {gdriveStatus.monitored_folders.map((folder) => (
                                    <div key={folder.folder_id} className="ac-watcher-item">
                                        <div className="ac-watcher-info">
                                            <span className="material-symbols-outlined">cloud</span>
                                            <div>
                                                <div className="ac-watcher-path">
                                                    {folder.folder_name || folder.folder_id}
                                                </div>
                                                <div className="ac-watcher-meta">
                                                    ID: {folder.folder_id}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            className="ac-btn ac-btn--danger-sm"
                                            onClick={() => handleRemoveGoogleDrive(folder.folder_id)}
                                            disabled={loading}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Help Section */}
            <div className="ac-section ac-section--help">
                <h3 className="ac-section-title">💡 How It Works</h3>
                <ul className="ac-help-list">
                    <li>Start the automation worker to enable background processing</li>
                    <li>Add local folders or Google Drive folders to monitor</li>
                    <li>When new .txt or .pdf files are detected, they're automatically processed</li>
                    <li>Generated training materials are saved to the output folder</li>
                    <li>View processed documents in the My Projects page</li>
                </ul>
            </div>
        </div>
    );
};

export default AutomationConfig;
