import React from 'react';

const STEPS = [
    { id: 'parsing', label: 'Parsing', icon: 'document_scanner' },
    { id: 'extracting', label: 'Extracting', icon: 'hub' },
    { id: 'formatting', label: 'Formatting', icon: 'auto_fix_high' },
];

const getStepState = (stepId, processingStep, generatedContent) => {
    if (generatedContent) return 'complete'; // all done

    const step = processingStep?.toLowerCase() || '';
    const order = ['parsing', 'extracting', 'formatting'];
    const currentIdx = order.findIndex(s => step.includes(s));
    const thisIdx = order.indexOf(stepId);

    if (currentIdx === -1) {
        // Map common phrases to steps
        if (step.includes('upload') || step.includes('sending')) return thisIdx === 0 ? 'active' : 'pending';
        if (step.includes('ai') || step.includes('generat')) return thisIdx <= 1 ? 'complete' : 'active';
        if (step.includes('complete')) return 'complete';
        return thisIdx === 0 ? 'active' : 'pending';
    }

    if (thisIdx < currentIdx) return 'complete';
    if (thisIdx === currentIdx) return 'active';
    return 'pending';
};

const ProcessingStatus = ({ isProcessing, processingStep, timeRemaining, error, onRetry, generatedContent }) => {
    // Don't render if processing is complete and we have results
    if (!isProcessing && !error && generatedContent) return null;

    // Don't render if not processing and no error
    if (!isProcessing && !error) return null;

    return (
        <div className="processing-status">
            <div className="ps-header">
                {error ? (
                    <span className="ps-error-icon">⚠️</span>
                ) : (
                    <>
                        <div className="ps-spinner" />
                        <span className="ps-label">
                            {processingStep || 'Processing document…'}
                        </span>
                    </>
                )}
                {isProcessing && timeRemaining && !error && (
                    <span className="ps-time-badge">~{timeRemaining}s remaining</span>
                )}
            </div>

            <div className="ps-pipeline">
                {STEPS.map((step, idx) => {
                    const state = getStepState(step.id, processingStep, generatedContent);
                    return (
                        <React.Fragment key={step.id}>
                            <div className={`ps-node ps-node--${state}`}>
                                <div className="ps-node-icon">
                                    {state === 'complete'
                                        ? <span className="material-symbols-outlined">check_circle</span>
                                        : state === 'active'
                                            ? <div className="ps-node-pulse" />
                                            : <span className="material-symbols-outlined ps-node-pending-icon">{step.icon}</span>
                                    }
                                </div>
                                <span className="ps-node-label">{step.label}</span>
                                {state === 'active' && <span className="ps-node-sub">In Progress</span>}
                                {state === 'complete' && <span className="ps-node-sub">Complete</span>}
                                {state === 'pending' && <span className="ps-node-sub">Pending</span>}
                            </div>
                            {idx < STEPS.length - 1 && (
                                <div className={`ps-connector ${state === 'complete' ? 'ps-connector--done' : ''}`}>
                                    <div className="ps-connector-dot" />
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {error && (
                <div className="ps-error">
                    <span className="ps-error-msg">
                        <span>⚠️</span> {error}
                    </span>
                    {onRetry && (
                        <button className="ps-retry-btn" onClick={onRetry}>
                            Retry
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProcessingStatus;
