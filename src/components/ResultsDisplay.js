import React, { useState } from 'react';
import OutputFormatter from '../services/OutputFormatter';

const TABS = ['SOP Summary', 'Training Material', 'Evaluation', 'Presentation'];

// Normalise the API response (snake_case) into the GeneratedContent shape
// that OutputFormatter expects (camelCase).
function normaliseContent(generatedContent) {
    if (!generatedContent) return null;
    const gc = generatedContent;
    return {
        summary: gc.summary
            ? {
                title: gc.summary.title || gc.summary.overview?.split('\n')[0] || 'SOP Summary',
                overview: gc.summary.overview,
                keyPoints: gc.summary.key_points || gc.summary.keyPoints || [],
                safetyRequirements: gc.summary.safety_requirements || gc.summary.safetyRequirements || [],
            }
            : null,
        trainingMaterial: gc.training_material || gc.trainingMaterial
            ? {
                title: (gc.training_material || gc.trainingMaterial)?.title,
                learningObjectives:
                    (gc.training_material || gc.trainingMaterial)?.learning_objectives ||
                    (gc.training_material || gc.trainingMaterial)?.learningObjectives || [],
                steps: (gc.training_material || gc.trainingMaterial)?.steps || [],
                estimatedDuration:
                    (gc.training_material || gc.trainingMaterial)?.estimated_duration ||
                    (gc.training_material || gc.trainingMaterial)?.estimatedDuration,
            }
            : null,
        evaluation: gc.evaluation
            ? {
                questions: gc.evaluation.questions || [],
                passingScore: gc.evaluation.passing_score || gc.evaluation.passingScore,
                instructions: gc.evaluation.instructions,
            }
            : null,
        sourceDocument: gc.sourceDocument || null,
        generatedAt: gc.generatedAt || gc.generated_at || new Date(),
    };
}

// ─── Quiz Tab ────────────────────────────────────────────────────────────────

