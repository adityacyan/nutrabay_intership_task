import ContentExtractor from './ContentExtractor';

describe('ContentExtractor', () => {
    let extractor;
    let mockDocument;

    beforeEach(() => {
        extractor = new ContentExtractor();
        mockDocument = {
            id: 'test-doc-1',
            filename: 'test-sop.txt',
            content: `# Safety Procedure for Chemical Handling

## Overview
This document outlines the standard operating procedure for handling chemicals safely.

## Procedure Steps
1. Always wear safety glasses and gloves before handling any chemicals
2. Ensure proper ventilation is available in the work area
3. Check the safety data sheet (SDS) for specific hazards
4. Never mix chemicals without proper authorization
5. Store chemicals in designated areas only

## Safety Requirements
- PPE is required at all times
- Emergency eyewash stations must be accessible
- Spill kits should be readily available
- Report any accidents immediately

## Emergency Procedures
In case of chemical spill:
a. Evacuate the area immediately
b. Alert emergency personnel
c. Do not attempt cleanup without proper training`,
            metadata: {
                title: 'Chemical Handling SOP'
            },
            createdAt: new Date()
        };
    });

    describe('extractProcedures', () => {
        test('should extract numbered procedure steps correctly', () => {
            const procedures = extractor.extractProcedures(mockDocument);

            // Should find all steps including numbered, bulleted, and lettered
            expect(procedures.length).toBeGreaterThan(5);

            // Check the first numbered step
            const firstNumberedStep = procedures.find(p => p.stepNumber === 1);
            expect(firstNumberedStep).toMatchObject({
                stepNumber: 1,
                content: 'Always wear safety glasses and gloves before handling any chemicals',
                type: 'numbered',
                isSafetyRelated: true
            });

            // Check the fourth numbered step
            const fourthNumberedStep = procedures.find(p => p.stepNumber === 4);
            expect(fourthNumberedStep).toMatchObject({
                stepNumber: 4,
                content: 'Never mix chemicals without proper authorization',
                type: 'numbered'
            });
        });

        test('should extract lettered procedure steps', () => {
            const document = {
                ...mockDocument,
                content: `Emergency Steps:
a. Evacuate the area immediately
b. Alert emergency personnel
c. Do not attempt cleanup`
            };

            const procedures = extractor.extractProcedures(document);

            expect(procedures).toHaveLength(3);
            expect(procedures[0]).toMatchObject({
                content: 'Evacuate the area immediately',
                type: 'lettered'
            });
        });

        test('should identify safety-related steps', () => {
            const procedures = extractor.extractProcedures(mockDocument);
            const safetySteps = procedures.filter(p => p.isSafetyRelated);

            expect(safetySteps.length).toBeGreaterThan(0);
            expect(safetySteps[0].content).toContain('safety glasses');
        });

        test('should handle empty or invalid document', () => {
            expect(() => extractor.extractProcedures(null)).toThrow('Invalid document provided');
            expect(() => extractor.extractProcedures({})).toThrow('Invalid document provided');
        });

        test('should extract context for procedure steps', () => {
            const procedures = extractor.extractProcedures(mockDocument);
            const stepWithContext = procedures.find(p => p.additionalContext && p.additionalContext.length > 0);

            expect(stepWithContext).toBeDefined();
            expect(stepWithContext.additionalContext).toBeInstanceOf(Array);
        });

        test('should assign correct section to steps', () => {
            const procedures = extractor.extractProcedures(mockDocument);
            const procedureSteps = procedures.filter(p => p.section === 'Procedure Steps');

            expect(procedureSteps.length).toBeGreaterThan(0);
        });
    });

    describe('identifySafetyRequirements', () => {
        test('should identify safety requirements with keywords', () => {
            const safetyReqs = extractor.identifySafetyRequirements(mockDocument);

            expect(safetyReqs.length).toBeGreaterThan(0);

            const ppeRequirement = safetyReqs.find(req =>
                req.content.toLowerCase().includes('ppe') ||
                req.content.toLowerCase().includes('safety glasses')
            );
            expect(ppeRequirement).toBeDefined();
            expect(ppeRequirement.type).toBe('personal_protective_equipment');
        });

        test('should assess safety severity correctly', () => {
            const document = {
                ...mockDocument,
                content: `DANGER: Never mix these chemicals - fatal reaction possible
WARNING: Wear gloves when handling
CAUTION: Ensure proper ventilation`
            };

            const safetyReqs = extractor.identifySafetyRequirements(document);

            const dangerReq = safetyReqs.find(req => req.content.includes('DANGER'));
            const warningReq = safetyReqs.find(req => req.content.includes('WARNING'));
            const cautionReq = safetyReqs.find(req => req.content.includes('CAUTION'));

            expect(dangerReq.severity).toBe('high');
            expect(warningReq.severity).toBe('medium');
            expect(cautionReq.severity).toBe('medium');
        });

        test('should categorize different types of safety requirements', () => {
            const document = {
                ...mockDocument,
                content: `Wear PPE at all times
Emergency evacuation procedures must be followed
Ensure proper ventilation in work area
Lockout/tagout procedures required`
            };

            const safetyReqs = extractor.identifySafetyRequirements(document);

            const categories = safetyReqs.map(req => req.type);
            expect(categories).toContain('personal_protective_equipment');
            expect(categories).toContain('emergency_procedure');
            expect(categories).toContain('environmental_control');
            expect(categories).toContain('lockout_tagout');
        });

        test('should extract matched safety keywords', () => {
            const safetyReqs = extractor.identifySafetyRequirements(mockDocument);

            const reqWithKeywords = safetyReqs.find(req => req.keywords.length > 0);
            expect(reqWithKeywords).toBeDefined();
            expect(reqWithKeywords.keywords).toBeInstanceOf(Array);
            expect(reqWithKeywords.keywords.length).toBeGreaterThan(0);
        });

        test('should handle documents with no safety requirements', () => {
            const document = {
                ...mockDocument,
                content: 'This is a simple document with regular content and procedures.'
            };

            const safetyReqs = extractor.identifySafetyRequirements(document);
            expect(safetyReqs).toHaveLength(0);
        });
    });

    describe('mapContentStructure', () => {
        test('should map document structure correctly', () => {
            const structure = extractor.mapContentStructure(mockDocument);

            expect(structure).toMatchObject({
                title: 'Chemical Handling SOP',
                totalLines: expect.any(Number),
                wordCount: expect.any(Number),
                hasNumberedSteps: true,
                hasSafetySection: true,
                documentType: expect.any(String)
            });

            expect(structure.sections).toBeInstanceOf(Array);
            expect(structure.sections.length).toBeGreaterThan(0);
        });

        test('should identify document sections', () => {
            const structure = extractor.mapContentStructure(mockDocument);

            const sectionTitles = structure.sections.map(s => s.title);
            expect(sectionTitles).toContain('Safety Procedure for Chemical Handling');
            expect(sectionTitles).toContain('Overview');
            expect(sectionTitles).toContain('Procedure Steps');
        });

        test('should count steps and safety items per section', () => {
            const structure = extractor.mapContentStructure(mockDocument);

            const procedureSection = structure.sections.find(s => s.title === 'Procedure Steps');
            expect(procedureSection).toBeDefined();

            // The procedure section should have numbered steps
            expect(procedureSection.stepCount).toBeGreaterThan(0);

            // Find a section that has safety content
            const safetySection = structure.sections.find(s => s.safetyItemCount > 0);
            expect(safetySection).toBeDefined();
        });

        test('should calculate document metrics', () => {
            const structure = extractor.mapContentStructure(mockDocument);

            expect(structure.totalSteps).toBeGreaterThan(0);
            expect(structure.totalSafetyItems).toBeGreaterThan(0);
            expect(structure.averageWordsPerSection).toBeGreaterThan(0);
        });

        test('should identify document type', () => {
            const structure = extractor.mapContentStructure(mockDocument);
            expect(structure.documentType).toBe('standard_operating_procedure');

            const sopDocument = {
                ...mockDocument,
                content: 'This is a Standard Operating Procedure (SOP) for equipment maintenance.'
            };

            const sopStructure = extractor.mapContentStructure(sopDocument);
            expect(sopStructure.documentType).toBe('standard_operating_procedure');
        });

        test('should handle documents without clear structure', () => {
            const document = {
                ...mockDocument,
                content: 'This is just plain text without any structure or formatting.'
            };

            const structure = extractor.mapContentStructure(document);

            // Now that we create a default section for content, expect 1 section
            expect(structure.sections).toHaveLength(1);
            expect(structure.hasNumberedSteps).toBe(false);
            expect(structure.totalSteps).toBe(0);
        });
    });

    describe('private helper methods', () => {
        test('_identifyStep should recognize different step formats', () => {
            const testCases = [
                '1. First step',
                '2) Second step',
                'a. Lettered step',
                'b) Another lettered step',
                'i. Roman numeral step',
                '• Bullet point step',
                '- Dash step',
                '* Asterisk step'
            ];

            testCases.forEach(testCase => {
                const result = extractor._identifyStep(testCase);
                expect(result).not.toBeNull();
                expect(result.content).toBeDefined();
                expect(result.type).toBeDefined();
            });
        });

        test('_containsSafetyKeywords should detect safety content', () => {
            const safetyTexts = [
                'Wear safety glasses',
                'DANGER: High voltage',
                'Emergency evacuation required',
                'PPE must be worn',
                'Toxic materials present'
            ];

            safetyTexts.forEach(text => {
                expect(extractor._containsSafetyKeywords(text)).toBe(true);
            });

            expect(extractor._containsSafetyKeywords('Regular procedure step')).toBe(false);
        });

        test('_assessSafetySeverity should categorize severity levels', () => {
            expect(extractor._assessSafetySeverity('DANGER: Fatal if ingested')).toBe('high');
            expect(extractor._assessSafetySeverity('WARNING: May cause injury')).toBe('medium');
            expect(extractor._assessSafetySeverity('Note: Keep area clean')).toBe('low');
        });

        test('_countWords should count words correctly', () => {
            expect(extractor._countWords('Hello world')).toBe(2);
            expect(extractor._countWords('  Multiple   spaces   between  words  ')).toBe(4);
            expect(extractor._countWords('')).toBe(0);
        });
    });

    describe('error handling', () => {
        test('should throw error for null document in extractProcedures', () => {
            expect(() => extractor.extractProcedures(null)).toThrow('Invalid document provided to extractProcedures');
        });

        test('should throw error for null document in identifySafetyRequirements', () => {
            expect(() => extractor.identifySafetyRequirements(null)).toThrow('Invalid document provided to identifySafetyRequirements');
        });

        test('should throw error for null document in mapContentStructure', () => {
            expect(() => extractor.mapContentStructure(null)).toThrow('Invalid document provided to mapContentStructure');
        });

        test('should handle document without content property', () => {
            const invalidDoc = { id: 'test', filename: 'test.txt' };

            expect(() => extractor.extractProcedures(invalidDoc)).toThrow('Invalid document provided');
            expect(() => extractor.identifySafetyRequirements(invalidDoc)).toThrow('Invalid document provided');
            expect(() => extractor.mapContentStructure(invalidDoc)).toThrow('Invalid document provided');
        });
    });

    describe('integration scenarios', () => {
        test('should handle complex SOP document with multiple sections', () => {
            const complexDocument = {
                ...mockDocument,
                content: `# STANDARD OPERATING PROCEDURE
Equipment Maintenance Protocol

## 1. SAFETY REQUIREMENTS
- Hard hat required in work area
- Safety glasses must be worn at all times
- Lockout/tagout procedures mandatory

## 2. PREPARATION STEPS
1. Gather required tools and materials
2. Review equipment manual and safety data sheet
3. Notify supervisor of maintenance activity

## 3. MAINTENANCE PROCEDURE
Step 1: Shut down equipment following proper sequence
Step 2: Apply lockout/tagout devices
Step 3: Verify zero energy state
Step 4: Begin maintenance work

## 4. EMERGENCY PROCEDURES
In case of emergency:
a) Stop all work immediately
b) Evacuate area if necessary
c) Contact emergency services if required

## 5. COMPLIANCE NOTES
This procedure must comply with OSHA regulations and company policy.`
            };

            const procedures = extractor.extractProcedures(complexDocument);
            const safetyReqs = extractor.identifySafetyRequirements(complexDocument);
            const structure = extractor.mapContentStructure(complexDocument);

            expect(procedures.length).toBeGreaterThan(5);
            expect(safetyReqs.length).toBeGreaterThan(3);
            expect(structure.sections.length).toBeGreaterThan(4);
            expect(structure.hasNumberedSteps).toBe(true);
            expect(structure.hasSafetySection).toBe(true);
            expect(structure.hasComplianceSection).toBe(true);
        });

        test('should handle document with mixed step formats', () => {
            const mixedDocument = {
                ...mockDocument,
                content: `Mixed Step Formats:
1. First numbered step
2. Second numbered step
a. First lettered substep
b. Second lettered substep
• First bullet point
• Second bullet point
i. Roman numeral step
ii. Another roman step`
            };

            const procedures = extractor.extractProcedures(mixedDocument);

            expect(procedures.length).toBe(8);

            const stepTypes = procedures.map(p => p.type);
            expect(stepTypes).toContain('numbered');
            expect(stepTypes).toContain('lettered');
            expect(stepTypes).toContain('bulleted');
            expect(stepTypes).toContain('roman');
        });
    });
});