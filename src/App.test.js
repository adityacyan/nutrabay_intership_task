import { render, screen } from '@testing-library/react';
import App from './App';

test('renders SOP Processor main heading', () => {
    render(<App />);
    const titleElement = screen.getByRole('heading', { name: /SOP Processor/i });
    expect(titleElement).toBeInTheDocument();
});

test('renders navigation links', () => {
    render(<App />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Processor')).toBeInTheDocument();
    expect(screen.getByText('Demo')).toBeInTheDocument();
    expect(screen.getByText('Automation')).toBeInTheDocument();
});

test('renders feature cards on home page', () => {
    render(<App />);
    expect(screen.getByText('Upload Documents')).toBeInTheDocument();
    expect(screen.getByText('Generate Training Materials')).toBeInTheDocument();
    expect(screen.getByText('Export Presentations')).toBeInTheDocument();
});