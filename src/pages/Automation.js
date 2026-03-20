import React from 'react';
import AutomationConfig from '../components/AutomationConfig';

export default function Automation() {
    return (
        <div className="page-main">
            <h1 className="page-title">Automation</h1>
            <p className="page-subtitle">Configure automated folder monitoring and processing pipelines.</p>
            <AutomationConfig />
        </div>
    );
}
