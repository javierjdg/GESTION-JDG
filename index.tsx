
import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Prevent external third-party script errors from crashing the app
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event.message === 'Script error.' || event.message?.includes('ResizeObserver loop')) {
      event.preventDefault();
    }
  });
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', color: '#fff', padding: '20px', fontFamily: 'sans-serif' }}>
          <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center', background: '#1f2937', padding: '24px', borderRadius: '12px', border: '1px solid #374151' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '12px', color: '#f87171' }}>Algo salió mal</h2>
            <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '16px' }}>Ha ocurrido un error inesperado al cargar la aplicación.</p>
            <button 
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              style={{ padding: '8px 16px', background: '#00797b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
