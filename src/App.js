import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, NavLink } from 'react-router-dom';
import { FileUpload, ProcessingStatus, ResultsDisplay, DemoInterface, AutomationConfig } from './components';
import { processDocument } from './services/apiService';


// ─── Backend health indicator ───────────────────────────────────
const useBackendHealth = () => {
    const [status, setStatus] = useState('pending'); // pending | online | offline

    useEffect(() => {
        const check = async () => {
            try {
                const res = await fetch('http://localhost:8000/api/health');
                if (res.ok) setStatus('online');
                else setStatus('offline');
            } catch {
                setStatus('offline');
            }
        };
        check();
        const interval = setInterval(check, 30000);
        return () => clearInterval(interval);
    }, []);

    return status;
};

// ─── NAV ────────────────────────────────────────────────────────
const Nav = ({ backendStatus }) => {
    const statusLabel = backendStatus === 'online' ? 'API Online' :
                        backendStatus === 'offline' ? 'API Offline' : 'Checking…';
    return (
        <nav className="navbar">
            <div className="nav-brand">
                <Link to="/">
                    <div className="nav-brand-icon">⚡</div>
                    <span className="nav-brand-text">SOP Processor</span>
                </Link>
            </div>

            <div className="nav-links">
                <NavLink to="/"         end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🏠 Home</NavLink>
                <NavLink to="/processor"    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>📄 Processor</NavLink>
                <NavLink to="/demo"         className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>🤖 Demo</NavLink>
                <NavLink to="/automation"   className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>⚙️ Automation</NavLink>
            </div>

            <div className="nav-status">
                <div className={`status-dot status-dot--${backendStatus}`} />
                {statusLabel}
            </div>
        </nav>
    );
};

// ─── HOME PAGE ──────────────────────────────────────────────────
const HomePage = () => (
    <div className="page">
        <div className="home-hero">
            <div className="home-hero-eyebrow">✨ AI-Powered Training Generation</div>
            <h1>
                Transform SOPs into{' '}
                <span className="gradient-text">Training Materials</span>
            </h1>
            <p>
                Upload a Standard Operating Procedure document and let Gemini AI
                automatically generate summaries, step-by-step guides, and evaluation
                questions — in seconds.
            </p>
            <div className="hero-actions">
                <Link to="/processor" className="btn btn--primary">
                    🚀 Start Processing
                </Link>
                <Link to="/demo" className="btn btn--ghost">
                    View Demo →
                </Link>
            </div>
        </div>

        <div className="features">
            <Link to="/processor" className="feature-card">
                <div className="feature-icon">📄</div>
                <h3>Upload &amp; Parse</h3>
                <p>Drag &amp; drop TXT or PDF SOP files for instant AI-powered extraction and structuring.</p>
            </Link>
            <Link to="/processor" className="feature-card">
                <div className="feature-icon">🧠</div>
                <h3>AI Summarisation</h3>
                <p>Gemini Flash generates a concise overview, key points, and safety requirements automatically.</p>
            </Link>
            <Link to="/processor" className="feature-card">
                <div className="feature-icon">📚</div>
                <h3>Training Guide</h3>
                <p>Structured step-by-step training material with learning objectives and time estimates.</p>
            </Link>
            <Link to="/processor" className="feature-card">
                <div className="feature-icon">❓</div>
                <h3>Evaluation Quiz</h3>
                <p>3–5 auto-generated evaluation questions covering critical safety and compliance points.</p>
            </Link>
            <Link to="/demo" className="feature-card">
                <div className="feature-icon">🎯</div>
                <h3>Live Demo</h3>
                <p>Try the system with built-in sample SOPs — no file upload required.</p>
            </Link>
            <Link to="/automation" className="feature-card">
                <div className="feature-icon">⚙️</div>
                <h3>Automation</h3>
                <p>Watch a local or Google Drive folder and auto-process new SOPs as they arrive.</p>
            </Link>
        </div>

        <div className="tech-strip">
            <span className="tech-strip-label">Powered by</span>
            <div className="tech-tags">
                <span className="tech-tag">FastAPI</span>
                <span className="tech-tag">gemini-2.0-flash</span>
                <span className="tech-tag">React 18</span>
                <span className="tech-tag">PyPDF2</span>
                <span className="tech-tag">asyncio</span>
            </div>
        </div>
    </div>
);

