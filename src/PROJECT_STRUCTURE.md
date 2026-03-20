# SOP Processor Project Structure

## Overview
This document outlines the project structure and core dependencies for the SOP Processor application.

## Folder Structure

```
src/
├── components/          # React components
│   └── index.js        # Component exports
├── services/           # Business logic services
│   └── index.js        # Service exports
├── utils/              # Utility functions and constants
│   ├── constants.js    # Application constants
│   ├── index.js        # Utility exports
│   └── projectVerification.js  # Project verification utility
├── App.js              # Main application component with routing
├── App.css             # Application styles
├── App.test.js         # Application tests
├── index.js            # Application entry point
├── index.css           # Global styles
└── setupTests.js       # Test configuration

```

## Core Dependencies

### React Ecosystem
- `react` (^18.2.0) - Core React library
- `react-dom` (^18.2.0) - React DOM rendering
- `react-router-dom` (^6.8.0) - Client-side routing
- `react-scripts` (5.0.1) - Build and development tools

### File Processing
- `pdf-parse` (^1.1.1) - PDF text extraction
- `react-dropzone` (^14.2.3) - File upload with drag-and-drop
- `file-saver` (^2.0.5) - File download functionality

### HTTP Client
- `axios` (^1.3.0) - HTTP requests for API integration

### Document Generation
- `officegen` (^0.6.5) - Office document generation (PowerPoint, etc.)

### File System Monitoring
- `chokidar` (^3.5.3) - File system watching for automation

### Testing
- `@testing-library/react` (^13.4.0) - React component testing
- `@testing-library/jest-dom` (^5.16.5) - Jest DOM matchers
- `@testing-library/user-event` (^13.5.0) - User interaction testing

## Application Structure

### Routing
The application uses React Router with the following routes:
- `/` - Home page with feature overview
- `/processor` - Document processing interface
- `/demo` - Interactive demo interface
- `/automation` - Automation configuration

### Component Architecture
- **App Component**: Main container with navigation and routing
- **Page Components**: Individual page layouts (HomePage, ProcessorPage, etc.)
- **Feature Components**: Will be added in subsequent tasks

### Service Architecture
Services will be implemented in later tasks following the design document:
- DocumentParser - File parsing and validation
- ContentExtractor - Content analysis and extraction
- AIProcessor - AI-powered content generation
- ContentGenerator - Training material creation
- OutputFormatter - Multi-format output generation
- FileStorageService - File organization and storage
- AutomationService - Workflow automation

## Constants and Configuration

### File Types
- Supported: PDF, Plain Text
- Maximum file size: 10MB

### Processing Stages
- Upload, Parsing, Extraction, AI Processing, Generation, Formatting, Complete, Error

### Question Types
- Multiple Choice, True/False, Scenario-based

## Verification

Use the project verification utility to check that all dependencies and structure are properly set up:

```javascript
import { logVerificationResults } from './utils';
logVerificationResults();
```