import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { haptic } from '../lib/haptics';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 3200) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    // Trigger subtle haptic based on toast type
    if (type === 'success') haptic.success();
    else if (type === 'error' || type === 'warning') haptic.error();
    else haptic.light();

    setToasts((prev) => [...prev.slice(-2), { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toastHelpers = {
    success: (msg: string, dur?: number) => showToast(msg, 'success', dur),
    error: (msg: string, dur?: number) => showToast(msg, 'error', dur),
    warning: (msg: string, dur?: number) => showToast(msg, 'warning', dur),
    info: (msg: string, dur?: number) => showToast(msg, 'info', dur),
  };

  // Intercept window.alert so no legacy modal blocks the app
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const originalAlert = window.alert;
      window.alert = (msg: string) => {
        const text = String(msg || '');
        if (text.toLowerCase().includes('error') || text.toLowerCase().includes('falló') || text.toLowerCase().includes('no se pudo')) {
          showToast(text, 'error', 4000);
        } else if (text.toLowerCase().includes('éxito') || text.toLowerCase().includes('correcto') || text.toLowerCase().includes('guardad')) {
          showToast(text, 'success', 3500);
        } else {
          showToast(text, 'info', 3500);
        }
      };

      return () => {
        window.alert = originalAlert;
      };
    }
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, toast: toastHelpers }}>
      {children}

      {/* Floating Animated Toast Container */}
      <div 
        aria-live="polite" 
        className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none w-full max-w-sm px-4"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => {
            const isSuccess = t.type === 'success';
            const isError = t.type === 'error';
            const isWarning = t.type === 'warning';

            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className={cn(
                  "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-2xl border text-sm font-bold max-w-full transition-all select-none",
                  isSuccess && "bg-surface-container-lowest/95 border-emerald-500/20 text-on-surface shadow-emerald-500/10",
                  isError && "bg-surface-container-lowest/95 border-rose-500/25 text-on-surface shadow-rose-500/10",
                  isWarning && "bg-surface-container-lowest/95 border-amber-500/25 text-on-surface shadow-amber-500/10",
                  t.type === 'info' && "bg-surface-container-lowest/95 border-primary/20 text-on-surface shadow-primary/10"
                )}
              >
                {/* Icon */}
                <div className="shrink-0">
                  {isSuccess && (
                    <div className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 size={16} />
                    </div>
                  )}
                  {isError && (
                    <div className="w-7 h-7 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                      <AlertCircle size={16} />
                    </div>
                  )}
                  {isWarning && (
                    <div className="w-7 h-7 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <AlertTriangle size={16} />
                    </div>
                  )}
                  {t.type === 'info' && (
                    <div className="w-7 h-7 rounded-full bg-primary/15 text-primary dark:text-blue-400 flex items-center justify-center">
                      <Info size={16} />
                    </div>
                  )}
                </div>

                {/* Message */}
                <p className="flex-1 text-xs font-bold leading-snug break-words">
                  {t.message}
                </p>

                {/* Dismiss button */}
                <button
                  type="button"
                  onClick={() => removeToast(t.id)}
                  className="shrink-0 p-1 rounded-lg text-on-surface-variant/40 hover:text-on-surface hover:bg-on-surface/5 transition-colors"
                  title="Cerrar"
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
