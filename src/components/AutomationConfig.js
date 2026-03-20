import React, { useState, useEffect } from 'react';
import { checkHealth } from '../services/apiService';


const STORAGE_KEY = 'sop_automation_config';

const DEFAULT_CONFIG = {
    enabled: false,
    watchFolder: '',
    outputFolder: '',
    pollingIntervalMinutes: 5,
    autoProcess: true,
    createOutputFolders: true,
    emailNotifications: false,
    emailAddress: '',
};

const AutomationConfig = () => {
    const [config, setConfig] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
        } catch { return DEFAULT_CONFIG; }
    });
    const [saved, setSaved] = useState(false);
    const [backendStatus, setBackendStatus] = useState(null); // null | 'ok' | 'error'
    const [geminiStatus, setGeminiStatus] = useState(false);

    useEffect(() => {
        checkHealth()
            .then(h => { setBackendStatus('ok'); setGeminiStatus(h.gemini_configured); })
            .catch(() => setBackendStatus('error'));
    }, []);

    const update = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));

    const handleSave = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    const handleReset = () => {
        setConfig(DEFAULT_CONFIG);
        localStorage.removeItem(STORAGE_KEY);
    };

    return (
        <div className="automation-config">
            {/* Status bar */}
            <div className="ac-status-bar">
                <div className={`ac-status-dot ac-status-dot--${backendStatus === 'ok' ? 'ok' : backendStatus === 'error' ? 'err' : 'checking'}`} />
                <span>
                    {backendStatus === null && 'Checking backend…'}
                    {backendStatus === 'ok' && `Backend online ${geminiStatus ? '· Gemini AI connected' : '· Gemini not configured'}`}
                    {backendStatus === 'error' && 'Backend offline — start uvicorn to enable automation'}
                </span>
            </div>

            <div className="ac-note">
                <strong>ℹ️ About Automation</strong>
                <p>File watching (chokidar) runs on the server side. The settings you configure here are saved to your browser and sent to the backend when it supports the automation endpoint. For now, configure your preferences and test processing via the Processor page.</p>
            </div>

            {/* Main toggle */}
            <div className="ac-section">
                <div className="ac-row ac-row--main">
                    <div>
                        <h4>Enable Automation</h4>
                        <p>Automatically process new SOP documents added to the watch folder</p>
                    </div>
                    <label className="ac-toggle">
                        <input type="checkbox" checked={config.enabled} onChange={e => update('enabled', e.target.checked)} />
                        <span className="ac-toggle-slider" />
                    </label>
                </div>
            </div>

            {/* Folder settings */}
            <div className={`ac-section ${!config.enabled ? 'ac-section--disabled' : ''}`}>
                <h4 className="ac-section-title">📁 Folder Configuration</h4>
                <div className="ac-field">
                    <label>Watch Folder Path</label>
                    <input
                        type="text"
                        placeholder="e.g. C:\SOPs\Incoming"
                        value={config.watchFolder}
                        onChange={e => update('watchFolder', e.target.value)}
                        disabled={!config.enabled}
                    />
                    <small>New SOP files placed here will be automatically processed</small>
                </div>
                <div className="ac-field">
                    <label>Output Folder Path</label>
                    <input
                        type="text"
                        placeholder="e.g. C:\SOPs\Generated"
                        value={config.outputFolder}
                        onChange={e => update('outputFolder', e.target.value)}
                        disabled={!config.enabled}
                    />
                    <small>Generated training materials will be saved here</small>
                </div>
                <div className="ac-field">
                    <label>Polling Interval (minutes)</label>
                    <select
                        value={config.pollingIntervalMinutes}
                        onChange={e => update('pollingIntervalMinutes', Number(e.target.value))}
                        disabled={!config.enabled}
                    >
                        {[1, 2, 5, 10, 15, 30, 60].map(v => (
                            <option key={v} value={v}>{v} {v === 1 ? 'minute' : 'minutes'}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Processing options */}
            <div className={`ac-section ${!config.enabled ? 'ac-section--disabled' : ''}`}>
                <h4 className="ac-section-title">⚙️ Processing Options</h4>
                <div className="ac-toggle-row">
                    <div>
                        <span>Auto-process on file detection</span>
                        <small>Start processing immediately when a new file appears</small>
                    </div>
                    <label className="ac-toggle">
                        <input type="checkbox" checked={config.autoProcess} onChange={e => update('autoProcess', e.target.checked)} disabled={!config.enabled} />
                        <span className="ac-toggle-slider" />
                    </label>
                </div>
                <div className="ac-toggle-row">
                    <div>
                        <span>Create output sub-folders</span>
                        <small>Create a dedicated folder for each processed SOP</small>
                    </div>
                    <label className="ac-toggle">
                        <input type="checkbox" checked={config.createOutputFolders} onChange={e => update('createOutputFolders', e.target.checked)} disabled={!config.enabled} />
                        <span className="ac-toggle-slider" />
                    </label>
                </div>
            </div>

            {/* Notifications */}
            <div className={`ac-section ${!config.enabled ? 'ac-section--disabled' : ''}`}>
                <h4 className="ac-section-title">🔔 Notifications</h4>
                <div className="ac-toggle-row">
                    <div>
                        <span>Email notifications</span>
                        <small>Send email when processing completes or fails</small>
                    </div>
                    <label className="ac-toggle">
                        <input type="checkbox" checked={config.emailNotifications} onChange={e => update('emailNotifications', e.target.checked)} disabled={!config.enabled} />
                        <span className="ac-toggle-slider" />
                    </label>
                </div>
                {config.emailNotifications && (
                    <div className="ac-field" style={{ marginTop: 12 }}>
                        <label>Notification Email</label>
                        <input
                            type="email"
                            placeholder="you@company.com"
                            value={config.emailAddress}
                            onChange={e => update('emailAddress', e.target.value)}
                            disabled={!config.enabled}
                        />
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="ac-actions">
                <button className="ac-btn ac-btn--primary" onClick={handleSave}>
                    {saved ? '✓ Saved!' : 'Save Configuration'}
                </button>
                <button className="ac-btn ac-btn--secondary" onClick={handleReset}>
                    Reset to Defaults
                </button>
            </div>
        </div>
    );
};

export default AutomationConfig;
