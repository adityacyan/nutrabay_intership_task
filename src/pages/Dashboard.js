import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { processDocumentStreaming } from '../services/apiService';
import ResultsDisplay from '../components/ResultsDisplay';
import ProcessingStatus from '../components/ProcessingStatus';

const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatTime = (date) => {
    const diff = Math.floor((Date.now() - date) / 1000);
    if (diff < 60) return `${diff} secs ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    return `${Math.floor(diff / 3600)} hrs ago`;
};


function FileMetaPanel({ file }) {
    if (!file) return null;
    const ext = file.name.split('.').pop().toUpperCase();
    const typeMap = { PDF: 'Portable Document Format', TXT: 'Plain Text', DOCX: 'Word Document' };

    return (
        <div>
            <div className="panel-section-title">File Metadata</div>
            <div className="meta-row">
                <div className="meta-key">Name</div>
                <div className="meta-value" style={{ wordBreak: 'break-all', fontSize: 13 }}>{file.name}</div>
            </div>
            <div className="meta-row">
                <div className="meta-key">Size</div>
                <div className="meta-value">{formatSize(file.size)}</div>
            </div>
            <div className="meta-row">
                <div className="meta-key">Type</div>
                <div className="meta-value">{typeMap[ext] || ext}</div>
            </div>
            <div className="meta-row">
                <div className="meta-key">Encoding</div>
                <div className="meta-value">UTF-8 Standard</div>
            </div>

            <div className="tip-card" style={{ marginTop: 20 }}>
                <div className="tip-header">
                    <span>💡</span> Architect Tip
                </div>
                <div className="tip-text">
                    Larger PDFs take ~30s to fully map architectural hierarchies. Complex nesting is preserved during extraction.
                </div>
            </div>
        </div>
    );
}

export default function Dashboard() {
    const [file, setFile] = useState(null);
    const [uploadTime, setUploadTime] = useState(null);
    const [stage, setStage] = useState(null);
    const [timeRemaining, setTimeRemaining] = useState(null);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [processingError, setProcessingError] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [streamingSummary, setStreamingSummary] = useState(''); // For character-by-character streaming

    const onDrop = useCallback((accepted, rejected) => {
        setError(null);
        setResult(null);
        setStage(null);
        if (rejected?.length > 0) {
            const code = rejected[0].errors?.[0]?.code;
            if (code === 'file-too-large') setError('File exceeds 50MB limit.');
            else if (code === 'file-invalid-type') setError('Only .pdf and .txt files are supported.');
            else setError('Invalid file. Please upload a .pdf or .txt file under 50MB.');
            return;
        }
        if (accepted?.length > 0) {
            setFile(accepted[0]);
            setUploadTime(Date.now());
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'] },
        maxSize: 50 * 1024 * 1024,
        multiple: false,
    });

    const handleProcess = async () => {
        if (!file) return;
        setError(null);
        setProcessingError(null);
        setResult(null);
        setStreamingSummary('');
        setProcessing(true);
        setStage('parsing');
        setTimeRemaining(20);

        const countdown = setInterval(() => {
            setTimeRemaining(t => (t > 1 ? t - 1 : null));
        }, 1000);

        try {
            let parsedDoc = null;
            let summaryData = null;
            let trainingData = null;
            let evaluationData = null;

            await processDocumentStreaming(file, {
                onStatus: (message, step) => {
                    console.log('Status:', message, step);
                    setStage(step);
                },
                onParsed: (data) => {
                    console.log('Parsed:', data);
                    parsedDoc = data;
                },
                onSummaryChunk: (text) => {
                    // Append each character/chunk to streaming summary
                    setStreamingSummary(prev => prev + text);
                },
                onSummaryComplete: (data) => {
                    console.log('Summary complete:', data);
                    summaryData = data;
                    setStreamingSummary(''); // Clear streaming text
                    // Show complete result with summary
                    setResult({
                        parsed_document: parsedDoc,
                        generated_content: {
                            summary: summaryData,
                            training_material: null,
                            evaluation: null,
                        }
                    });
                },
                onTraining: (data) => {
                    console.log('Training received:', data);
                    trainingData = data;
                    // Update result with training material
                    setResult({
                        parsed_document: parsedDoc,
                        generated_content: {
                            summary: summaryData,
                            training_material: trainingData,
                            evaluation: null,
                        }
                    });
                },
                onEvaluation: (data) => {
                    console.log('Evaluation received:', data);
                    evaluationData = data;
                    // Update result with evaluation
                    setResult({
                        parsed_document: parsedDoc,
                        generated_content: {
                            summary: summaryData,
                            training_material: trainingData,
                            evaluation: evaluationData,
                        }
                    });
                },
                onComplete: (projectId) => {
                    console.log('Complete! Project ID:', projectId);
                    clearInterval(countdown);
                    setStage(null);
                    setTimeRemaining(null);
                    setProcessing(false);
                },
                onError: (errorMessage) => {
                    console.error('Error:', errorMessage);
                    clearInterval(countdown);
                    setStage(null);
                    setTimeRemaining(null);
                    setStreamingSummary('');
                    setProcessingError(errorMessage || 'Processing failed. Please try again.');
                    setProcessing(false);
                }
            });

        } catch (err) {
            clearInterval(countdown);
            setStage(null);
            setTimeRemaining(null);
            setStreamingSummary('');
            setProcessingError(err.message || 'Processing failed. Please try again.');
            setProcessing(false);
        }
    };

    const handleRetry = () => {
        setProcessingError(null);
        setResult(null);
        setStage(null);
        handleProcess();
    };

    const handleClear = () => {
        setFile(null);
        setUploadTime(null);
        setStage(null);
        setResult(null);
        setError(null);
        setProcessingError(null);
        setProcessing(false);
    };

    return (
        <div className="page-layout">
            <div className="page-main">
                <h1 className="page-title">Ingestion Pipeline</h1>
                <p className="page-subtitle">
                    Transform your unstructured documents into high-fidelity standard operating procedures using our architectural extraction engine.
                </p>

                {error && (
                    <div className="error-banner">
                        <span>⚠️</span> {error}
                    </div>
                )}

                {/* Drop Zone */}
                {!file && (
                    <div
                        {...getRootProps()}
                        className={`dropzone ${isDragActive ? 'drag-over' : ''}`}
                    >
                        <input {...getInputProps()} />
                        <div className="dropzone-icon">📄</div>
                        <div className="dropzone-title">Drag & drop your training materials</div>
                        <div className="dropzone-subtitle">PDF, DOCX or Markdown up to 50MB</div>
                    </div>
                )}

                {/* File Item */}
                {file && (
                    <div className="file-item">
                        <div className="file-icon">📕</div>
                        <div className="file-info">
                            <div className="file-name">{file.name}</div>
                            <div className="file-meta">
                                {formatSize(file.size)} • Uploaded {uploadTime ? formatTime(uploadTime) : 'just now'}
                            </div>
                        </div>
                        <button className="file-remove" onClick={handleClear} disabled={processing}>✕</button>
                    </div>
                )}

                {/* Pipeline Status - only show while processing or if there's an error */}
                {(processing || processingError) && (
                    <ProcessingStatus
                        isProcessing={processing}
                        processingStep={stage}
                        timeRemaining={timeRemaining}
                        error={processingError}
                        onRetry={handleRetry}
                        generatedContent={result?.generated_content}
                    />
                )}

                {/* Process Button */}
                {file && !processing && !result && (
                    <div style={{ marginTop: 20 }}>
                        <button className="btn-primary" onClick={handleProcess}>
                            <span>⚡</span> Process Document
                        </button>
                    </div>
                )}

                {/* Streaming Summary Display */}
                {streamingSummary && (
                    <div style={{ marginTop: 24 }}>
                        <div className="card">
                            <div style={{
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                color: 'var(--primary)',
                                marginBottom: 12,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                            }}>
                                <div className="ps-spinner" style={{ width: 16, height: 16 }} />
                                Generating Summary...
                            </div>
                            <div style={{
                                fontSize: 14,
                                lineHeight: 1.7,
                                color: 'var(--text)',
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'Inter, sans-serif'
                            }}>
                                {streamingSummary}
                                <span style={{
                                    display: 'inline-block',
                                    width: 8,
                                    height: 16,
                                    backgroundColor: 'var(--primary)',
                                    marginLeft: 2,
                                    animation: 'blink 1s infinite'
                                }}>|</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Results */}
                {result && (
                    <div style={{ marginTop: 24 }}>
                        <ResultsDisplay result={result} />
                    </div>
                )}
            </div>

            {/* Right Panel */}
            <aside className="page-sidebar">
                {file ? (
                    <FileMetaPanel file={file} />
                ) : (
                    <div>
                        <div className="panel-section-title">File Metadata</div>
                        <p style={{ fontSize: 13, color: 'var(--text-light)' }}>
                            Upload a file to see metadata here.
                        </p>
                    </div>
                )}

                <div className="help-card" style={{ marginTop: 'auto' }}>
                    <div className="help-header">
                        <div className="help-avatar">👩‍💼</div>
                        <div>
                            <div className="help-title">Need Help?</div>
                            <div className="help-subtitle">Live with Sarah</div>
                        </div>
                    </div>
                    <button className="btn-chat">Open Chat</button>
                </div>
            </aside>
        </div>
    );
}
