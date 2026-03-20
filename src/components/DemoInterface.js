import React, { useState } from 'react';
import { processDocument } from '../services/apiService';

const SAMPLE_SOPS = [
    {
        id: 'editorial-pipeline',
        title: 'Internal Editorial Pipeline v2.4',
        description: 'Training guide for content architecture & standardisation',
        content: `1. Content Structure Principles
Every editorial piece must follow the primary structural hierarchy defined in the 2024 Brand Guidelines.
- Headlines must be concise and benefit-driven.
- Body copy requires active voice exclusively.

2. Automation Triggers
Define transition states for documentation steps. Each step must have a clear owner and a quantifiable success metric.
{ "trigger": "on_completion", "action": "notify_lms", "payload": "scorm_v2" }

3. Quality Assurance
Manual review is mandated for any training guide with a complexity score exceeding 0.85.`,
    },
    {
        id: 'onboarding',
        title: 'Employee Onboarding SOP',
        description: 'Standard operating procedure for new hire onboarding',
        content: `1. Pre-Arrival
Prepare workstation, accounts, and access credentials before the employee's first day.
- Set up email accounts, Slack, and relevant tools.
- Prepare IT equipment checklist.

2. Day One Orientation
Walk through company culture, values, and team structure.
- Complete HR paperwork.
- Technical equipment setup (30 min).

3. 30-Day Review
Schedule a formal check-in at 30 days to assess onboarding progress.`,
    },
    {
        id: 'safety-protocol',
        title: 'Lab Safety Protocol',
        description: 'Standard safety procedures for laboratory environments',
        content: `1. Personal Protective Equipment (PPE)
All personnel must wear appropriate PPE at all times in the lab.
- Lab coat, safety glasses, and gloves are mandatory.
- Closed-toe shoes required.

2. Chemical Handling
Follow MSDS guidelines for all chemicals.
- Verify chemical compatibility before mixing.
- Label all containers clearly.

3. Emergency Procedures
Know the location of fire extinguisher, eye wash station, and first aid kit.`,
    },
];

const DemoInterface = () => {
    const [selectedSop, setSelectedSop] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [processingStep, setProcessingStep] = useState('');

    const handleRunDemo = async (sop) => {
        setSelectedSop(sop);
        setIsProcessing(true);
        setResult(null);
        setError('');
        setProcessingStep('Parsing document…');

        try {
            // Create a text blob to simulate a file
            const blob = new Blob([sop.content], { type: 'text/plain' });
            const file = new File([blob], `${sop.id}.txt`, { type: 'text/plain' });

            setProcessingStep('Sending to AI for processing…');
            const res = await processDocument(file);
            if (!res.success) throw new Error(res.error || 'Demo processing failed');
            setResult(res);
            setProcessingStep('Complete!');
        } catch (err) {
            let msg = err.message || 'Demo failed';
            if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
                msg = 'Cannot reach backend. Start it with: cd backend && uvicorn main:app --reload';
            }
            setError(msg);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReset = () => {
        setSelectedSop(null);
        setResult(null);
        setError('');
        setProcessingStep('');
    };

    return (
        <div className="demo-interface">
            {!selectedSop ? (
                <div className="demo-sop-grid">
                    <p className="demo-subtitle">Select a sample SOP to process — no file upload required.</p>
                    {SAMPLE_SOPS.map(sop => (
                        <div key={sop.id} className="demo-card" onClick={() => handleRunDemo(sop)}>
                            <div className="demo-card-icon">
                                <span className="material-symbols-outlined">description</span>
                            </div>
                            <div className="demo-card-info">
                                <h3>{sop.title}</h3>
                                <p>{sop.description}</p>
                            </div>
                            <button className="btn btn--primary btn--sm">
                                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>play_arrow</span>
                                Run Demo
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div>
                    <div className="demo-active-header">
                        <div>
                            <h3>{selectedSop.title}</h3>
                            <p className="demo-active-sub">{selectedSop.description}</p>
                        </div>
                        <button className="btn btn--ghost btn--sm" onClick={handleReset}>
                            ← Back to Demos
                        </button>
                    </div>

                    {isProcessing && (
                        <div className="demo-loading">
                            <div className="ps-spinner" />
                            <span>{processingStep}</span>
                        </div>
                    )}

                    {error && (
                        <div className="error-display">
                            <h3>Error</h3>
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

                    {result && (
                        <div className="demo-results">
                            {result.generated_content?.summary && (
                                <div className="card" style={{ marginBottom: '1rem' }}>
                                    <h4 className="section-title">SOP Summary</h4>
                                    <div className="results-prose">{result.generated_content.summary}</div>
                                </div>
                            )}
                            {result.generated_content?.training_guide && (
                                <div className="card" style={{ marginBottom: '1rem' }}>
                                    <h4 className="section-title">Training Guide</h4>
                                    <div className="results-prose">{result.generated_content.training_guide}</div>
                                </div>
                            )}
                            {result.generated_content?.quiz_questions?.length > 0 && (
                                <div className="card">
                                    <h4 className="section-title">Training Assessment</h4>
                                    <div className="quiz-list">
                                        {result.generated_content.quiz_questions.map((q, i) => (
                                            <div key={i} className="quiz-item">
                                                <span className="quiz-num">{i + 1}</span>
                                                <p>{q.question || q}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Preview of sample SOP */}
                    {!isProcessing && !result && !error && (
                        <div className="card">
                            <h4 className="section-title">Document Preview</h4>
                            <pre className="code-block">{selectedSop.content}</pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DemoInterface;
