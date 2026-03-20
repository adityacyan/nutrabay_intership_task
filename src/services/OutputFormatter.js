/**
 * OutputFormatter - Converts generated SOP content into various presentation formats.
 * Now delegates to Python backend for all file generation.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

/**
 * OutputFormatter class for converting generated SOP content into multiple formats.
 * All heavy lifting is done by the Python backend.
 */
export class OutputFormatter {
    constructor() {
        this.baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    }

    /**
     * Creates a PowerPoint slide presentation from generated content.
     * Calls Python backend to generate the PPTX file.
     *
     * @param {Object} content - GeneratedContent object from ContentGenerator
     * @returns {Promise<Object>} { blob, fileName, slideCount }
     */
    async createSlidePresentation(content) {
        try {
            const response = await fetch(`${this.baseUrl}/api/generate-presentation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const title = content.summary?.title || 'presentation';
            const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pptx`;

            // Get slide count from response headers if available
            const slideCount = parseInt(response.headers.get('X-Slide-Count') || '1');

            return { blob, fileName, slideCount };
        } catch (error) {
            throw new Error(`Failed to generate presentation: ${error.message}`);
        }
    }

    /**
     * Formats generated content as an HTML document for web display.
     *
     * @param {Object} content - GeneratedContent object from ContentGenerator
     * @returns {Object} { html, title, sections }
     */
    formatForWeb(content) {
        const title = content.summary?.title || 'SOP Training Material';
        const sections = [];

        if (content.summary) {
            sections.push({
                id: 'summary',
                heading: 'Summary',
                html: this._renderSummarySection(content.summary)
            });
        }

        if (content.trainingMaterial) {
            sections.push({
                id: 'training',
                heading: 'Training Material',
                html: this._renderTrainingSection(content.trainingMaterial)
            });
        }

        if (content.evaluation) {
            sections.push({
                id: 'evaluation',
                heading: 'Evaluation',
                html: this._renderEvaluationSection(content.evaluation)
            });
        }

        const bodyContent = sections
            .map(s => `<section id="${s.id}"><h2>${this._escape(s.heading)}</h2>${s.html}</section>`)
            .join('\n');

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this._escape(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; color: #333; }
    h1 { color: #1a1a2e; border-bottom: 3px solid #4a90d9; padding-bottom: 0.5rem; }
    h2 { color: #2c3e50; margin-top: 2rem; }
    ul { line-height: 1.8; }
    .step { background: #f8f9fa; border-left: 4px solid #4a90d9; padding: 0.75rem 1rem; margin: 0.5rem 0; border-radius: 0 4px 4px 0; }
    .question { background: #fff8e1; border: 1px solid #ffc107; padding: 0.75rem 1rem; margin: 0.5rem 0; border-radius: 4px; }
    .meta { color: #666; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>${this._escape(title)}</h1>
  <p class="meta">Generated: ${content.generatedAt ? new Date(content.generatedAt).toLocaleString() : new Date().toLocaleString()}</p>
  ${bodyContent}
</body>
</html>`;

        return { html, title, sections };
    }

    /**
     * Generates a PDF document from generated content.
     * Calls Python backend to generate the PDF file.
     *
     * @param {Object} content - GeneratedContent object from ContentGenerator
     * @returns {Promise<Object>} { blob, fileName, pageCount }
     */
    async generatePDF(content) {
        try {
            const response = await fetch(`${this.baseUrl}/api/generate-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const title = content.summary?.title || 'sop_training';
            const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;

            // Get page count from response headers if available
            const pageCount = parseInt(response.headers.get('X-Page-Count') || '1');

            return { blob, fileName, pageCount };
        } catch (error) {
            throw new Error(`Failed to generate PDF: ${error.message}`);
        }
    }

    // ---------------------------------------------------------------------------
    // Private rendering helpers
    // ---------------------------------------------------------------------------

    _renderSummarySection(summary) {
        let html = '';
        if (summary.overview) {
            html += `<p>${this._escape(summary.overview)}</p>`;
        }
        if (summary.keyPoints?.length) {
            html += `<h3>Key Points</h3><ul>${summary.keyPoints.map(p => `<li>${this._escape(p)}</li>`).join('')}</ul>`;
        }
        if (summary.safetyRequirements?.length) {
            html += `<h3>Safety Requirements</h3><ul>${summary.safetyRequirements.map(r => `<li>${this._escape(r)}</li>`).join('')}</ul>`;
        }
        return html;
    }

    _renderTrainingSection(training) {
        let html = '';
        if (training.learningObjectives?.length) {
            html += `<h3>Learning Objectives</h3><ul>${training.learningObjectives.map(o => `<li>${this._escape(o)}</li>`).join('')}</ul>`;
        }
        if (training.steps?.length) {
            html += `<h3>Steps</h3>`;
            training.steps.forEach((step, i) => {
                const text = typeof step === 'string' ? step : step.description || step.title || JSON.stringify(step);
                html += `<div class="step"><strong>Step ${i + 1}:</strong> ${this._escape(text)}</div>`;
            });
        }
        if (training.estimatedDuration) {
            html += `<p class="meta">Estimated duration: ${training.estimatedDuration} minutes</p>`;
        }
        return html;
    }

    _renderEvaluationSection(evaluation) {
        let html = '';
        if (evaluation.instructions) {
            html += `<p>${this._escape(evaluation.instructions)}</p>`;
        }
        if (evaluation.questions?.length) {
            evaluation.questions.forEach((q, i) => {
                const text = typeof q === 'string' ? q : q.question || JSON.stringify(q);
                html += `<div class="question"><strong>Q${i + 1}:</strong> ${this._escape(text)}</div>`;
            });
        }
        if (evaluation.passingScore) {
            html += `<p class="meta">Passing score: ${evaluation.passingScore}%</p>`;
        }
        return html;
    }

    /**
     * Escapes HTML special characters to prevent XSS in generated output.
     * @param {string} str
     * @returns {string}
     */
    _escape(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

export default OutputFormatter;
