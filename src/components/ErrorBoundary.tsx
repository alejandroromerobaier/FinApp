import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'Algo salió mal. Por favor, intenta de nuevo.';
      let isFirestoreError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            isFirestoreError = true;
            if (parsed.error.includes('insufficient permissions')) {
              errorMessage = 'No tienes permisos para realizar esta acción. Verifica tu cuenta o contacta al administrador.';
            } else {
              errorMessage = `Error de base de datos: ${parsed.error}`;
            }
          }
        }
      } catch (e) {
        // Not a JSON error message
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-[#FDFCFB] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 text-red-600">
            <AlertCircle size={40} />
          </div>
          <h1 className="text-2xl font-bold text-[#1C1B1B] mb-2">¡Ups! Algo salió mal</h1>
          <p className="text-[#4A4543] max-w-md mb-8">
            {errorMessage}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 py-3 bg-[#1C1B1B] text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-black transition-colors"
            >
              <RefreshCw size={18} />
              Reintentar
            </button>
            <button
              onClick={this.handleReset}
              className="flex-1 py-3 bg-[#F4F2F0] text-[#1C1B1B] font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-[#EBE8E5] transition-colors"
            >
              <Home size={18} />
              Inicio
            </button>
          </div>
          {isFirestoreError && (
            <p className="mt-8 text-[10px] text-[#4A4543]/40 font-mono">
              ID de error: {Math.random().toString(36).substring(7)}
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
