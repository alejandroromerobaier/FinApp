import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ArrowLeft,
  Calendar, 
  ShoppingBag, 
  ChevronDown, 
  Utensils, 
  Car, 
  Play, 
  Heart, 
  Book, 
  MoreHorizontal, 
  Landmark, 
  Tag, 
  Gift,
  Check,
  ChevronRight,
  Loader2,
  Briefcase,
  Home,
  Plane,
  Coffee,
  Zap,
  Smartphone,
  ShieldCheck,
  Trash2,
  CreditCard,
  Wallet,
  Clock,
  Layers,
  CalendarCheck,
  AlertCircle,
  Plus,
  Info,
  ArrowLeftRight
} from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { cn, formatCurrencyInput, formatAmountForDisplay, parseFormattedAmount, formatCurrency } from '../lib/utils';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { 
  addTransaction, 
  updateTransaction, 
  deleteTransaction, 
  getTransaction,
  createInstallmentExpense,
  createTransfer,
  CreditCard as CreditCardType
} from '../services/firestoreService';
import { getLocalToday, formatDisplayDate, formatLocalYYYYMMDD, parseLocalYYYYMMDD } from '../lib/dateUtils';
import { trackEvent } from '../lib/analytics';

const formatMonthLabel = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = parseLocalYYYYMMDD(dateStr);
  const formatted = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const ICON_MAP: Record<string, any> = {
  ShoppingBag, Utensils, Car, Play, Heart, Book, MoreHorizontal, 
  Landmark, Tag, Gift, Briefcase, Home, Plane, Coffee, Zap, Smartphone, ShieldCheck, ArrowLeftRight
};

const IconComponent = ({ name, size = 20 }: { name: string, size?: number }) => {
  const Icon = ICON_MAP[name] || MoreHorizontal;
  return <Icon size={size} />;
};

const computeDefaultFirstDueDate = (purchaseDateStr: string, card?: CreditCardType | null): string => {
  if (!purchaseDateStr) return getLocalToday();

  const [yearStr, monthStr, dayStr] = purchaseDateStr.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (!card || !card.closingDay) {
    let targetMonth = month + 1;
    let targetYear = year;
    if (targetMonth > 12) {
      targetMonth -= 12;
      targetYear += 1;
    }
    const maxDays = new Date(targetYear, targetMonth, 0).getDate();
    const finalDay = Math.min(day, maxDays);
    return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;
  }

  let targetMonth = month;
  let targetYear = year;

  if (day <= card.closingDay) {
    if (card.dueDay <= card.closingDay) {
      targetMonth += 1;
    }
  } else {
    if (card.dueDay <= card.closingDay) {
      targetMonth += 2;
    } else {
      targetMonth += 1;
    }
  }

  while (targetMonth > 12) {
    targetMonth -= 12;
    targetYear += 1;
  }

  const maxDays = new Date(targetYear, targetMonth, 0).getDate();
  const finalDay = Math.min(card.dueDay || day, maxDays);

  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;
};

