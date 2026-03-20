# SOP Processor

Transform Standard Operating Procedure documents into comprehensive training materials.

## Features

- Upload and process SOP documents (text/PDF format)
- Generate structured summaries and step-by-step training content
- Create evaluation questions and assessments
- Export to presentation formats
- Automated processing workflows
- Interactive demo interface

## Project Structure

```
src/
├── components/          # React components
├── services/           # Business logic and API services
├── utils/              # Utility functions and constants
├── App.js              # Main application component
├── App.css             # Application styles
├── index.js            # Application entry point
└── index.css           # Global styles
```

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Open [http://localhost:3000](http://localhost:3000) to view the application.

### Available Scripts

- `npm start` - Runs the app in development mode
- `npm test` - Launches the test runner
- `npm run build` - Builds the app for production
- `npm run eject` - Ejects from Create React App (one-way operation)

## Dependencies

### Core Dependencies
- React 18.2.0 - UI framework
- React Router DOM 6.8.0 - Client-side routing
- Axios 1.3.0 - HTTP client for API requests

### File Processing
- pdf-parse 1.1.1 - PDF text extraction
- file-saver 2.0.5 - File download functionality
- react-dropzone 14.2.3 - Drag-and-drop file upload

### Content Generation
- officegen 0.6.5 - Office document generation
- chokidar 3.5.3 - File system monitoring

### Development
- Testing Library - React component testing
- Jest - Test runner (included with React Scripts)

## Development Roadmap

This project follows a structured implementation plan:

1. ✅ Project setup and dependencies
2. File upload and validation system
3. Content extraction and processing engine
4. Content generation system
5. Output formatting and presentation generation
6. File storage and organization system
7. Automation and monitoring system
8. Demo interface and sample functionality
9. Error handling and notification system
10. End-to-end integration and testing

## License

This project is private and proprietary.