function QuizzesTab({ evaluation, parsedDocument }) {
    const [selected, setSelected] = useState({});
    const [submitted, setSubmitted] = useState(false);

    if (!evaluation?.questions?.length) {
        return <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No quiz questions generated.</p>;
    }

    const { questions, passingScore, instructions } = evaluation;
    const passing = passingScore || 75;

    const handleSelect = (qId, optIdx) => {
        if (submitted) return;
        setSelected(prev => ({ ...prev, [qId]: optIdx }));
    };

    const score = submitted
        ? questions.reduce((acc, q) => {
            const sel = selected[q.id];
            if (sel == null) return acc;
            const correct = q.correct_answer;
            const isCorrect =
                typeof correct === 'number' ? sel === correct :
                    typeof correct === 'string' ? q.options?.[sel] === correct : false;
            return acc + (isCorrect ? (q.points || 1) : 0);
        }, 0)
        : null;

    const totalPoints = questions.reduce((a, q) => a + (q.points || 1), 0);
    const pct = submitted ? Math.round((score / totalPoints) * 100) : null;
    const passed = pct != null && pct >= passing;

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Training Assessment</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {instructions || `Based on ${parsedDocument?.filename || 'uploaded document'}`}
                </p>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>📋 {questions.length} question{questions.length !== 1 ? 's' : ''}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>🎯 Passing: {passing}%</span>
                </div>
            </div>

            {submitted && (
                <div style={{
                    padding: '14px 18px', borderRadius: 10, marginBottom: 20,
                    background: passed ? '#dcfce7' : '#fef2f2',
                    border: `1px solid ${passed ? '#86efac' : '#fecaca'}`,
                    display: 'flex', alignItems: 'center', gap: 12,
                }}>
                    <span style={{ fontSize: 22 }}>{passed ? '🎉' : '📚'}</span>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: passed ? '#15803d' : '#b91c1c' }}>
                            {passed ? 'Assessment Passed!' : 'Keep Studying'}
                        </div>
                        <div style={{ fontSize: 13, color: passed ? '#166534' : '#991b1b' }}>
                            Score: {score}/{totalPoints} ({pct}%) — Passing: {passing}%
                        </div>
                    </div>
                </div>
            )}

            {questions.map((q, i) => {
                const selIdx = selected[q.id];
                const correct = q.correct_answer;
                const correctIdx =
                    typeof correct === 'number' ? correct :
                        typeof correct === 'string' ? q.options?.indexOf(correct) : -1;

                return (
                    <div key={q.id || i} style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--primary)', textTransform: 'uppercase' }}>
                                Question {String(i + 1).padStart(2, '0')}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                                {q.points || 1} pt{(q.points || 1) !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12, lineHeight: 1.5 }}>
                            {q.question}
                        </p>
                        {q.options?.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {q.options.map((opt, j) => {
                                    const isSelected = selIdx === j;
                                    const isCorrectOpt = submitted && j === correctIdx;
                                    const isWrongSel = submitted && isSelected && j !== correctIdx;
                                    let bg = 'var(--surface)', border = 'var(--border)';
                                    if (isCorrectOpt) { bg = '#dcfce7'; border = '#86efac'; }
                                    else if (isWrongSel) { bg = '#fef2f2'; border = '#fecaca'; }
                                    else if (isSelected && !submitted) { bg = 'var(--primary-light)'; border = 'var(--primary)'; }
                                    return (
                                        <div
                                            key={j}
                                            onClick={() => handleSelect(q.id || i, j)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 10,
                                                padding: '10px 14px', border: `1px solid ${border}`,
                                                borderRadius: 8, background: bg,
                                                cursor: submitted ? 'default' : 'pointer',
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            <div style={{
                                                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                                                border: `2px solid ${isSelected || isCorrectOpt ? 'var(--primary)' : 'var(--border)'}`,
                                                background: isSelected ? 'var(--primary)' : 'transparent',
                                            }} />
                                            <span style={{ fontSize: 13.5, color: 'var(--text)' }}>{opt}</span>
                                            {isCorrectOpt && <span style={{ marginLeft: 'auto', fontSize: 13 }}>✅</span>}
                                            {isWrongSel && <span style={{ marginLeft: 'auto', fontSize: 13 }}>❌</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {q.explanation && submitted && (
                            <div style={{ marginTop: 10, padding: '10px 12px', background: '#eff6ff', borderRadius: 8, fontSize: 13, color: '#1e40af' }}>
                                💡 {q.explanation}
                            </div>
                        )}
                    </div>
                );
            })}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                {!submitted ? (
                    <button className="btn-primary" onClick={() => setSubmitted(true)}>Submit Assessment</button>
                ) : (
                    <button className="btn-secondary" onClick={() => { setSelected({}); setSubmitted(false); }}>Retake Quiz</button>
                )}
            </div>
        </div>
    );
}

// ─── Presentation Tab ────────────────────────────────────────────────────────

function PresentationTab({ normalisedContent }) {
    const [previewHtml, setPreviewHtml] = useState(null);
    const [downloading, setDownloading] = useState(null);
    const [error, setError] = useState(null);

    const formatter = new OutputFormatter();

    const triggerDownload = (blob, fileName) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDownloadHTML = () => {
        setError(null);
        try {
            const { html, title } = formatter.formatForWeb(normalisedContent);
            const blob = new Blob([html], { type: 'text/html' });
            const fileName = `${(title || 'sop').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
            triggerDownload(blob, fileName);
        } catch (e) {
            setError('Failed to generate HTML: ' + e.message);
        }
    };

    const handleDownloadPDF = async () => {
        setError(null);
        setDownloading('pdf');
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/generate-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: normalisedContent })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const title = normalisedContent.summary?.title || 'document';
            const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
            triggerDownload(blob, fileName);
        } catch (e) {
            setError('Failed to generate PDF: ' + e.message);
        } finally {
            setDownloading(null);
        }
    };

    const handleDownloadPPTX = async () => {
        setError(null);
        setDownloading('pptx');
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/generate-presentation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: normalisedContent })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const title = normalisedContent.summary?.title || 'presentation';
            const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pptx`;
            triggerDownload(blob, fileName);
        } catch (e) {
            setError('Failed to generate PowerPoint presentation: ' + e.message);
        } finally {
            setDownloading(null);
        }
    };

    const handlePreview = () => {
        setError(null);
        try {
            const { html } = formatter.formatForWeb(normalisedContent);
            setPreviewHtml(html);
        } catch (e) {
            setError('Failed to generate preview: ' + e.message);
        }
    };

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Presentation & Export</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Download the generated content in your preferred format or preview it inline.
                </p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                <button className="btn-secondary" onClick={handleDownloadHTML}>
                    ⬇ Download HTML
                </button>
                <button className="btn-secondary" onClick={handleDownloadPDF} disabled={downloading === 'pdf'}>
                    {downloading === 'pdf' ? '⏳ Preparing…' : '⬇ Download PDF'}
                </button>
                <button className="btn-secondary" onClick={handleDownloadPPTX} disabled={downloading === 'pptx'}>
                    {downloading === 'pptx' ? '⏳ Building…' : '⬇ Download PPTX'}
                </button>
                <button className="btn-primary" onClick={handlePreview}>
                    👁 Preview
                </button>
            </div>

            {error && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#b91c1c', marginBottom: 16 }}>
                    ⚠️ {error}
                </div>
            )}

            {previewHtml && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                            Document Preview
                        </span>
                        <button
                            className="btn-secondary"
                            style={{ fontSize: 12, padding: '4px 10px' }}
                            onClick={() => setPreviewHtml(null)}
                        >
                            ✕ Close
                        </button>
                    </div>
                    <iframe
                        title="Document Preview"
                        srcDoc={previewHtml}
                        style={{
                            width: '100%',
                            height: 520,
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            background: '#fff',
                        }}
                        sandbox="allow-same-origin"
                    />
                </div>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const ResultsDisplay = ({ result }) => {
    const [activeTab, setActiveTab] = useState('SOP Summary');

    if (!result) return null;

    const { parsed_document: parsedDocument, generated_content: generatedContent } = result;
    const normalisedContent = normaliseContent(generatedContent);
    const summary = normalisedContent?.summary;
    const training = normalisedContent?.trainingMaterial;
    const evaluation = normalisedContent?.evaluation;

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 10 }}>
                <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
                    {TABS.map(tab => (
                        <button
                            key={tab}
                            className={`tab ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            <div className="results-content">
                {/* ── SOP Summary ── */}
                {activeTab === 'SOP Summary' && (
                    <div>
                        {parsedDocument && (
                            <div style={{ display: 'flex', gap: 24, marginBottom: 18, flexWrap: 'wrap', paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                                {[
                                    ['Document', parsedDocument.filename],
                                    ['Words', parsedDocument.metadata?.word_count],
                                    ['Sections', parsedDocument.structure?.sections?.length],
                                    ['Type', parsedDocument.structure?.document_type?.replace(/_/g, ' ')],
                                ].filter(([, v]) => v != null).map(([k, v]) => (
                                    <div key={k}>
                                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: 2 }}>{k}</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{v}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {summary ? (
                            <div>
                                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)', marginBottom: 16 }}>{summary.overview}</p>
                                {summary.keyPoints?.length > 0 && (
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>Key Points</div>
                                        <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {summary.keyPoints.map((p, i) => (
                                                <li key={i} style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}>{p}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {summary.safetyRequirements?.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>Safety Requirements</div>
                                        <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {summary.safetyRequirements.map((r, i) => (
                                                <li key={i} style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}>{r}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No summary generated.</p>
                        )}
                    </div>
                )}

                {/* ── Training Material ── */}
                {activeTab === 'Training Material' && (
                    <div>
                        {training ? (
                            <div>
                                <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>{training.title}</h2>
                                {training.learningObjectives?.length > 0 && (
                                    <div style={{ marginBottom: 20 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>Learning Objectives</div>
                                        <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
                                            {training.learningObjectives.map((o, i) => (
                                                <li key={i} style={{ fontSize: 13.5, color: 'var(--text)' }}>{o}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {training.steps?.map((step, i) => {
                                    const stepText = typeof step === 'string' ? step : step.description || step.title || '';
                                    const stepTitle = typeof step === 'string' ? null : step.title;
                                    const stepNum = typeof step === 'object' ? (step.step_number || i + 1) : i + 1;
                                    const keyPoints = typeof step === 'object' ? (step.key_points || step.keyPoints || []) : [];
                                    return (
                                        <div key={i} style={{ borderLeft: '3px solid var(--primary)', paddingLeft: 14, marginBottom: 18 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>
                                                Step {stepNum}{stepTitle ? `: ${stepTitle}` : ''}
                                            </div>
                                            <p style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.6 }}>{stepText}</p>
                                            {keyPoints.length > 0 && (
                                                <ul style={{ paddingLeft: 16, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    {keyPoints.map((kp, j) => (
                                                        <li key={j} style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{kp}</li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    );
                                })}
                                {training.estimatedDuration && (
                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                                        ⏱ Estimated duration: {training.estimatedDuration} minutes
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No training material generated.</p>
                        )}
                    </div>
                )}

                {/* ── Evaluation ── */}
                {activeTab === 'Evaluation' && (
                    <QuizzesTab evaluation={evaluation} parsedDocument={parsedDocument} />
                )}

                {/* ── Presentation ── */}
                {activeTab === 'Presentation' && normalisedContent && (
                    <PresentationTab normalisedContent={normalisedContent} />
                )}
                {activeTab === 'Presentation' && !normalisedContent && (
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No content available to export.</p>
                )}
            </div>
        </div>
    );
};

export default ResultsDisplay;