export const AddExpense: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const { categories: allCategories, projects, cards, loading: dataLoading } = useData();
  
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [destination, setDestination] = useState<'personal' | 'shared'>('shared');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showProjectSheet, setShowProjectSheet] = useState(false);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getLocalToday());
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Débito' | 'Tarjeta de Crédito'>('Efectivo');
  const [classification, setClassification] = useState<'fixed' | 'variable'>('variable');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!id);
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [originalDate, setOriginalDate] = useState<Date | null>(null);

  // Credit Card & Installments State
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [customCardName, setCustomCardName] = useState('');
  const [installments, setInstallments] = useState<number | string>(1);
  const [isCustomInstallments, setIsCustomInstallments] = useState(false);
  const [calcMode, setCalcMode] = useState<'total' | 'installment'>('total');
  const [firstDueDate, setFirstDueDate] = useState<string>(getLocalToday());
  const [imputationMode, setImputationMode] = useState<'statement_cycle' | 'current_month'>('statement_cycle');

  // Existing Installment context (when editing)
  const [isExistingInstallment, setIsExistingInstallment] = useState(false);
  const [existingInstallmentNumber, setExistingInstallmentNumber] = useState<number | null>(null);
  const [existingTotalInstallments, setExistingTotalInstallments] = useState<number | null>(null);
  const [existingPlanId, setExistingPlanId] = useState<string | null>(null);

  // Transfer & Currency Exchange State
  const [fromProjectId, setFromProjectId] = useState<string>('personal');
  const [toProjectId, setToProjectId] = useState<string>('');
  const [toAmount, setToAmount] = useState<string>('');
  const [exchangeRateInput, setExchangeRateInput] = useState<string>('');

  // Existing Transfer context (when editing)
  const [isExistingTransfer, setIsExistingTransfer] = useState(false);
  const [existingTransferDirection, setExistingTransferDirection] = useState<'out' | 'in' | null>(null);
  const [existingRelatedProjectName, setExistingRelatedProjectName] = useState<string>('');
  const [existingRelatedAmount, setExistingRelatedAmount] = useState<number | null>(null);
  const [existingRelatedCurrency, setExistingRelatedCurrency] = useState<string>('');
  const [existingExchangeRate, setExistingExchangeRate] = useState<number | null>(null);

  const isAuthor = !id || authorId === user?.uid;

  const categories = allCategories.filter(c => c.type === (type === 'transfer' ? 'expense' : type));

  const [hasInitializedDefault, setHasInitializedDefault] = useState(false);

  const visibleProjects = useMemo(() => {
    return projects.filter(p => {
      if (id && p.id === selectedProjectId) return true;
      if (p.status === 'inactive') return false;
      return (p as any).showInExpenseSelector !== false;
    });
  }, [projects, id, selectedProjectId]);

  const isPersonalActive = (profile?.personalStatus || 'active') !== 'inactive';
  const isPersonalVisible = (isPersonalActive && (profile?.personalShowInExpenseSelector ?? true)) || (id && destination === 'personal');

  // Pre-select project based on user profile setting and visibility (runs once for new transactions)
  useEffect(() => {
    if (!id && !hasInitializedDefault && (projects.length > 0 || profile)) {
      const defaultId = profile?.defaultProjectId || 'personal';
      const personalVis = isPersonalActive && (profile?.personalShowInExpenseSelector ?? true);
      
      if (defaultId === 'personal') {
        if (personalVis) {
          setDestination('personal');
          setSelectedProjectId(null);
        } else if (visibleProjects.length > 0) {
          setDestination('shared');
          setSelectedProjectId(visibleProjects[0].id);
        }
      } else {
        const found = visibleProjects.find(p => p.id === defaultId);
        if (found) {
          setDestination('shared');
          setSelectedProjectId(found.id);
        } else if (visibleProjects.length > 0) {
          setDestination('shared');
          setSelectedProjectId(visibleProjects[0].id);
        } else if (personalVis) {
          setDestination('personal');
          setSelectedProjectId(null);
        }
      }
      setHasInitializedDefault(true);
    }
  }, [id, hasInitializedDefault, profile, projects, isPersonalActive, visibleProjects]);

  useEffect(() => {
    if (id) {
      const fetchTransaction = async () => {
        try {
          const t: any = await getTransaction(id);
          if (t) {
            setAmount(formatAmountForDisplay(t.amount));
            setType(t.type);
            setDescription(t.description || '');
            // Use original time from Firestore but normalize date string for the input
            const localDateStr = formatLocalYYYYMMDD(t.date);
            setDate(localDateStr);
            setOriginalDate(t.date);
            setAuthorId(t.authorId);
            
            // Normalize paymentMethod
            const pm = t.paymentMethod === 'Tarjeta' ? 'Tarjeta de Crédito' : (t.paymentMethod || 'Efectivo');
            setPaymentMethod(pm);
            if (t.cardId) setSelectedCardId(t.cardId);
            if (t.cardName) setCustomCardName(t.cardName);

            if (t.purchaseDate) {
              const pDate = typeof t.purchaseDate === 'string' ? t.purchaseDate : formatLocalYYYYMMDD(t.purchaseDate);
              setDate(pDate);
              setFirstDueDate(localDateStr);
              if (pDate === localDateStr) {
                setImputationMode('current_month');
              } else {
                setImputationMode('statement_cycle');
              }
            } else {
              setFirstDueDate(localDateStr);
            }

            if (t.isInstallment) {
              setIsExistingInstallment(true);
              setExistingInstallmentNumber(t.installmentNumber || null);
              setExistingTotalInstallments(t.totalInstallments || null);
              setExistingPlanId(t.installmentPlanId || null);
              setInstallments(t.totalInstallments || 1);
            }

            if (t.isTransfer) {
              setIsExistingTransfer(true);
              setExistingTransferDirection(t.transferDirection || (t.type === 'expense' ? 'out' : 'in'));
              setExistingRelatedProjectName(t.relatedProjectName || '');
              setExistingRelatedAmount(t.relatedAmount || null);
              setExistingRelatedCurrency(t.relatedCurrency || '');
              setExistingExchangeRate(t.exchangeRate || null);
            }

            setClassification(t.classification || 'variable');

            if (t.projectId) {
              setDestination('shared');
              setSelectedProjectId(t.projectId);
            } else {
              setDestination('personal');
              setSelectedProjectId(null);
            }

            const cat = allCategories.find(c => c.id === t.categoryId);
            if (cat) setSelectedCategory(cat);
          }
        } catch (error) {
          console.error('Error fetching transaction:', error);
        } finally {
          setInitialLoading(false);
        }
      };
      if (allCategories.length > 0) {
        fetchTransaction();
      }
    } else {
      if (categories.length > 0 && !selectedCategory) {
        setSelectedCategory(categories[0]);
      }
    }
  }, [id, allCategories]);

  const selectedCard = useMemo(() => {
    return cards.find(c => c.id === selectedCardId) || null;
  }, [cards, selectedCardId]);

  // Auto-select first card if user has cards and none is selected yet
  useEffect(() => {
    if (!id && !selectedCardId && cards.length > 0) {
      setSelectedCardId(cards[0].id);
    }
  }, [cards, id, selectedCardId]);

  // Automatically update statement due date when date or selectedCard changes (new expenses only)
  useEffect(() => {
    if (!id) {
      setFirstDueDate(computeDefaultFirstDueDate(date, selectedCard));
    }
  }, [date, selectedCard, id]);

  const fromProject = fromProjectId === 'personal' ? null : projects.find(p => p.id === fromProjectId);
  const toProject = toProjectId === 'personal' ? null : projects.find(p => p.id === toProjectId);

  const fromCurrency = fromProject?.currency || profile?.currency || 'ARS';
  const toCurrency = toProject?.currency || profile?.currency || 'ARS';
  const isCurrencyExchange = fromCurrency !== toCurrency;

  const handleTypeChange = (newType: 'expense' | 'income' | 'transfer') => {
    setType(newType);
    if (newType !== 'transfer') {
      const firstCat = allCategories.find(c => c.type === newType);
      setSelectedCategory(firstCat || null);
    } else {
      if (!toProjectId) {
        const usdProj = visibleProjects.find(p => p.currency === 'USD');
        if (usdProj && fromProjectId !== usdProj.id) {
          setToProjectId(usdProj.id);
        } else if (visibleProjects.length > 0) {
          const firstOther = visibleProjects.find(p => p.id !== fromProjectId);
          setToProjectId(firstOther ? firstOther.id : 'personal');
        }
      }
    }
  };

  const formatDateDisplay = (dateStr: string) => {
    return formatDisplayDate(dateStr);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const oldVal = input.value;
    const oldCursor = input.selectionStart || oldVal.length;
    const charsFromRight = oldVal.length - oldCursor;

    const { display } = formatCurrencyInput(oldVal);
    setAmount(display);

    if (type === 'transfer') {
      const fromVal = parseFormattedAmount(display);
      if (!isCurrencyExchange) {
        setToAmount(display);
      } else {
        const rate = parseFloat(exchangeRateInput.replace(',', '.'));
        if (rate > 0 && fromVal > 0) {
          const calculatedTo = fromCurrency === 'USD' ? fromVal * rate : fromVal / rate;
          setToAmount(formatAmountForDisplay(Math.round(calculatedTo * 100) / 100));
        }
      }
    }

    requestAnimationFrame(() => {
      if (input && document.activeElement === input) {
        const newCursor = Math.max(0, display.length - charsFromRight);
        input.setSelectionRange(newCursor, newCursor);
      }
    });
  };

  const handleToAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const oldVal = input.value;
    const oldCursor = input.selectionStart || oldVal.length;
    const charsFromRight = oldVal.length - oldCursor;

    const { display } = formatCurrencyInput(oldVal);
    setToAmount(display);

    const toVal = parseFormattedAmount(display);
    const fromVal = parseFormattedAmount(amount);
    if (fromVal > 0 && toVal > 0 && isCurrencyExchange) {
      const derivedRate = fromCurrency === 'USD' ? toVal / fromVal : fromVal / toVal;
      setExchangeRateInput(derivedRate.toFixed(2));
    }

    requestAnimationFrame(() => {
      if (input && document.activeElement === input) {
        const newCursor = Math.max(0, display.length - charsFromRight);
        input.setSelectionRange(newCursor, newCursor);
      }
    });
  };

  const handleExchangeRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setExchangeRateInput(val);
    const rate = parseFloat(val.replace(',', '.'));
    const fromVal = parseFormattedAmount(amount);
    if (rate > 0 && fromVal > 0) {
      const calculatedTo = fromCurrency === 'USD' ? fromVal * rate : fromVal / rate;
      setToAmount(formatAmountForDisplay(Math.round(calculatedTo * 100) / 100));
    }
  };

  const handleSwapAccounts = () => {
    const prevFrom = fromProjectId;
    const prevTo = toProjectId;
    setFromProjectId(prevTo || 'personal');
    setToProjectId(prevFrom || 'personal');
    const prevAmt = amount;
    const prevToAmt = toAmount;
    setAmount(prevToAmt);
    setToAmount(prevAmt);
  };

  const parsedAmount = parseFormattedAmount(amount);
  const parsedToAmount = parseFormattedAmount(toAmount);
  const isValidAmount = Boolean(amount && !isNaN(parsedAmount) && parsedAmount > 0);

  const activeCurrency = destination === 'shared' 
    ? (projects.find(p => p.id === selectedProjectId)?.currency || 'ARS') 
    : (profile?.currency || 'ARS');

  const parsedInstallments = Math.max(1, typeof installments === 'number' ? installments : (parseInt(String(installments), 10) || 1));

  const currentTotalAmount = calcMode === 'total' 
    ? parsedAmount 
    : parsedAmount * parsedInstallments;
  const currentInstallmentAmount = calcMode === 'total' 
    ? (parsedInstallments > 0 ? Math.round((parsedAmount / parsedInstallments) * 100) / 100 : parsedAmount) 
    : parsedAmount;

  const handleSave = async () => {
    if (type === 'transfer') {
      if (!parsedAmount || parsedAmount <= 0) {
        alert('Por favor ingresa un monto válido a transferir');
        return;
      }
      if (!toProjectId) {
        alert('Por favor selecciona la cuenta o proyecto de destino');
        return;
      }
      if (fromProjectId === toProjectId) {
        alert('La cuenta de origen y destino deben ser distintas');
        return;
      }

      const finalToAmount = isCurrencyExchange 
        ? (parseFormattedAmount(toAmount) || 0) 
        : parsedAmount;

      if (!finalToAmount || finalToAmount <= 0) {
        alert('Por favor ingresa el monto a recibir');
        return;
      }

      setIsSaving(true);
      try {
        const rate = isCurrencyExchange
          ? (fromCurrency === 'USD' ? finalToAmount / parsedAmount : parsedAmount / finalToAmount)
          : 1;

        await createTransfer({
          userId: user!.uid,
          authorName: user!.displayName || user!.email?.split('@')[0] || 'Usuario',
          fromProjectId: fromProjectId === 'personal' ? null : fromProjectId,
          toProjectId: toProjectId === 'personal' ? null : toProjectId,
          fromProjectName: fromProject?.name || 'Personal',
          toProjectName: toProject?.name || 'Personal',
          fromAmount: parsedAmount,
          toAmount: finalToAmount,
          fromCurrency,
          toCurrency,
          exchangeRate: rate,
          date,
          description: description.trim()
        });

        trackEvent('add_transfer', {
          fromCurrency,
          toCurrency,
          fromAmount: parsedAmount,
          toAmount: finalToAmount,
          isCurrencyExchange
        });

        navigate(-1);
      } catch (error) {
        console.error('Error saving transfer:', error);
        alert('Error al guardar la transferencia');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!isValidAmount || !selectedCategory) return;
    if (destination === 'shared' && !selectedProjectId) {
      alert('Por favor selecciona un proyecto compartido');
      return;
    }
    
    setIsSaving(true);
    try {
      const cardName = selectedCard 
        ? selectedCard.name 
        : (customCardName.trim() || (paymentMethod === 'Tarjeta de Crédito' ? 'Tarjeta de Crédito' : null));
      const cardId = selectedCard?.id || null;

      // Handle installment expense creation (new expenses with > 1 installments)
      if (!id && type === 'expense' && paymentMethod === 'Tarjeta de Crédito' && parsedInstallments > 1) {
        await createInstallmentExpense({
          totalAmount: currentTotalAmount,
          installmentAmount: currentInstallmentAmount,
          installments: parsedInstallments,
          description: description.trim() || `Compra con ${cardName || 'Tarjeta'}`,
          categoryId: selectedCategory.id,
          categoryName: selectedCategory.name,
          categoryIcon: selectedCategory.icon,
          categoryColor: selectedCategory.color,
          paymentMethod: 'Tarjeta de Crédito',
          classification,
          cardId,
          cardName,
          projectId: destination === 'shared' ? selectedProjectId : null,
          firstDueDate: firstDueDate || date,
          purchaseDate: date
        });
        trackEvent('add_installment_expense', { installments: parsedInstallments, totalAmount: currentTotalAmount });
        navigate(-1);
        return;
      }

      // Regular single transaction (or update)
      const isCreditCard = paymentMethod === 'Tarjeta de Crédito';
      const transactionDate = isCreditCard 
        ? (imputationMode === 'current_month' ? date : (firstDueDate || date))
        : date;

      const transactionData = {
        amount: parsedAmount,
        type,
        description,
        date: transactionDate,
        purchaseDate: date,
        paymentMethod,
        classification,
        categoryId: selectedCategory.id,
        categoryName: selectedCategory.name,
        categoryIcon: selectedCategory.icon,
        categoryColor: selectedCategory.color,
        projectId: destination === 'shared' ? selectedProjectId : null,
        cardId: isCreditCard ? cardId : null,
        cardName: isCreditCard ? cardName : null,
        isInstallment: isCreditCard,
        installmentNumber: isCreditCard ? 1 : null,
        totalInstallments: isCreditCard ? 1 : null,
        firstDueDate: isCreditCard ? (firstDueDate || date) : null,
        originalDate: originalDate // Pass original date to preserve time during update
      };

      if (id) {
        await updateTransaction(id, transactionData);
        trackEvent('edit_expense', { type, amount: parsedAmount, category: selectedCategory.name });
      } else {
        await addTransaction(transactionData);
        trackEvent('add_expense', { type, amount: parsedAmount, category: selectedCategory.name });
      }
      navigate(-1);
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Error al guardar la transacción');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmMsg = isExistingTransfer
      ? '¿Estás seguro de que deseas eliminar esta transferencia? Se eliminarán automáticamente los movimientos de ambas cuentas.'
      : isExistingInstallment 
        ? `¿Estás seguro de que deseas eliminar esta cuota individual (${existingInstallmentNumber}/${existingTotalInstallments})?`
        : '¿Estás seguro de que deseas eliminar esta transacción?';
    if (!id || !window.confirm(confirmMsg)) return;
    
    setIsDeleting(true);
    try {
      await deleteTransaction(id);
      navigate(-1);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Error al eliminar la transacción');
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  if (dataLoading || initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col pb-10">
      {/* Header (Fixed with blur and safe area) */}
      <header className="fixed top-0 w-full z-40 glass-header pt-safe-top bg-surface/90 backdrop-blur-xl border-b border-on-surface/5">
        <div className="flex items-center justify-between px-4 sm:px-6 h-16 max-w-2xl mx-auto w-full">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button 
              onClick={() => navigate(-1)} 
              className="text-on-surface p-2 hover:bg-on-surface/5 rounded-full transition-colors active:scale-90 flex items-center justify-center shrink-0"
              title="Volver atrás"
            >
              <ArrowLeft size={22} />
            </button>
            <span className="text-lg sm:text-xl font-extrabold tracking-tight text-on-surface font-headline truncate">
              {id ? 'Editar Transacción' : 'Nueva Transacción'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Cancel Button */}
            <button
              onClick={() => navigate(-1)}
              className="text-xs font-bold text-on-surface-variant/70 hover:text-on-surface px-3 py-1.5 rounded-xl hover:bg-on-surface/5 transition-colors uppercase tracking-wider"
              title="Descartar cambios y salir"
            >
              Cancelar
            </button>

            {id && isAuthor && (
              <button 
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-2 text-rose-600 hover:bg-rose-500/10 rounded-full transition-colors active:scale-90"
                title="Eliminar transacción"
              >
                {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
              </button>
            )}

            {isAuthor && (
              <button 
                onClick={handleSave} 
                disabled={!isValidAmount || isSaving}
                className={cn(
                  "font-bold text-xs sm:text-sm px-3.5 sm:px-4 py-2 rounded-xl transition-all active:scale-95 flex items-center gap-1.5 shadow-sm",
                  (!isValidAmount || isSaving) 
                    ? "text-on-surface-variant/30 bg-on-surface/5 cursor-not-allowed shadow-none" 
                    : "text-white bg-primary hover:bg-primary/90 shadow-primary/20"
                )}
              >
                {isSaving && <Loader2 size={14} className="animate-spin" />}
                {id ? 'Actualizar' : 'Guardar'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 pt-[calc(4.5rem+env(safe-area-inset-top,0px))] max-w-2xl mx-auto w-full px-6 flex flex-col gap-8">
        {!isAuthor && (
          <div className="bg-amber-500/10 border border-amber-500/10 p-4 rounded-2xl flex items-center gap-3 text-amber-700">
            <ShieldCheck size={20} />
            <p className="text-sm font-bold leading-tight">Solo el autor puede modificar esta transacción.</p>
          </div>
        )}

        {isExistingTransfer && (
          <div className="bg-cyan-500/10 border border-cyan-500/20 p-5 rounded-2xl flex items-start gap-3 text-cyan-900 dark:text-cyan-200">
            <ArrowLeftRight size={22} className="shrink-0 mt-0.5 text-cyan-600 dark:text-cyan-400" />
            <div className="text-xs space-y-1">
              <p className="font-black text-sm">Transferencia Vinculada ({existingTransferDirection === 'out' ? 'Salida' : 'Entrada'})</p>
              <p className="font-medium text-on-surface-variant">
                {existingTransferDirection === 'out' ? 'Hacia' : 'Desde'}: <strong className="text-on-surface">{existingRelatedProjectName}</strong> ({existingRelatedCurrency})
              </p>
              {existingExchangeRate && (
                <p className="font-semibold text-cyan-700 dark:text-cyan-300">
                  Tipo de cambio: 1 USD = ${formatCurrency(existingExchangeRate, 'ARS')}
                </p>
              )}
              <p className="text-[11px] text-on-surface-variant/70 italic pt-1">
                Para mantener la simetría contable entre cuentas, si deseas modificar los importes por favor elimina la operación y vuelve a registrarla.
              </p>
            </div>
          </div>
        )}

        {isExistingInstallment && (
          <div className="bg-primary/10 border border-primary/20 p-4 rounded-2xl flex items-center gap-3 text-primary">
            <Layers size={22} className="shrink-0" />
            <div className="text-xs">
              <p className="font-black text-sm">Cuota {existingInstallmentNumber} de {existingTotalInstallments}</p>
              <p className="text-on-surface-variant font-medium">Esta transacción pertenece a un plan en cuotas. Los cambios aplicarán únicamente a esta cuota mensual.</p>
            </div>
          </div>
        )}

        {/* Type Toggle: Gasto | Ingreso | Cambio / Transferencia */}
        <div className={cn("grid grid-cols-3 bg-surface-container-low p-1.5 rounded-2xl border border-on-surface/5 gap-1", (!isAuthor || !!id) && "pointer-events-none opacity-60")}>
          <button 
            type="button"
            onClick={() => handleTypeChange('expense')}
            className={cn(
              "py-3 px-2 rounded-[14px] text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider",
              type === 'expense' ? "bg-surface-container-lowest text-rose-600 shadow-sm" : "text-on-surface-variant/50"
            )}
          >
            <div className={cn("w-2 h-2 rounded-full shrink-0", type === 'expense' ? "bg-rose-600" : "bg-on-surface-variant/20")} />
            <span>Gasto</span>
          </button>
          <button 
            type="button"
            onClick={() => handleTypeChange('income')}
            className={cn(
              "py-3 px-2 rounded-[14px] text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider",
              type === 'income' ? "bg-surface-container-lowest text-emerald-600 shadow-sm" : "text-on-surface-variant/50"
            )}
          >
            <div className={cn("w-2 h-2 rounded-full shrink-0", type === 'income' ? "bg-emerald-600" : "bg-on-surface-variant/20")} />
            <span>Ingreso</span>
          </button>
          <button 
            type="button"
            onClick={() => handleTypeChange('transfer')}
            className={cn(
              "py-3 px-2 rounded-[14px] text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider",
              type === 'transfer' ? "bg-surface-container-lowest text-cyan-600 dark:text-cyan-400 shadow-sm" : "text-on-surface-variant/50"
            )}
          >
            <ArrowLeftRight size={14} className={cn("shrink-0", type === 'transfer' ? "text-cyan-600 dark:text-cyan-400" : "text-on-surface-variant/40")} />
            <span>Cambio</span>
          </button>
        </div>

        {type === 'transfer' ? (
          <div className="space-y-6">
            {/* Account Selector (From -> To) */}
            <div className="bg-surface-container-lowest p-6 rounded-[2rem] border border-on-surface/5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/70">
                  Cuentas Involucradas
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full">
                  {isCurrencyExchange ? 'Cambio de Divisas' : 'Transferencia Interna'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-3 items-center">
                {/* Source Account */}
                <div className="bg-surface-container-low p-4 rounded-2xl border border-on-surface/5">
                  <label className="block text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-wider mb-2">
                    Origen (Sale dinero)
                  </label>
                  <select
                    value={fromProjectId}
                    onChange={(e) => setFromProjectId(e.target.value)}
                    className="w-full bg-surface-container-lowest font-black text-sm text-on-surface rounded-xl p-3 border border-on-surface/10 focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="personal">Personal ({profile?.currency || 'ARS'})</option>
                    {visibleProjects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.currency || 'ARS'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Swap button */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleSwapAccounts}
                    className="p-3 bg-surface-container-low hover:bg-cyan-500/10 hover:text-cyan-600 rounded-2xl transition-all border border-on-surface/5 active:scale-95 text-on-surface-variant"
                    title="Intercambiar cuentas origen y destino"
                  >
                    <ArrowLeftRight size={18} />
                  </button>
                </div>

                {/* Destination Account */}
                <div className="bg-surface-container-low p-4 rounded-2xl border border-on-surface/5">
                  <label className="block text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-wider mb-2">
                    Destino (Entra dinero)
                  </label>
                  <select
                    value={toProjectId}
                    onChange={(e) => setToProjectId(e.target.value)}
                    className="w-full bg-surface-container-lowest font-black text-sm text-on-surface rounded-xl p-3 border border-on-surface/10 focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="" disabled>Seleccionar destino...</option>
                    <option value="personal">Personal ({profile?.currency || 'ARS'})</option>
                    {visibleProjects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.currency || 'ARS'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Amount Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Source Amount */}
              <div className="bg-surface-container-lowest p-6 rounded-[2rem] border border-on-surface/5 shadow-sm text-center">
                <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.2em] mb-2">
                  Monto a Enviar (Salida)
                </p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-black text-rose-600/70">{fromCurrency}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder="0,00"
                    className="w-full max-w-[220px] bg-transparent border-none p-0 focus:ring-0 text-4xl sm:text-5xl font-black tracking-tight text-center placeholder:text-on-surface-variant/10 text-on-surface"
                    autoFocus
                  />
                </div>
              </div>

              {/* Destination Amount */}
              <div className="bg-surface-container-lowest p-6 rounded-[2rem] border border-on-surface/5 shadow-sm text-center">
                <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.2em] mb-2">
                  Monto a Recibir (Entrada)
                </p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-black text-emerald-600/70">{toCurrency}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={toAmount}
                    onChange={handleToAmountChange}
                    disabled={!isCurrencyExchange}
                    placeholder="0,00"
                    className={cn(
                      "w-full max-w-[220px] bg-transparent border-none p-0 focus:ring-0 text-4xl sm:text-5xl font-black tracking-tight text-center placeholder:text-on-surface-variant/10 text-emerald-600 dark:text-emerald-400",
                      !isCurrencyExchange && "opacity-75"
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Exchange Rate Box (Only for different currencies) */}
            {isCurrencyExchange && (
              <div className="bg-gradient-to-br from-cyan-500/10 via-sky-500/5 to-transparent p-6 rounded-[2rem] border border-cyan-500/20 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-cyan-800 dark:text-cyan-200 mb-1">
                      Cotización / Tipo de Cambio
                    </label>
                    <p className="text-xs text-on-surface-variant font-medium">
                      Define o edita la cotización para calcular automáticamente los importes.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-surface-container-lowest px-4 py-2.5 rounded-2xl border border-cyan-500/20 shadow-sm shrink-0">
                    <span className="text-xs font-black text-on-surface-variant">1 USD = $</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={exchangeRateInput}
                      onChange={handleExchangeRateChange}
                      placeholder="1.200"
                      className="w-24 bg-transparent border-none p-0 text-base font-black text-cyan-600 dark:text-cyan-400 focus:ring-0 text-right"
                    />
                    <span className="text-xs font-bold text-on-surface-variant">ARS</span>
                  </div>
                </div>
              </div>
            )}

            {/* Date & Note Form Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date */}
              <div 
                onClick={(e) => {
                  const input = e.currentTarget.querySelector('input');
                  if (input && 'showPicker' in input) {
                    (input as any).showPicker();
                  } else if (input) {
                    input.click();
                  }
                }}
                className="relative bg-surface-container-lowest p-6 rounded-3xl border border-on-surface/5 shadow-sm flex items-center justify-between group cursor-pointer hover:bg-on-surface/5 transition-colors overflow-hidden"
              >
                <input 
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/70 mb-2">Fecha</label>
                  <div className="flex items-center gap-3 text-on-surface font-extrabold">
                    <Calendar size={20} className="text-primary" />
                    <span>{formatDateDisplay(date)}</span>
                  </div>
                </div>
                <ChevronRight size={20} className="text-on-surface-variant/40" />
              </div>

              {/* Note / Description */}
              <div className="bg-surface-container-lowest p-6 rounded-3xl border border-on-surface/5 shadow-sm">
                <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/70 mb-2">Nota / Concepto (Opcional)</label>
                <input 
                  className="w-full bg-transparent border-none p-0 focus:ring-0 text-base font-bold placeholder:text-on-surface-variant/30 text-on-surface"
                  placeholder={isCurrencyExchange ? "Ej: Compra Dólar MEP / Ahorro" : "Ej: Transferencia entre cuentas"}
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Confirm Transfer Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={!parsedAmount || parsedAmount <= 0 || isSaving}
              className={cn(
                "w-full py-6 rounded-[2rem] font-black text-xl shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3",
                (!parsedAmount || parsedAmount <= 0 || isSaving)
                  ? "bg-on-surface/5 text-on-surface-variant/20 cursor-not-allowed"
                  : "bg-cyan-600 text-white shadow-cyan-600/20 hover:bg-cyan-700"
              )}
            >
              {isSaving ? 'Registrando transferencia...' : isCurrencyExchange ? 'Confirmar Compra de Divisas' : 'Confirmar Transferencia'}
              {!isSaving && <ArrowLeftRight size={22} strokeWidth={2.5} />}
              {isSaving && <Loader2 size={24} className="animate-spin" />}
            </button>
          </div>
        ) : (
          <>

        {/* Amount Input Section */}
        <section className="text-center py-4">
          <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] mb-4">
            Importe de la {type === 'expense' ? 'Salida' : 'Entrada'}
          </p>
          <div className={cn("flex items-center justify-center gap-2", !isAuthor && "pointer-events-none")}>
            <span className={cn(
              "text-3xl sm:text-4xl font-black font-headline opacity-40",
              type === 'expense' ? "text-rose-600" : "text-emerald-600"
            )}>{destination === 'shared' ? projects.find(p => p.id === selectedProjectId)?.currency || 'ARS' : (profile?.currency || 'ARS')}</span>
            <input 
              type="text"
              inputMode="decimal"
              readOnly={!isAuthor}
              value={amount}
              onChange={handleAmountChange}
              placeholder="0,00"
              className={cn(
                "w-full max-w-[340px] bg-transparent border-none p-0 focus:ring-0 text-5xl sm:text-7xl font-black tracking-tighter font-headline text-center placeholder:text-on-surface-variant/10 transition-all",
                type === 'expense' ? "text-on-surface" : "text-emerald-600 dark:text-emerald-400"
              )}
              autoFocus={isAuthor}
            />
          </div>
        </section>

        {/* Form Sections */}
        <div className="space-y-4">
          {/* Description */}
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-on-surface/5 shadow-sm">
            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/70 mb-3">Descripción</label>
            <input 
              readOnly={!isAuthor}
              className="w-full bg-transparent border-none p-0 focus:ring-0 text-xl font-bold placeholder:text-on-surface-variant/30 text-on-surface"
              placeholder={type === 'expense' ? "¿En qué gastaste?" : "¿De dónde viene el dinero?"}
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date Selector */}
            <div 
              onClick={(e) => {
                const input = e.currentTarget.querySelector('input');
                if (input && 'showPicker' in input) {
                  (input as any).showPicker();
                } else if (input) {
                  input.click();
                }
              }}
              className="relative bg-surface-container-lowest p-6 rounded-3xl border border-on-surface/5 shadow-sm flex items-center justify-between group cursor-pointer hover:bg-on-surface/5 transition-colors overflow-hidden"
            >
              <input 
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/70 mb-2">Fecha</label>
                <div className="flex items-center gap-3 text-on-surface font-extrabold">
                  <Calendar size={20} className="text-primary" />
                  <span>{formatDateDisplay(date)}</span>
                </div>
              </div>
              <ChevronRight size={20} className="text-on-surface-variant/40" />
            </div>

            <button 
              type="button"
              disabled={!isAuthor}
              onClick={() => setShowCategorySheet(true)}
              className={cn(
                "bg-surface-container-lowest p-6 rounded-3xl border border-on-surface/5 shadow-sm flex items-center justify-between group transition-colors text-left",
                isAuthor ? "hover:bg-on-surface/5 cursor-pointer" : "opacity-60 cursor-default"
              )}
            >
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/70 mb-2">Categoría</label>
                <div className="flex items-center gap-3 text-on-surface font-extrabold">
                  {selectedCategory ? (
                    <>
                      <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm",
                        selectedCategory.color
                      )}>
                        <IconComponent name={selectedCategory.icon} size={18} />
                      </div>
                      <span>{selectedCategory.name}</span>
                    </>
                  ) : (
                    <span className="text-on-surface-variant/40">Seleccionar...</span>
                  )}
                </div>
              </div>
              {isAuthor && <ChevronDown size={20} className="text-on-surface-variant/40" />}
            </button>
          </div>

          {/* Destination Selector */}
          <div className={cn("bg-surface-container-low p-6 rounded-[2rem] border border-on-surface/5", !isAuthor && "pointer-events-none opacity-60")}>
            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/70 mb-4">
              {type === 'expense' ? 'Destino de los fondos' : 'Origen de los fondos'}
            </label>
            <div className="flex bg-on-surface/5 p-1.5 rounded-2xl">
              {isPersonalVisible && (
                <button 
                  onClick={() => setDestination('personal')}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-[14px] text-xs font-black transition-all uppercase tracking-wider",
                    destination === 'personal' ? "bg-surface-container-lowest text-on-surface shadow-sm" : "text-on-surface-variant/70 hover:text-on-surface"
                  )}
                >
                  Personal
                </button>
              )}
              {visibleProjects.length > 0 && (
                <button 
                  onClick={() => {
                    setDestination('shared');
                    if (!selectedProjectId && visibleProjects.length > 0) {
                      setSelectedProjectId(visibleProjects[0].id);
                    }
                  }}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-[14px] text-xs font-black transition-all uppercase tracking-wider",
                    destination === 'shared' ? "bg-surface-container-lowest text-on-surface shadow-sm" : "text-on-surface-variant/70 hover:text-on-surface"
                  )}
                >
                  Compartido
                </button>
              )}
            </div>

            <AnimatePresence>
              {destination === 'shared' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div 
                    onClick={() => setShowProjectSheet(true)}
                    className="mt-4 flex items-center justify-between p-5 bg-surface-container-lowest rounded-2xl border border-on-surface/5 shadow-sm cursor-pointer hover:bg-on-surface/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {selectedProject ? (
                        <>
                          <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                            <IconComponent name={selectedProject.icon} size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-extrabold text-on-surface">{selectedProject.name}</p>
                            <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-wider">
                              {selectedProject.memberIds.length} colaboradores
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-3 text-on-surface-variant/40">
                          <Briefcase size={20} />
                          <span className="text-sm font-bold">Seleccionar Proyecto...</span>
                        </div>
                      )}
                    </div>
                    <ChevronDown size={18} className="text-on-surface-variant/20" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Payment Method Selector */}
          <div className={cn("bg-surface-container-low p-6 rounded-[2rem] border border-on-surface/5 shadow-sm space-y-4", !isAuthor && "pointer-events-none opacity-60")}>
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/70">
                Método de Pago
              </label>
              {paymentMethod === 'Tarjeta de Crédito' && (
                <Link 
                  to="/cards" 
                  className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <CreditCard size={13} />
                  <span>Mis Tarjetas</span>
                </Link>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'Efectivo', label: 'Efectivo', icon: Wallet },
                { id: 'Débito', label: 'Débito', icon: Landmark },
                { id: 'Tarjeta de Crédito', label: 'Crédito', icon: CreditCard }
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={cn(
                      "py-3.5 px-2 rounded-2xl font-black text-xs transition-all uppercase tracking-wider flex flex-col sm:flex-row items-center justify-center gap-2 border-2",
                      isSelected 
                        ? "bg-primary/10 border-primary text-primary shadow-inner" 
                        : "bg-surface-container-lowest border-transparent text-on-surface-variant/70 hover:bg-on-surface/5 hover:text-on-surface"
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-xl flex items-center justify-center shrink-0",
                      isSelected ? "bg-primary text-white" : "bg-on-surface-variant/10 text-on-surface-variant/70"
                    )}>
                      <Icon size={14} />
                    </div>
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Credit Card options if Tarjeta de Crédito and expense */}
            {paymentMethod === 'Tarjeta de Crédito' && type === 'expense' && (
              <div className="mt-4 pt-4 border-t border-on-surface/10 space-y-4">
                {/* Card Selector */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/70 mb-2">
                    Tarjeta Utilizada
                  </label>
                  {cards.length > 0 ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {cards.map((c) => {
                          const isSelected = selectedCardId === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedCardId(c.id);
                                setCustomCardName('');
                              }}
                              className={cn(
                                "p-3 rounded-2xl text-left border-2 transition-all flex items-center justify-between",
                                isSelected 
                                  ? "border-primary bg-primary/5 text-on-surface shadow-sm ring-1 ring-primary/20" 
                                  : "border-on-surface/5 bg-surface-container-lowest text-on-surface hover:border-on-surface/20"
                              )}
                            >
                              <div className="flex items-center gap-2.5 overflow-hidden">
                                <div className={`w-8 h-6 rounded-lg ${c.color || 'bg-slate-800'} text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-sm`}>
                                  <CreditCard size={13} />
                                </div>
                                <div className="truncate">
                                  <p className="text-xs font-black truncate">{c.name}</p>
                                  <p className="text-[10px] text-on-surface-variant/70 font-mono">
                                    {c.bank ? `${c.bank} ` : ''}{c.last4Digits ? `•••• ${c.last4Digits}` : ''}
                                  </p>
                                </div>
                              </div>
                              {isSelected && <Check size={16} className="text-primary shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                      
                      {/* Option to type custom or unselect */}
                      <button
                        type="button"
                        onClick={() => setSelectedCardId(null)}
                        className={cn(
                          "w-full py-2 px-3 rounded-xl text-left text-xs font-bold transition-colors flex items-center justify-between border",
                          selectedCardId === null
                            ? "border-primary/40 bg-primary/5 text-primary"
                            : "border-dashed border-on-surface/15 text-on-surface-variant hover:text-on-surface"
                        )}
                      >
                        <span>Otra tarjeta / Sin registrar</span>
                        {selectedCardId === null && <Check size={14} />}
                      </button>
                    </div>
                  ) : (
                    <div className="bg-surface-container-lowest p-3 rounded-2xl border border-on-surface/5 space-y-2">
                      <input
                        type="text"
                        placeholder="Ej: Visa Santander, Amex (opcional)"
                        value={customCardName}
                        onChange={(e) => setCustomCardName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-on-surface/10 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                        <span>¿Tenés fechas fijas de cierre?</span>
                        <Link to="/cards" className="text-primary font-bold hover:underline flex items-center gap-1">
                          <Plus size={12} />
                          <span>Crear tarjeta</span>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* Installment Selector (Only when creating new transaction) */}
                {!id && (
                  <div className="space-y-3 pt-2">
                    <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/70">
                      Cantidad de Cuotas
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[1, 3, 6, 12, 18, 24].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => {
                            setInstallments(num);
                            setIsCustomInstallments(false);
                          }}
                          className={cn(
                            "px-3.5 py-2 rounded-xl text-xs font-black transition-all",
                            parsedInstallments === num && !isCustomInstallments
                              ? "bg-primary text-on-primary shadow-sm"
                              : "bg-surface-container-lowest border border-on-surface/5 text-on-surface-variant hover:text-on-surface"
                          )}
                        >
                          {num === 1 ? '1 pago' : `${num} cuotas`}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomInstallments(true);
                          setInstallments('');
                        }}
                        className={cn(
                          "px-3.5 py-2 rounded-xl text-xs font-black transition-all",
                          isCustomInstallments
                            ? "bg-primary text-on-primary shadow-sm"
                            : "bg-surface-container-lowest border border-on-surface/5 text-on-surface-variant hover:text-on-surface"
                        )}
                      >
                        Otro...
                      </button>
                    </div>

                    {isCustomInstallments && (
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs font-bold text-on-surface-variant">Cantidad:</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="2"
                          value={installments}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            if (val === '') {
                              setInstallments('');
                            } else {
                              const num = parseInt(val, 10);
                              setInstallments(Math.min(72, num));
                            }
                          }}
                          onBlur={() => {
                            if (installments === '' || Number(installments) < 1) {
                              setInstallments(2);
                            }
                          }}
                          autoFocus
                          className="w-24 px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-on-surface/10 text-center font-black text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                        <span className="text-xs font-medium text-on-surface-variant">cuotas</span>
                      </div>
                    )}

                    {/* If installments > 1: Calculation Mode & Preview */}
                    {parsedInstallments > 1 && (
                      <div className="mt-4 p-4 rounded-2xl bg-surface-container-lowest border border-on-surface/10 space-y-3">
                        {/* Calc Mode Toggle */}
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/70 block mb-1.5">
                            Modo de cálculo
                          </span>
                          <div className="flex bg-surface-container-low p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => setCalcMode('total')}
                              className={cn(
                                "flex-1 py-1.5 px-2 rounded-lg text-xs font-black transition-all",
                                calcMode === 'total' 
                                  ? "bg-surface-container-lowest text-primary shadow-sm" 
                                  : "text-on-surface-variant/70 hover:text-on-surface"
                              )}
                            >
                              Monto Total
                            </button>
                            <button
                              type="button"
                              onClick={() => setCalcMode('installment')}
                              className={cn(
                                "flex-1 py-1.5 px-2 rounded-lg text-xs font-black transition-all",
                                calcMode === 'installment' 
                                  ? "bg-surface-container-lowest text-primary shadow-sm" 
                                  : "text-on-surface-variant/70 hover:text-on-surface"
                              )}
                            >
                              Monto x Cuota
                            </button>
                          </div>
                        </div>

                        {/* Live Breakdown */}
                        <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-on-surface-variant font-medium">Impacto mensual:</span>
                            <span className="font-black text-primary text-sm">
                              {parsedInstallments}x {formatCurrency(currentInstallmentAmount, activeCurrency)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-primary/10">
                            <span className="text-on-surface-variant font-medium">Total financiado:</span>
                            <span className="font-extrabold text-on-surface">
                              {formatCurrency(currentTotalAmount, activeCurrency)}
                            </span>
                          </div>
                        </div>

                        {/* Statement cycle / First Due Date */}
                        <div className="pt-1">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/70">
                              Fecha 1er Vencimiento / Resumen
                            </span>
                            {selectedCard?.closingDay && (
                              <span className="text-[10px] font-bold text-primary">
                                Cierre día {selectedCard.closingDay}
                              </span>
                            )}
                          </div>
                          <div className="relative">
                            <input
                              type="date"
                              value={firstDueDate}
                              onChange={(e) => setFirstDueDate(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-on-surface/10 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                          </div>
                          <p className="text-[10px] text-on-surface-variant/60 mt-1">
                            Se distribuirá 1 cuota por mes a partir de esta fecha en el historial y presupuesto.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* If installments === 1: Imputation mode toggle for 1-pago credit card */}
                    {parsedInstallments === 1 && (
                      <div className="mt-3 p-4 rounded-2xl bg-surface-container-lowest border border-on-surface/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/70">
                            Imputación Contable
                          </label>
                          {selectedCard?.closingDay && (
                            <span className="text-[10px] font-bold text-primary">
                              Cierre día {selectedCard.closingDay}
                            </span>
                          )}
                        </div>

                        {/* Segmented Button Selector */}
                        <div className="grid grid-cols-2 gap-2 bg-surface-container-low p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => setImputationMode('statement_cycle')}
                            className={cn(
                              "py-2.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 text-center",
                              imputationMode === 'statement_cycle'
                                ? "bg-surface-container-lowest text-primary shadow-sm border border-primary/20"
                                : "text-on-surface-variant/70 hover:text-on-surface border border-transparent"
                            )}
                          >
                            <CalendarCheck size={14} className={imputationMode === 'statement_cycle' ? 'text-primary' : 'text-on-surface-variant/50'} />
                            <span>Cierre de Tarjeta</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setImputationMode('current_month')}
                            className={cn(
                              "py-2.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 text-center",
                              imputationMode === 'current_month'
                                ? "bg-surface-container-lowest text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-500/30"
                                : "text-on-surface-variant/70 hover:text-on-surface border border-transparent"
                            )}
                          >
                            <Zap size={14} className={imputationMode === 'current_month' ? 'text-emerald-600 dark:text-emerald-400' : 'text-on-surface-variant/50'} />
                            <span>Mes en Curso</span>
                          </button>
                        </div>

                        {/* Conditional UI & Explanatory message based on imputationMode */}
                        {imputationMode === 'statement_cycle' ? (
                          <div className="space-y-2 pt-1 border-t border-on-surface/5">
                            <label className="block text-[10px] font-black uppercase tracking-wider text-on-surface-variant/70">
                              Fecha Vencimiento del Resumen
                            </label>
                            <input
                              type="date"
                              value={firstDueDate}
                              onChange={(e) => setFirstDueDate(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-on-surface/10 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/10 text-primary">
                              <Info size={15} className="shrink-0 mt-0.5" />
                              <p className="text-[11px] leading-relaxed">
                                <strong>Respeta el ciclo de la tarjeta:</strong> El gasto se computará en el balance e historial a partir del vencimiento del resumen (<strong>{firstDueDate ? formatMonthLabel(firstDueDate) : 'próximo vencimiento'}</strong>).
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="pt-1 border-t border-on-surface/5">
                            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                              <Zap size={15} className="shrink-0 mt-0.5" />
                              <p className="text-[11px] leading-relaxed">
                                <strong>Imputación inmediata:</strong> El gasto impactará directamente en el balance y presupuesto de <strong>este mes ({formatMonthLabel(date)})</strong> con la fecha de compra, sin esperar al cierre o vencimiento de la tarjeta.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Classification Selector (Fixed/Variable) */}
          <div className={cn("bg-surface-container-low p-6 rounded-[2rem] border border-on-surface/5 shadow-sm space-y-4", !isAuthor && "pointer-events-none opacity-60")}>
            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/70">
              Clasificación de Gasto
            </label>
            <div className="flex gap-3">
              {(['variable', 'fixed'] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setClassification(item)}
                  className={cn(
                    "flex-1 py-4 px-2 rounded-2xl font-black text-xs transition-all uppercase tracking-widest flex items-center justify-center gap-2 border-2",
                    classification === item 
                      ? "bg-primary/10 border-primary text-primary shadow-inner" 
                      : "bg-surface-container-lowest border-transparent text-on-surface-variant/70 hover:bg-on-surface/5 hover:text-on-surface"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-lg flex items-center justify-center",
                    classification === item ? "bg-primary text-white" : "bg-on-surface-variant/10 text-on-surface-variant/70"
                  )}>
                    {item === 'fixed' ? <Clock size={14} /> : <Zap size={14} />}
                  </div>
                  {item === 'fixed' ? 'Fijo' : 'Variable'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Confirm Button */}
        {isAuthor && (
          <button 
            onClick={handleSave}
            disabled={!amount || parseFloat(amount) <= 0 || isSaving}
            className={cn(
              "w-full py-6 rounded-[2rem] font-black text-xl shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3",
              (!amount || parseFloat(amount) <= 0 || isSaving)
                ? "bg-on-surface/5 text-on-surface-variant/20 cursor-not-allowed"
                : type === 'expense' 
                  ? "bg-on-surface text-surface-container-lowest shadow-on-surface/20" 
                  : "bg-emerald-600 text-white shadow-emerald-500/20"
            )}
          >
            {isSaving ? 'Guardando...' : id ? 'Actualizar Transacción' : `Confirmar ${type === 'expense' ? 'Gasto' : 'Ingreso'}`}
            {!isSaving && <Check size={24} strokeWidth={3} />}
            {isSaving && <Loader2 size={24} className="animate-spin" />}
          </button>
        )}
        </>
        )}

        {/* Delete Button (Only when editing and is Author) */}
        {id && isAuthor && (
          <button 
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || isSaving}
            className="w-full py-4 rounded-2xl font-bold text-rose-600 bg-rose-500/5 hover:bg-rose-500/10 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
            Eliminar Transacción
          </button>
        )}

        {/* Cancel / Discard Action */}
        <button 
          type="button"
          onClick={() => navigate(-1)}
          disabled={isSaving || isDeleting}
          className="w-full py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider text-on-surface-variant/70 hover:text-on-surface hover:bg-on-surface/5 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          Descartar y volver atrás
        </button>
      </main>

      {/* Category Selection Sheet */}
      <AnimatePresence>
        {showCategorySheet && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCategorySheet(false)}
              className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 w-full bg-surface-container-lowest rounded-t-[3rem] z-[70] p-8 shadow-[0_-8px_40px_rgba(0,0,0,0.1)] max-h-[80vh] overflow-y-auto"
            >
              <div className="w-12 h-1.5 bg-on-surface/10 rounded-full mx-auto mb-8" />
              <h3 className="text-2xl font-black text-on-surface font-headline tracking-tight mb-8 text-center">Seleccionar Categoría</h3>
              
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-6">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setShowCategorySheet(false);
                    }}
                    className="flex flex-col items-center gap-3 group"
                  >
                    <div className={cn(
                      "w-16 h-16 rounded-[22px] flex items-center justify-center text-white transition-all duration-300 group-active:scale-90 shadow-lg",
                      cat.color,
                      selectedCategory?.id === cat.id ? "ring-4 ring-on-surface/10" : "opacity-80 group-hover:opacity-100"
                    )}>
                      <IconComponent name={cat.icon} size={28} />
                    </div>
                    <span className={cn(
                      "text-xs font-bold tracking-tight transition-colors",
                      selectedCategory?.id === cat.id ? "text-on-surface" : "text-on-surface-variant/60"
                    )}>
                      {cat.name}
                    </span>
                  </button>
                ))}
              </div>

              {categories.length === 0 && (
                <div className="text-center py-10 px-6">
                  <p className="text-on-surface-variant font-bold mb-2">No hay categorías disponibles.</p>
                  <p className="text-xs text-on-surface-variant/40">Si acabas de empezar, estamos preparando el sistema para ti...</p>
                </div>
              )}

              <button 
                onClick={() => setShowCategorySheet(false)}
                className="w-full mt-10 py-5 bg-on-surface/5 rounded-2xl text-on-surface font-black text-sm uppercase tracking-widest hover:bg-on-surface/10 transition-colors"
              >
                Cancelar
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Project Selection Sheet */}
      <AnimatePresence>
        {showProjectSheet && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProjectSheet(false)}
              className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 w-full bg-surface-container-lowest rounded-t-[3rem] z-[70] p-8 shadow-[0_-8px_40px_rgba(0,0,0,0.1)] max-h-[80vh] overflow-y-auto"
            >
              <div className="w-12 h-1.5 bg-on-surface/10 rounded-full mx-auto mb-8" />
              <h3 className="text-2xl font-black text-on-surface font-headline tracking-tight mb-8 text-center">Seleccionar Proyecto</h3>
              
              <div className="space-y-3">
                {visibleProjects.map((proj) => (
                  <button
                    key={proj.id}
                    onClick={() => {
                      setSelectedProjectId(proj.id);
                      setShowProjectSheet(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all",
                      selectedProjectId === proj.id ? "bg-primary/5 border-primary/20" : "bg-surface-container-low border-on-surface/5 hover:bg-on-surface/5"
                    )}
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <IconComponent name={proj.icon} size={24} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-on-surface">{proj.name}</p>
                      <p className="text-xs text-on-surface-variant">{proj.memberIds.length} colaboradores</p>
                    </div>
                    {selectedProjectId === proj.id && <Check size={20} className="ml-auto text-primary" />}
                  </button>
                ))}
                
                {visibleProjects.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-on-surface-variant font-medium">No tienes proyectos compartidos visibles para selección.</p>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setShowProjectSheet(false)}
                className="w-full mt-10 py-5 bg-on-surface/5 rounded-2xl text-on-surface font-black text-sm uppercase tracking-widest hover:bg-on-surface/10 transition-colors"
              >
                Cancelar
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Decorative Background */}
      <div className="fixed -z-10 top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className={cn(
          "absolute -top-[10%] -right-[5%] w-[40%] h-[40%] blur-[120px] rounded-full transition-colors duration-700",
          type === 'expense' ? "bg-rose-500/5" : "bg-emerald-500/5"
        )}></div>
        <div className="absolute top-[60%] -left-[10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full"></div>
      </div>
    </div>
  );
};
