import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import FileUpload from './FileUpload';

// Mock react-dropzone
jest.mock('react-dropzone', () => ({
    useDropzone: jest.fn()
}));

const mockUseDropzone = require('react-dropzone').useDropzone;

describe('FileUpload Component', () => {
    const mockOnFileSelect = jest.fn();
    const mockOnError = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();

        // Default mock implementation
        mockUseDropzone.mockReturnValue({
            getRootProps: () => ({ 'data-testid': 'dropzone' }),
            getInputProps: () => ({ 'data-testid': 'file-input' }),
            isDragActive: false,
            isDragReject: false
        });
    });

    const renderFileUpload = (props = {}) => {
        return render(
            <FileUpload
                onFileSelect={mockOnFileSelect}
                onError={mockOnError}
                {...props}
            />
        );
    };

    test('renders file upload component with initial state', () => {
        renderFileUpload();

        expect(screen.getByText('Upload SOP Document')).toBeInTheDocument();
        expect(screen.getByText(/Drag & drop your SOP document here/)).toBeInTheDocument();
        expect(screen.getByText('Supported formats: .txt, .pdf')).toBeInTheDocument();
        expect(screen.getByText('Maximum size: 10MB')).toBeInTheDocument();
    });

    test('shows drag active state', () => {
        mockUseDropzone.mockReturnValue({
            getRootProps: () => ({ 'data-testid': 'dropzone' }),
            getInputProps: () => ({ 'data-testid': 'file-input' }),
            isDragActive: true,
            isDragReject: false
        });

        renderFileUpload();

        expect(screen.getByText('Drop the file here...')).toBeInTheDocument();
    });

    test('validates file size correctly', async () => {
        const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.txt', {
            type: 'text/plain'
        });

        // Mock the onDrop callback to simulate file validation
        let onDropCallback;
        mockUseDropzone.mockImplementation(({ onDrop }) => {
            onDropCallback = onDrop;
            return {
                getRootProps: () => ({ 'data-testid': 'dropzone' }),
                getInputProps: () => ({ 'data-testid': 'file-input' }),
                isDragActive: false,
                isDragReject: false
            };
        });

        renderFileUpload();

        // Simulate dropping a large file
        await act(async () => {
            onDropCallback([], [{
                file: largeFile,
                errors: [{ code: 'file-too-large', message: 'File is too large' }]
            }]);
        });

        expect(mockOnError).toHaveBeenCalledWith(
            expect.stringContaining('File size exceeds 10MB limit')
        );
    });

    test('validates file type correctly', async () => {
        const invalidFile = new File(['content'], 'test.doc', {
            type: 'application/msword'
        });

        let onDropCallback;
        mockUseDropzone.mockImplementation(({ onDrop }) => {
            onDropCallback = onDrop;
            return {
                getRootProps: () => ({ 'data-testid': 'dropzone' }),
                getInputProps: () => ({ 'data-testid': 'file-input' }),
                isDragActive: false,
                isDragReject: false
            };
        });

        renderFileUpload();

        // Simulate dropping an invalid file type
        await act(async () => {
            onDropCallback([], [{
                file: invalidFile,
                errors: [{ code: 'file-invalid-type', message: 'File type not accepted' }]
            }]);
        });

        expect(mockOnError).toHaveBeenCalledWith(
            expect.stringContaining('Unsupported file format')
        );
    });

    test('accepts valid text file', async () => {
        const validFile = new File(['SOP content'], 'sop.txt', {
            type: 'text/plain'
        });

        let onDropCallback;
        mockUseDropzone.mockImplementation(({ onDrop }) => {
            onDropCallback = onDrop;
            return {
                getRootProps: () => ({ 'data-testid': 'dropzone' }),
                getInputProps: () => ({ 'data-testid': 'file-input' }),
                isDragActive: false,
                isDragReject: false
            };
        });

        renderFileUpload();

        // Simulate dropping a valid file
        await act(async () => {
            onDropCallback([validFile], []);
        });

        expect(mockOnFileSelect).toHaveBeenCalledWith(validFile);
    });

    test('accepts valid PDF file', async () => {
        const validFile = new File(['PDF content'], 'sop.pdf', {
            type: 'application/pdf'
        });

        let onDropCallback;
        mockUseDropzone.mockImplementation(({ onDrop }) => {
            onDropCallback = onDrop;
            return {
                getRootProps: () => ({ 'data-testid': 'dropzone' }),
                getInputProps: () => ({ 'data-testid': 'file-input' }),
                isDragActive: false,
                isDragReject: false
            };
        });

        renderFileUpload();

        // Simulate dropping a valid PDF file
        await act(async () => {
            onDropCallback([validFile], []);
        });

        expect(mockOnFileSelect).toHaveBeenCalledWith(validFile);
    });

    test('displays uploaded file information', async () => {
        const validFile = new File(['SOP content'], 'test-sop.txt', {
            type: 'text/plain'
        });

        let onDropCallback;
        mockUseDropzone.mockImplementation(({ onDrop }) => {
            onDropCallback = onDrop;
            return {
                getRootProps: () => ({ 'data-testid': 'dropzone' }),
                getInputProps: () => ({ 'data-testid': 'file-input' }),
                isDragActive: false,
                isDragReject: false
            };
        });

        renderFileUpload();

        // Simulate file upload
        await act(async () => {
            onDropCallback([validFile], []);
        });

        expect(screen.getByText('test-sop.txt')).toBeInTheDocument();
        expect(screen.getByText('text/plain')).toBeInTheDocument();
        expect(screen.getByText('File uploaded successfully! Ready for processing.')).toBeInTheDocument();
    });

    test('removes uploaded file when remove button is clicked', async () => {
        const validFile = new File(['SOP content'], 'test-sop.txt', {
            type: 'text/plain'
        });

        let onDropCallback;
        mockUseDropzone.mockImplementation(({ onDrop }) => {
            onDropCallback = onDrop;
            return {
                getRootProps: () => ({ 'data-testid': 'dropzone' }),
                getInputProps: () => ({ 'data-testid': 'file-input' }),
                isDragActive: false,
                isDragReject: false
            };
        });

        renderFileUpload();

        // Upload file
        await act(async () => {
            onDropCallback([validFile], []);
        });
        expect(screen.getByText('test-sop.txt')).toBeInTheDocument();

        // Remove file
        const removeButton = screen.getByTitle('Remove file');
        await act(async () => {
            fireEvent.click(removeButton);
        });

        expect(screen.queryByText('test-sop.txt')).not.toBeInTheDocument();
        expect(screen.getByText(/Drag & drop your SOP document here/)).toBeInTheDocument();
    });

    test('formats file size correctly', async () => {
        const file1KB = new File(['x'.repeat(1024)], 'test.txt', { type: 'text/plain' });

        let onDropCallback;
        mockUseDropzone.mockImplementation(({ onDrop }) => {
            onDropCallback = onDrop;
            return {
                getRootProps: () => ({ 'data-testid': 'dropzone' }),
                getInputProps: () => ({ 'data-testid': 'file-input' }),
                isDragActive: false,
                isDragReject: false
            };
        });

        renderFileUpload();

        // Test 1KB file
        await act(async () => {
            onDropCallback([file1KB], []);
        });
        expect(screen.getByText('1 KB')).toBeInTheDocument();
    });

    test('handles files without explicit type (based on extension)', async () => {
        const txtFile = new File(['content'], 'test.txt', { type: '' });

        let onDropCallback;
        mockUseDropzone.mockImplementation(({ onDrop }) => {
            onDropCallback = onDrop;
            return {
                getRootProps: () => ({ 'data-testid': 'dropzone' }),
                getInputProps: () => ({ 'data-testid': 'file-input' }),
                isDragActive: false,
                isDragReject: false
            };
        });

        renderFileUpload();

        // Test .txt file without type
        await act(async () => {
            onDropCallback([txtFile], []);
        });
        expect(mockOnFileSelect).toHaveBeenCalledWith(txtFile);
    });

    test('validates file extension when MIME type is missing', async () => {
        const invalidFile = new File(['content'], 'test.doc', { type: '' });

        let onDropCallback;
        mockUseDropzone.mockImplementation(({ onDrop }) => {
            onDropCallback = onDrop;
            return {
                getRootProps: () => ({ 'data-testid': 'dropzone' }),
                getInputProps: () => ({ 'data-testid': 'file-input' }),
                isDragActive: false,
                isDragReject: false
            };
        });

        renderFileUpload();

        // Test invalid extension
        await act(async () => {
            onDropCallback([invalidFile], []);
        });

        expect(mockOnError).toHaveBeenCalledWith(
            expect.stringContaining('Unsupported file format')
        );
    });
});
