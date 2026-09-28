import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Delete, Check, Loader2, Zap, Clock } from 'lucide-react';
import { Shortcut, addTransaction } from '../services/firestoreService';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { ShortcutIconComponent } from '../pages/ManageShortcuts';
import { formatCurrency, cn } from '../lib/utils';
import { getLocalToday } from '../lib/dateUtils';

interface ShortcutKeypadModalProps {
  shortcut: Shortcut | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ShortcutKeypadModal: React.FC<ShortcutKeypadModalProps> = ({ shortcut, onClose, onSuccess }) => {
  const { categories, projects } = useData();
  const { profile } = useAuth();
  const [amountStr, setAmountStr] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (shortcut) {
      if (shortcut.defaultAmount && shortcut.defaultAmount > 0) {
        setAmountStr(String(shortcut.defaultAmount));
      } else {
        setAmountStr('');
      }
      setErrorMsg('');
      setShowSuccess(false);
    }
  }, [shortcut]);

  if (!shortcut) return null;

  const category = categories.find(c => c.id === shortcut.categoryId);
  const project = shortcut.projectId === 'personal' 
    ? { name: 'Personal', currency: profile?.currency || 'ARS' } 
    : projects.find(p => p.id === shortcut.projectId);

  const currency = project?.currency || profile?.currency || 'ARS';

  const handleKeyPress = (val: string) => {
    if (showSuccess) return;

    if (val === 'C') {
      setAmountStr('');
      return;
    }

    if (val === 'BACKSPACE') {
      setAmountStr(prev => prev.slice(0, -1));
      return;
    }

    if (val === '00') {
      if (!amountStr || amountStr === '0') return;
      if (amountStr.length >= 9) return;
      setAmountStr(prev => prev + '00');
      return;
    }

    if (val === '.') {
      if (amountStr.includes('.')) return;
      setAmountStr(prev => (prev === '' ? '0.' : prev + '.'));
      return;
    }

    // Number digit
    if (amountStr === '0') {
      setAmountStr(val);
    } else {
      if (amountStr.length >= 10) return;
      setAmountStr(prev => prev + val);
    }
  };

  const parsedAmount = parseFloat(amountStr) || 0;

  const handleConfirm = async () => {
    if (parsedAmount <= 0) {
      setErrorMsg('Por favor ingresa un monto válido mayor a 0.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await addTransaction({
        amount: parsedAmount,
        type: 'expense',
        description: shortcut.name,
        date: getLocalToday(),
        categoryId: shortcut.categoryId,
        categoryName: category?.name || 'Otros',
        categoryIcon: category?.icon || 'MoreHorizontal',
        categoryColor: category?.color || 'bg-slate-400',
        projectId: shortcut.projectId === 'personal' ? null : shortcut.projectId,
        paymentMethod: shortcut.paymentMethod || 'Efectivo',
        classification: shortcut.classification || 'variable',
      });

      setShowSuccess(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Error recording shortcut expense:', err);
      setErrorMsg('Ocurrió un error al guardar el gasto. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div 
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-surface w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl relative z-10 flex flex-col overflow-hidden border border-on-surface/10 max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-on-surface/5 bg-surface shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={cn(
                "w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0",
                category?.color || 'bg-amber-500'
              )}>
                <ShortcutIconComponent name={shortcut.icon} size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-on-surface text-base sm:text-lg font-headline truncate leading-tight">
                  {shortcut.name}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                    {project?.name || 'Personal'}
                  </span>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-on-surface/5 text-on-surface-variant">
                    {shortcut.paymentMethod || 'Efectivo'}
                  </span>
                  <span className={cn(
                    "text-[9px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1",
                    shortcut.classification === 'fixed' ? "bg-primary/10 text-primary" : "bg-orange-500/10 text-orange-600"
                  )}>
                    {shortcut.classification === 'fixed' ? <Clock size={9} /> : <Zap size={9} />}
                    {shortcut.classification === 'fixed' ? 'Fijo' : 'Var'}
                  </span>
                </div>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="p-2 hover:bg-on-surface/5 rounded-full transition-colors text-on-surface-variant shrink-0 ml-2"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body / Display */}
          <div className="p-6 pb-2 text-center bg-surface flex flex-col items-center justify-center">
            {showSuccess ? (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="py-8 flex flex-col items-center justify-center text-emerald-600 space-y-2"
              >
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-600">
                  <Check size={36} strokeWidth={3} />
                </div>
                <h4 className="text-xl font-extrabold font-headline">¡Gasto Registrado!</h4>
                <p className="text-sm font-bold text-on-surface">
                  {formatCurrency(parsedAmount, currency)} en {shortcut.name}
                </p>
              </motion.div>
            ) : (
              <>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50 mb-1 block">
                  Ingrese el Monto ({currency})
                </span>
                
                <div className="w-full bg-surface-container-low py-4 px-6 rounded-3xl border border-on-surface/5 flex items-center justify-center my-2 shadow-inner">
                  <span className="text-3xl sm:text-4xl font-black font-headline text-on-surface tracking-tight">
                    {formatCurrency(parsedAmount, currency)}
                  </span>
                </div>

                {errorMsg && (
                  <p className="text-xs font-bold text-rose-600 bg-rose-500/10 px-3 py-1.5 rounded-xl uppercase tracking-wider mt-1">
                    {errorMsg}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Keypad Grid */}
          {!showSuccess && (
            <div className="p-5 pt-2 bg-surface space-y-3">
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'BACKSPACE'].map((key) => {
                  if (key === 'BACKSPACE') {
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleKeyPress('BACKSPACE')}
                        className="h-14 sm:h-16 bg-surface-container-low hover:bg-on-surface/10 rounded-2xl flex items-center justify-center font-bold text-on-surface-variant text-xl active:scale-95 transition-all shadow-sm"
                      >
                        <Delete size={22} />
                      </button>
                    );
                  }

                  if (key === 'C') {
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleKeyPress('C')}
                        className="h-14 sm:h-16 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-2xl flex items-center justify-center font-black text-lg active:scale-95 transition-all"
                      >
                        C
                      </button>
                    );
                  }

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleKeyPress(key)}
                      className="h-14 sm:h-16 bg-surface-container-low hover:bg-on-surface/10 text-on-surface rounded-2xl flex items-center justify-center font-black text-2xl font-headline active:scale-95 transition-all shadow-sm"
                    >
                      {key}
                    </button>
                  );
                })}
              </div>

              {/* Confirm CTA */}
              <button 
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting || parsedAmount <= 0}
                className="w-full bg-primary text-white py-4 rounded-2xl font-extrabold text-lg font-headline shadow-xl shadow-primary/20 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Guardando gasto...</span>
                  </>
                ) : (
                  <>
                    <Check size={22} strokeWidth={3} />
                    <span>Confirmar Gasto</span>
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
