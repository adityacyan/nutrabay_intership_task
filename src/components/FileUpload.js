import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPT_TYPES = {
    'text/plain':        ['.txt'],
    'application/pdf':   ['.pdf'],
};

const formatSize = (bytes) => {
    if (bytes < 1024)           return `${bytes} B`;
    if (bytes < 1024 * 1024)    return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isValidExtension = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    return ext === 'txt' || ext === 'pdf';
};

const FileUpload = ({ onFileSelect, onError, onClear }) => {
    const [uploadedFile, setUploadedFile] = useState(null);

    const onDrop = (acceptedFiles, rejectedFiles) => {
        if (rejectedFiles && rejectedFiles.length > 0) {
            const rejection = rejectedFiles[0];
            const errorCode = rejection.errors?.[0]?.code;
            if (errorCode === 'file-too-large') {
                onError?.('File size exceeds 10MB limit. Please upload a smaller file.');
            } else if (errorCode === 'file-invalid-type') {
                onError?.('Unsupported file format. Please upload .txt or .pdf files only.');
            } else {
                onError?.('File rejected. Please upload a valid .txt or .pdf file under 10MB.');
            }
            return;
        }

        if (acceptedFiles && acceptedFiles.length > 0) {
            const file = acceptedFiles[0];

            // Validate by extension when MIME type is empty
            if (!file.type && !isValidExtension(file.name)) {
                onError?.('Unsupported file format. Please upload .txt or .pdf files only.');
                return;
            }

            setUploadedFile(file);
            onFileSelect?.(file);
        }
    };

    const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
        onDrop,
        accept: ACCEPT_TYPES,
        maxSize: MAX_SIZE,
        multiple: false,
    });

    const handleRemove = () => {
        setUploadedFile(null);
        onClear?.();
    };

    return (
        <div className="file-upload-section">
            <div className="file-upload-header">
                <span className="material-symbols-outlined">upload_file</span>
                <h2>Upload SOP Document</h2>
            </div>

            {!uploadedFile ? (
                <div
                    {...getRootProps()}
                    className={`dropzone ${isDragActive ? 'dropzone--active' : ''} ${isDragReject ? 'dropzone--reject' : ''}`}
                >
                    <input {...getInputProps()} />
                    <div className="dropzone-icon">
                        <span className="material-symbols-outlined">
                            {isDragActive ? 'download' : 'cloud_upload'}
                        </span>
                    </div>
                    <p className="dropzone-primary">
                        {isDragActive
                            ? 'Drop the file here...'
                            : 'Drag & drop your SOP document here'}
                    </p>
                    <p className="dropzone-sub">or click to browse your files</p>
                    <div className="dropzone-meta">
                        <span>Supported formats: .txt, .pdf</span>
                        <span className="meta-dot">·</span>
                        <span>Maximum size: 10MB</span>
                    </div>
                </div>
            ) : (
                <div className="uploaded-file">
                    <div className="uploaded-file-icon">
                        <span className="material-symbols-outlined">description</span>
                    </div>
                    <div className="uploaded-file-info">
                        <span className="uploaded-file-name">{uploadedFile.name}</span>
                        <span className="uploaded-file-type">{uploadedFile.type || 'text/plain'}</span>
                        <span className="uploaded-file-size">{formatSize(uploadedFile.size)}</span>
                        <span className="uploaded-file-success">File uploaded successfully! Ready for processing.</span>
                    </div>
                    <button
                        className="btn btn--icon"
                        onClick={handleRemove}
                        title="Remove file"
                        type="button"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default FileUpload;
