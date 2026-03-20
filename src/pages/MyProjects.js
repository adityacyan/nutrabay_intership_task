import React, { useEffect, useState, useCallback } from 'react';
import { listProjects, getProject, deleteProject, getAutomationNotifications } from '../services/apiService';
import ResultsDisplay from '../components/ResultsDisplay';

const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function MyProjects() {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selected, setSelected] = useState(null);   // full project data
    const [loadingProject, setLoadingProject] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [notification, setNotification] = useState(null);

    const fetchProjects = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await listProjects();
            setProjects(data.projects || []);
        } catch (err) {
            setError('Could not load projects. Make sure the backend is running.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchProjects(); }, [fetchProjects]);

    // Poll for automation notifications
    useEffect(() => {
        let lastNotificationTime = null;

        const pollNotifications = async () => {
            try {
                const data = await getAutomationNotifications();
                const notifications = data.notifications || [];

                // Show the most recent notification if it's new
                if (notifications.length > 0) {
                    const latest = notifications[notifications.length - 1];

                    // Only show if it's a new notification
                    if (!lastNotificationTime || latest.timestamp !== lastNotificationTime) {
                        lastNotificationTime = latest.timestamp;
                        setNotification(latest);

                        // Auto-hide after 5 seconds
                        setTimeout(() => setNotification(null), 5000);

                        // Refresh projects list if it's a success notification
                        if (latest.type === 'success') {
                            fetchProjects();
                        }
                    }
                }
            } catch (err) {
                // Silently fail - notifications are optional
            }
        };

        const interval = setInterval(pollNotifications, 2000);
        return () => clearInterval(interval);
    }, [fetchProjects]);

    const handleOpen = async (projectId) => {
        setLoadingProject(true);
        setSelected(null);
        try {
            const data = await getProject(projectId);
            // Shape it like a ProcessResponse so ResultsDisplay works as-is
            setSelected({
                parsed_document: { filename: data.metadata.document_name, metadata: {}, structure: {} },
                generated_content: {
                    summary: data.summary,
                    training_material: data.training_material,
                    evaluation: data.evaluation,
                    generated_at: data.metadata.processed_at,
                },
            });
        } catch (err) {
            setError('Failed to load project.');
        } finally {
            setLoadingProject(false);
        }
    };

    const handleDelete = async (e, projectId) => {
        e.stopPropagation();
        if (!window.confirm('Delete this project?')) return;
        setDeletingId(projectId);
        try {
            await deleteProject(projectId);
            if (selected?.parsed_document?.filename) setSelected(null);
            await fetchProjects();
        } catch {
            setError('Failed to delete project.');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="page-layout">
            <div className="page-main">
                <h1 className="page-title">My Projects</h1>
                <p className="page-subtitle">View and manage your processed SOP documents.</p>

                {notification && (
                    <div className={`notification-banner ${notification.type === 'success' ? 'notification-success' : 'notification-error'}`}>
                        <span className="material-symbols-outlined">
                            {notification.type === 'success' ? 'check_circle' : 'error'}
                        </span>
                        <span>{notification.message}</span>
                        <button onClick={() => setNotification(null)} className="notification-close">×</button>
                    </div>
                )}

                {error && (
                    <div className="error-banner" style={{ marginBottom: 16 }}>
                        <span>⚠️</span> {error}
                    </div>
                )}

                {selected ? (
                    <div>
                        <button
                            className="btn-secondary"
                            style={{ marginBottom: 16 }}
                            onClick={() => setSelected(null)}
                        >
                            ← Back to Projects
                        </button>
                        <ResultsDisplay result={selected} />
                    </div>
                ) : (
                    <>
                        {loading && (
                            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading projects…</p>
                        )}
                        {loadingProject && (
                            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading project…</p>
                        )}
                        {!loading && projects.length === 0 && (
                            <div className="card" style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                                No projects yet. Upload a document from the Dashboard to get started.
                            </div>
                        )}
                        {!loading && projects.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {projects.map((p) => (
                                    <div
                                        key={p.id}
                                        className="file-item"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => handleOpen(p.id)}
                                    >
                                        <div className="file-icon">
                                            {p.automated ? '⚙️' : '📄'}
                                        </div>
                                        <div className="file-info">
                                            <div className="file-name">
                                                {p.document_name}
                                                {p.automated && (
                                                    <span style={{
                                                        marginLeft: 8,
                                                        fontSize: 11,
                                                        color: 'var(--primary)',
                                                        background: 'var(--primary-bg)',
                                                        padding: '2px 8px',
                                                        borderRadius: 12,
                                                        fontWeight: 600
                                                    }}>
                                                        AUTO
                                                    </span>
                                                )}
                                            </div>
                                            <div className="file-meta">
                                                Processed {formatDate(p.processed_at)} &nbsp;·&nbsp;
                                                {p.content_types?.join(', ')}
                                            </div>
                                        </div>
                                        <button
                                            className="file-remove"
                                            title="Delete project"
                                            disabled={deletingId === p.id}
                                            onClick={(e) => handleDelete(e, p.id)}
                                        >
                                            {deletingId === p.id ? '…' : '🗑'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
