import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home, Sparkles } from 'lucide-react';

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

    // Auto-reload on stale deployment chunk errors
    const isChunkError = 
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Importing a module script failed') ||
      error?.name === 'ChunkLoadError';

    if (isChunkError && !sessionStorage.getItem('chunk_reload_attempted')) {
      sessionStorage.setItem('chunk_reload_attempted', 'true');
      window.location.reload();
    }
  }

  private handleReset = () => {
    sessionStorage.removeItem('chunk_reload_attempted');
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  private handleReload = () => {
    sessionStorage.removeItem('chunk_reload_attempted');
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'Algo salió mal. Por favor, intenta de nuevo.';
      let isFirestoreError = false;
      let isChunkError = false;

      const rawMsg = this.state.error?.message || '';

      if (
        rawMsg.includes('Failed to fetch dynamically imported module') ||
        rawMsg.includes('Importing a module script failed') ||
        this.state.error?.name === 'ChunkLoadError'
      ) {
        isChunkError = true;
        errorMessage = 'Se ha publicado una nueva versión de la aplicación. Haz clic en "Actualizar ahora" para cargar los cambios.';
      } else {
        try {
          if (rawMsg) {
            const parsed = JSON.parse(rawMsg);
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
          errorMessage = rawMsg || errorMessage;
        }
      }

      return (
        <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-6 text-primary shadow-sm border border-primary/10">
            {isChunkError ? <Sparkles size={40} /> : <AlertCircle size={40} className="text-error" />}
          </div>
          <h1 className="text-2xl font-black text-on-surface mb-2 font-headline">
            {isChunkError ? '¡Nueva Versión Disponible!' : '¡Ups! Algo salió mal'}
          </h1>
          <p className="text-on-surface-variant text-sm max-w-md mb-8 leading-relaxed font-medium">
            {errorMessage}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <button
              onClick={this.handleReload}
              className="flex-1 py-3.5 bg-primary text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 text-xs uppercase tracking-wider active:scale-95"
            >
              <RefreshCw size={16} />
              {isChunkError ? 'Actualizar Ahora' : 'Reintentar'}
            </button>
            <button
              onClick={this.handleReset}
              className="flex-1 py-3.5 bg-surface-container-low text-on-surface font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-on-surface/5 transition-colors border border-on-surface/5 text-xs uppercase tracking-wider active:scale-95"
            >
              <Home size={16} />
              Inicio
            </button>
          </div>
          {isFirestoreError && (
            <p className="mt-8 text-[10px] text-on-surface-variant/40 font-mono">
              ID de error: {Math.random().toString(36).substring(7)}
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