// ─── PROCESSOR PAGE ─────────────────────────────────────────────
const ProcessorPage = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [parsedDocument, setParsedDocument] = useState(null);
    const [generatedContent, setGeneratedContent] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStep, setProcessingStep] = useState('');
    const [error, setError] = useState('');

    const handleFileSelect = async (file) => {
        setSelectedFile(file);
        setError('');
        setIsProcessing(true);
        setParsedDocument(null);
        setGeneratedContent(null);
        setProcessingStep('Uploading & parsing document…');

        try {
            setProcessingStep('Sending to backend for AI processing…');
            const result = await processDocument(file);
            if (!result.success) throw new Error(result.error || 'Processing failed');
            setParsedDocument(result.parsed_document);
            setProcessingStep('AI generating training materials…');
            setGeneratedContent(result.generated_content);
            setProcessingStep('Complete!');
        } catch (err) {
            let msg = err.message || 'Processing failed';
            if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
                msg = 'Cannot reach backend. Start it with: cd backend && uvicorn main:app --reload';
            }
            setError(msg);
            setParsedDocument(null);
            setGeneratedContent(null);
        } finally {
            setIsProcessing(false);
            setProcessingStep('');
        }
    };

    const handleError   = (msg) => { setError(msg); setSelectedFile(null); setParsedDocument(null); setGeneratedContent(null); };
    const handleClear   = () => { setError(''); setSelectedFile(null); setParsedDocument(null); setGeneratedContent(null); };

    return (
        <div className="page">
            <div className="page-header">
                <h1>📄 Document <span className="gradient-text">Processor</span></h1>
                <p>Upload your SOP document — the FastAPI backend will parse it and use Gemini AI to generate training materials.</p>
            </div>

            <div className="processor-layout">
                <FileUpload
                    onFileSelect={handleFileSelect}
                    onError={handleError}
                    onClear={handleClear}
                />

                {isProcessing && (
                    <ProcessingStatus
                        isProcessing={isProcessing}
                        processingStep={processingStep}
                        parsedDocument={parsedDocument}
                        generatedContent={generatedContent}
                    />
                )}

                {error && (
                    <div className="error-display">
                        <h3>⚠️ Error</h3>
                        <p>{error}</p>
                        {error.includes('backend') && (
                            <div className="error-hint">
                                cd backend<br />
                                pip install -r requirements.txt<br />
                                uvicorn main:app --reload --port 8000
                            </div>
                        )}
                    </div>
                )}

                <ResultsDisplay
                    generatedContent={generatedContent}
                    parsedDocument={parsedDocument}
                />
            </div>
        </div>
    );
};

// ─── DEMO PAGE ──────────────────────────────────────────────────
const DemoPage = () => (
    <div className="page">
        <div className="page-header">
            <h1>🤖 Demo <span className="gradient-text">Interface</span></h1>
            <p>Try the SOP Processor with built-in sample documents — no file upload needed.</p>
        </div>
        <DemoInterface />
    </div>
);

// ─── AUTOMATION PAGE ─────────────────────────────────────────────
const AutomationPage = () => (
    <div className="page">
        <div className="page-header">
            <h1>⚙️ Automation <span className="gradient-text">Settings</span></h1>
            <p>Configure automated SOP processing workflows and folder monitoring.</p>
        </div>
        <AutomationConfig />
    </div>
);

// ─── APP ─────────────────────────────────────────────────────────
function App() {
    const backendStatus = useBackendHealth();

    return (
        <Router>
            <div className="App">
                <Nav backendStatus={backendStatus} />

                <main className="main-content">
                    <Routes>
                        <Route path="/"           element={<HomePage />} />
                        <Route path="/processor"  element={<ProcessorPage />} />
                        <Route path="/demo"       element={<DemoPage />} />
                        <Route path="/automation" element={<AutomationPage />} />
                    </Routes>
                </main>

                <footer className="footer">
                    <span>© 2025 SOP Processor</span>
                    <span className="footer-dot">·</span>
                    <span>FastAPI + Gemini AI + React</span>
                    <span className="footer-dot">·</span>
                    <span>Built with ❤️</span>
                </footer>
            </div>
        </Router>
    );
}

export default App;
