import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Loader2, Zap, Clock, Wallet, CreditCard } from 'lucide-react';
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
  const [amount, setAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (shortcut) {
      if (shortcut.defaultAmount && shortcut.defaultAmount > 0) {
        setAmount(String(shortcut.defaultAmount));
      } else {
        setAmount('');
      }
      setErrorMsg('');
      setShowSuccess(false);

      // Focus input for mobile native keyboard
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 150);
    }
  }, [shortcut]);

  if (!shortcut) return null;

  const category = categories.find(c => c.id === shortcut.categoryId);
  const project = shortcut.projectId === 'personal' 
    ? { name: 'Personal', currency: profile?.currency || 'ARS' } 
    : projects.find(p => p.id === shortcut.projectId);

  const currency = project?.currency || profile?.currency || 'ARS';
  const parsedAmount = parseFloat(amount.replace(',', '.')) || 0;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0) {
      setErrorMsg('Ingresa un monto válido mayor a 0.');
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
      setErrorMsg('Ocurrió un error al guardar el gasto.');
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
          className="bg-surface w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl relative z-10 flex flex-col overflow-hidden border border-on-surface/10"
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
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-primary/10 text-primary shrink-0">
                    {project?.name || 'Personal'}
                  </span>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-on-surface/5 text-on-surface-variant shrink-0">
                    {shortcut.paymentMethod || 'Efectivo'}
                  </span>
                  <span className={cn(
                    "text-[9px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0",
                    shortcut.classification === 'fixed' ? "bg-primary/10 text-primary" : "bg-orange-500/10 text-orange-600"
                  )}>
                    {shortcut.classification === 'fixed' ? <Clock size={9} /> : <Zap size={9} />}
                    {shortcut.classification === 'fixed' ? 'Fijo' : 'Var'}
                  </span>
                </div>
              </div>
            </div>

            <button 
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-on-surface/5 rounded-full transition-colors text-on-surface-variant shrink-0 ml-2"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form with Native Input */}
          {showSuccess ? (
            <div className="p-8 text-center bg-surface flex flex-col items-center justify-center">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="py-4 flex flex-col items-center justify-center text-emerald-600 space-y-2"
              >
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-600">
                  <Check size={36} strokeWidth={3} />
                </div>
                <h4 className="text-xl font-extrabold font-headline">¡Gasto Registrado!</h4>
                <p className="text-sm font-bold text-on-surface">
                  {formatCurrency(parsedAmount, currency)} en {shortcut.name}
                </p>
              </motion.div>
            </div>
          ) : (
            <form onSubmit={handleConfirm} className="p-6 space-y-5 bg-surface pb-8 sm:pb-6">
              <div className="text-center space-y-1">
                <label className="block text-xs font-black uppercase tracking-widest text-on-surface-variant/50">
                  Ingresa el Monto ({currency})
                </label>
                <p className="text-[11px] text-on-surface-variant/60 font-medium">
                  Usa el teclado de tu dispositivo para ingresar el importe
                </p>
              </div>

              {/* Native Input Field */}
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-on-surface-variant/40 font-headline">
                  $
                </span>
                <input 
                  ref={inputRef}
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  value={amount}
                  onChange={(e) => {
                    let val = e.target.value.replace(',', '.');
                    val = val.replace(/[^0-9.]/g, '');
                    const parts = val.split('.');
                    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                    setAmount(val);
                  }}
                  placeholder="0.00"
                  className="w-full bg-surface-container-low border-2 border-transparent focus:border-primary/30 rounded-2xl py-4 pl-10 pr-4 text-3xl font-black font-headline text-center text-on-surface focus:ring-0 transition-all placeholder:text-on-surface-variant/20 shadow-inner"
                />
              </div>

              {errorMsg && (
                <p className="text-xs font-bold text-rose-600 bg-rose-500/10 px-3 py-2 rounded-xl uppercase tracking-wider text-center">
                  {errorMsg}
                </p>
              )}

              {/* Confirm CTA Button */}
              <button 
                type="submit"
                disabled={isSubmitting || parsedAmount <= 0}
                className="w-full bg-primary text-white py-4 rounded-2xl font-extrabold text-lg font-headline shadow-xl shadow-primary/20 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
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
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
