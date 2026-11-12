import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { haptic } from '../lib/haptics';

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDeleting?: boolean;
  variant?: 'danger' | 'warning';
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = '¿Eliminar elemento?',
  description = 'Esta acción no se puede deshacer y los datos se eliminarán permanentemente.',
  confirmText = 'Eliminar',
  cancelText = 'Cancelar',
  isDeleting = false,
  variant = 'danger'
}) => {
  const isDanger = variant === 'danger';

  const handleConfirm = () => {
    haptic.medium();
    onConfirm();
  };

  const handleClose = () => {
    if (!isDeleting) {
      haptic.light();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal / Bottom Sheet */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            className="relative w-full max-w-md bg-surface-container-lowest rounded-t-[2.5rem] sm:rounded-3xl p-6 sm:p-7 shadow-2xl border border-on-surface/10 z-10 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
          >
            {/* Header Icon */}
            <div
              className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 border transition-colors",
                isDanger
                  ? "bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/20"
                  : "bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20"
              )}
            >
              {isDanger ? (
                <Trash2 size={26} strokeWidth={2.2} />
              ) : (
                <AlertTriangle size={26} strokeWidth={2.2} />
              )}
            </div>

            {/* Title & Description */}
            <div className="text-center space-y-2 mb-6">
              <h3 className="text-lg sm:text-xl font-black text-on-surface font-headline tracking-tight">
                {title}
              </h3>
              {typeof description === 'string' ? (
                <p className="text-xs sm:text-sm text-on-surface-variant/80 leading-relaxed max-w-sm mx-auto">
                  {description}
                </p>
              ) : (
                description
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isDeleting}
                className="flex-1 py-3.5 px-4 rounded-2xl bg-surface-container hover:bg-surface-container-high text-on-surface font-extrabold text-xs uppercase tracking-wider border border-on-surface/10 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isDeleting}
                className={cn(
                  "flex-1 py-3.5 px-4 rounded-2xl text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50",
                  isDanger
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/25"
                    : "bg-amber-600 hover:bg-amber-700 shadow-amber-600/25"
                )}
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    {isDanger ? <Trash2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{confirmText}</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
