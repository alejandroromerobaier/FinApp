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
  Info
} from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { cn, formatCurrencyInput, formatAmountForDisplay, parseFormattedAmount, formatCurrency } from '../lib/utils';
import { haptic } from '../lib/haptics';
import { useToast } from '../context/ToastContext';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { 
  addTransaction, 
  updateTransaction, 
  deleteTransaction, 
  getTransaction,
  createInstallmentExpense,
  CreditCard as CreditCardType
} from '../services/firestoreService';
import { getLocalToday, getLocalYesterday, formatDisplayDate, formatLocalYYYYMMDD, parseLocalYYYYMMDD } from '../lib/dateUtils';
import { trackEvent } from '../lib/analytics';

const formatMonthLabel = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = parseLocalYYYYMMDD(dateStr);
  const formatted = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

import { getCategoryIcon } from '../lib/categoryIcons';
import { getProjectIcon, getProjectGradient } from '../lib/constants';
import { CustomDatePickerModal } from '../components/CustomDatePickerModal';

const IconComponent = ({ name, size = 20 }: { name: string, size?: number }) => {
  const Icon = getCategoryIcon(name);
  return <Icon size={size} />;
};

const ProjectIconComponent = ({ name, size = 20 }: { name?: string, size?: number }) => {
  const Icon = getProjectIcon(name);
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
  const { categories: allCategories, projects, cards, transactions, loading: dataLoading } = useData();
  const { toast } = useToast();
  const amountInputRef = React.useRef<HTMLInputElement>(null);
  
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [destination, setDestination] = useState<'personal' | 'shared'>('shared');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showProjectSheet, setShowProjectSheet] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFirstDueDatePicker, setShowFirstDueDatePicker] = useState(false);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getLocalToday());
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Débito' | 'Tarjeta de Crédito'>('Efectivo');
  const [classification, setClassification] = useState<'fixed' | 'variable'>('variable');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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

  const isAuthor = !id || authorId === user?.uid;

  const categories = allCategories.filter(c => c.type === type);

  const [hasInitializedDefault, setHasInitializedDefault] = useState(false);

  // Autofocus and select amount input on mount
  useEffect(() => {
    if (isAuthor && !initialLoading) {
      const timer = setTimeout(() => {
        if (amountInputRef.current) {
          amountInputRef.current.focus();
          amountInputRef.current.select();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [id, isAuthor, initialLoading]);

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

  const handleTypeChange = (newType: 'expense' | 'income') => {
    haptic.light();
    setType(newType);
    const firstCat = allCategories.find(c => c.type === newType);
    setSelectedCategory(firstCat || null);
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

    requestAnimationFrame(() => {
      if (input && document.activeElement === input) {
        const newCursor = Math.max(0, display.length - charsFromRight);
        input.setSelectionRange(newCursor, newCursor);
      }
    });
  };

  const parsedAmount = parseFormattedAmount(amount);
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

  const currencySymbol = useMemo(() => {
    if (activeCurrency === 'USD') return 'US$';
    if (activeCurrency === 'ARS') return '$';
    return activeCurrency;
  }, [activeCurrency]);

  const frequentCategories = useMemo(() => {
    if (!categories.length) return [];
    const counts: Record<string, number> = {};
    if (transactions && transactions.length > 0) {
      transactions.forEach(t => {
        if (t.type === type && t.categoryId) {
          counts[t.categoryId] = (counts[t.categoryId] || 0) + 1;
        }
      });
    }
    const sorted = [...categories].sort((a, b) => {
      const countA = counts[a.id] || 0;
      const countB = counts[b.id] || 0;
      return countB - countA;
    });
    return sorted.slice(0, 5);
  }, [categories, transactions, type]);

  const isToday = date === getLocalToday();
  const isYesterday = date === getLocalYesterday();
  const isCustomDate = !isToday && !isYesterday;

  const handleSave = async () => {
    if (!isValidAmount || !selectedCategory) return;
    if (destination === 'shared' && !selectedProjectId) {
      toast.warning('Por favor selecciona un proyecto compartido');
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
        haptic.success();
        toast.success(`Compra en ${parsedInstallments} cuotas registrada`);
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
        haptic.success();
        toast.success('Transacción actualizada');
      } else {
        await addTransaction(transactionData);
        trackEvent('add_expense', { type, amount: parsedAmount, category: selectedCategory.name });
        haptic.success();
        toast.success(type === 'income' ? 'Ingreso registrado con éxito' : 'Gasto registrado con éxito');
      }
      navigate(-1);
    } catch (error) {
      console.error('Error saving transaction:', error);
      toast.error('Error al guardar la transacción');
    } finally {
      setIsSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await deleteTransaction(id);
      haptic.medium();
      toast.info('Transacción eliminada con éxito');
      setShowDeleteModal(false);
      navigate(-1);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('Error al eliminar la transacción');
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
      {/* Header (Sticky, clean & minimal with safe-area support) */}
      <header className="sticky top-0 w-full z-40 glass-header bg-surface/95 backdrop-blur-xl border-b border-on-surface/5 pt-safe-top">
        <div className="flex items-center justify-between px-6 h-14 sm:h-16 max-w-2xl mx-auto w-full">
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-on-surface font-headline">
              {id ? 'Editar Transacción' : 'Nueva Transacción'}
            </h1>
            <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider">
              {destination === 'shared' ? 'Gasto Compartido' : 'Gasto Personal'}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 py-6 max-w-2xl mx-auto w-full px-6 flex flex-col gap-8 pb-32 sm:pb-36">
        {!isAuthor && (
          <div className="bg-amber-500/10 border border-amber-500/10 p-4 rounded-2xl flex items-center gap-3 text-amber-700">
            <ShieldCheck size={20} />
            <p className="text-sm font-bold leading-tight">Solo el autor puede modificar esta transacción.</p>
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

        {/* Type Toggle */}
        <div className={cn("flex bg-surface-container-low p-1.5 rounded-2xl border border-on-surface/5", !isAuthor && "pointer-events-none opacity-60")}>
          <button 
            onClick={() => handleTypeChange('expense')}
            className={cn(
              "flex-1 py-3.5 px-4 rounded-[14px] text-sm font-black transition-all flex items-center justify-center gap-2 uppercase tracking-wider",
              type === 'expense' ? "bg-surface-container-lowest text-rose-600 shadow-sm" : "text-on-surface-variant/50"
            )}
          >
            <div className={cn("w-2 h-2 rounded-full", type === 'expense' ? "bg-rose-600" : "bg-on-surface-variant/20")} />
            Gasto
          </button>
          <button 
            onClick={() => handleTypeChange('income')}
            className={cn(
              "flex-1 py-3.5 px-4 rounded-[14px] text-sm font-black transition-all flex items-center justify-center gap-2 uppercase tracking-wider",
              type === 'income' ? "bg-surface-container-lowest text-emerald-600 shadow-sm" : "text-on-surface-variant/50"
            )}
          >
            <div className={cn("w-2 h-2 rounded-full", type === 'income' ? "bg-emerald-600" : "bg-on-surface-variant/20")} />
            Ingreso
          </button>
        </div>

        {/* Amount Input Section */}
        <section className="text-center py-4">
          <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] mb-4">
            Importe de la {type === 'expense' ? 'Salida' : 'Entrada'}
          </p>
          <div className={cn("flex items-center justify-center gap-2", !isAuthor && "pointer-events-none")}>
            <span className={cn(
              "text-3xl sm:text-5xl font-black font-headline select-none",
              type === 'expense' ? "text-rose-600/70 dark:text-rose-400/80" : "text-emerald-600/70 dark:text-emerald-400/80"
            )}>
              {currencySymbol}
            </span>
            <input 
              ref={amountInputRef}
              type="text"
              inputMode="decimal"
              autoFocus
              readOnly={!isAuthor}
              value={amount}
              onChange={handleAmountChange}
              onFocus={(e) => {
                e.target.select();
              }}
              placeholder="0,00"
              className={cn(
                "w-full max-w-[340px] bg-transparent border-none p-0 focus:ring-0 text-5xl sm:text-7xl font-black tracking-tighter font-headline text-center placeholder:text-on-surface-variant/10 transition-all",
                type === 'expense' ? "text-on-surface" : "text-emerald-600 dark:text-emerald-400"
              )}
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
            {/* Date Selector with Quick Pills */}
            <div 
              className="relative bg-surface-container-lowest p-5 sm:p-6 rounded-3xl border border-on-surface/5 shadow-sm flex flex-col justify-between group overflow-hidden"
            >
              <div 
                onClick={() => setShowDatePicker(true)}
                className="cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/70">Fecha</label>
                  <ChevronRight size={18} className="text-on-surface-variant/30 group-hover:text-on-surface-variant transition-colors" />
                </div>
                <div className="flex items-center gap-3 text-on-surface font-extrabold mb-3">
                  <Calendar size={20} className="text-primary" />
                  <span className="text-base sm:text-lg">{formatDateDisplay(date)}</span>
                </div>
              </div>

              {/* Quick Date Pills */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-on-surface/5 z-10">
                <button
                  type="button"
                  onClick={() => {
                    haptic.selection();
                    setDate(getLocalToday());
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer",
                    isToday
                      ? "bg-primary text-white shadow-xs"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                  )}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    haptic.selection();
                    setDate(getLocalYesterday());
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer",
                    isYesterday
                      ? "bg-primary text-white shadow-xs"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                  )}
                >
                  Ayer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    haptic.selection();
                    setShowDatePicker(true);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95 cursor-pointer",
                    isCustomDate
                      ? "bg-primary text-white shadow-xs"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                  )}
                >
                  <Calendar size={12} />
                  <span>{isCustomDate ? 'Otro día' : 'Calendario'}</span>
                </button>
              </div>
            </div>

            {/* Category Selector with Quick Chips */}
            <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-3xl border border-on-surface/5 shadow-sm flex flex-col justify-between">
              <div>
                <div 
                  onClick={() => isAuthor && setShowCategorySheet(true)}
                  className={cn(
                    "flex items-center justify-between transition-colors",
                    isAuthor ? "cursor-pointer group" : "opacity-60 cursor-default"
                  )}
                >
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/70 mb-1.5">Categoría</label>
                    <div className="flex items-center gap-3 text-on-surface font-extrabold">
                      {selectedCategory ? (
                        <>
                          <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0",
                            selectedCategory.color
                          )}>
                            <IconComponent name={selectedCategory.icon} size={18} />
                          </div>
                          <span className="text-base sm:text-lg truncate max-w-[150px] sm:max-w-none">{selectedCategory.name}</span>
                        </>
                      ) : (
                        <span className="text-on-surface-variant/40">Seleccionar...</span>
                      )}
                    </div>
                  </div>
                  {isAuthor && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1.5 rounded-xl group-hover:bg-primary/20 transition-colors">
                      <span>Todas</span>
                      <ChevronDown size={14} />
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Frequent Category Chips */}
              {frequentCategories.length > 0 && isAuthor && (
                <div className="pt-2 border-t border-on-surface/5 mt-3">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {frequentCategories.map((cat) => {
                      const isSelected = selectedCategory?.id === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            haptic.selection();
                            setSelectedCategory(cat);
                          }}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border active:scale-95 cursor-pointer",
                            isSelected
                              ? "bg-primary text-white border-primary shadow-xs ring-2 ring-primary/25"
                              : "bg-surface-container-low text-on-surface border-transparent hover:bg-surface-container"
                          )}
                        >
                          <div className={cn("w-4 h-4 rounded-md flex items-center justify-center text-white text-[10px]", cat.color)}>
                            <IconComponent name={cat.icon} size={10} />
                          </div>
                          <span className="truncate max-w-[110px]">{cat.name}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        haptic.light();
                        setShowCategorySheet(true);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-on-surface-variant bg-surface-container-low hover:bg-surface-container transition-all shrink-0 border border-transparent cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>Más...</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
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

            <AnimatePresence mode="wait">
              {destination === 'personal' ? (
                <motion.div
                  key="personal-preview"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 flex items-center gap-4 p-5 bg-surface-container-lowest rounded-2xl border border-on-surface/5 shadow-sm">
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0",
                      getProjectGradient(profile?.personalCardColor, true)
                    )}>
                      <ProjectIconComponent name="wallet" size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-on-surface">Gastos Personales</p>
                      <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-wider">
                        Bóveda individual • {profile?.currency || 'ARS'}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="shared-selector"
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
                          <div className={cn(
                            "w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0",
                            getProjectGradient(selectedProject.cardColor)
                          )}>
                            <ProjectIconComponent name={selectedProject.icon} size={20} />
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
                          <div 
                            onClick={() => setShowFirstDueDatePicker(true)}
                            className="cursor-pointer flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-on-surface/10 hover:border-on-surface/20 transition-all group"
                          >
                            <span className="text-xs font-bold text-on-surface">
                              {firstDueDate ? formatDateDisplay(firstDueDate) : 'Seleccionar fecha...'}
                            </span>
                            <Calendar size={16} className="text-primary group-hover:scale-110 transition-transform" />
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
                            <div 
                              onClick={() => setShowFirstDueDatePicker(true)}
                              className="cursor-pointer flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-on-surface/10 hover:border-on-surface/20 transition-all group"
                            >
                              <span className="text-xs font-bold text-on-surface">
                                {firstDueDate ? formatDateDisplay(firstDueDate) : 'Seleccionar fecha...'}
                              </span>
                              <Calendar size={16} className="text-primary group-hover:scale-110 transition-transform" />
                            </div>
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

      </main>

      {/* Fixed Bottom Action Dock (Thumb Zone) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-3 sm:p-4 bg-surface/90 backdrop-blur-xl border-t border-on-surface/10 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        <div className="max-w-2xl mx-auto flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={isSaving || isDeleting}
            className={cn(
              "py-3.5 rounded-2xl bg-surface-container hover:bg-surface-container-high text-on-surface font-extrabold text-xs uppercase tracking-wider border border-on-surface/10 transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer",
              isAuthor ? "px-4 shrink-0" : "w-full"
            )}
            title="Volver atrás"
          >
            <ArrowLeft size={16} />
            <span>Volver</span>
          </button>

          {id && isAuthor && (
            <button
              type="button"
              onClick={() => {
                haptic.medium();
                setShowDeleteModal(true);
              }}
              disabled={isDeleting || isSaving}
              className="p-3.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-all active:scale-95 flex items-center justify-center shrink-0 cursor-pointer"
              title="Eliminar transacción"
            >
              {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
            </button>
          )}

          {isAuthor && (
            <button
              type="button"
              onClick={handleSave}
              disabled={!isValidAmount || isSaving}
              className={cn(
                "flex-1 py-3.5 px-5 rounded-2xl font-black text-sm sm:text-base shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer",
                (!isValidAmount || isSaving)
                  ? "bg-on-surface/10 text-on-surface-variant/40 cursor-not-allowed shadow-none"
                  : type === 'expense'
                    ? "bg-primary text-white shadow-primary/25 hover:bg-primary/90"
                    : "bg-emerald-600 text-white shadow-emerald-600/25 hover:bg-emerald-500"
              )}
            >
              {isSaving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Check size={18} strokeWidth={3} />
              )}
              <span>{id ? 'Actualizar Transacción' : `Confirmar ${type === 'expense' ? 'Gasto' : 'Ingreso'}`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Custom Destructive Confirmation Modal (Phase 1) */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeleting && setShowDeleteModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Dialog / Bottom Sheet */}
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="relative w-full max-w-md bg-surface-container-lowest rounded-t-[2.5rem] sm:rounded-3xl p-6 sm:p-7 shadow-2xl border border-on-surface/10 z-10 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
            >
              {/* Header Icon */}
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
                <Trash2 size={26} strokeWidth={2.2} />
              </div>

              {/* Title & Body */}
              <div className="text-center space-y-2 mb-6">
                <h3 className="text-lg sm:text-xl font-black text-on-surface font-headline tracking-tight">
                  ¿Eliminar transacción?
                </h3>
                <p className="text-xs sm:text-sm text-on-surface-variant/80 leading-relaxed max-w-sm mx-auto">
                  {isExistingInstallment
                    ? `Estás a punto de eliminar la cuota ${existingInstallmentNumber} de ${existingTotalInstallments}. Los cambios aplicarán únicamente a esta cuota mensual.`
                    : 'Esta acción no se puede deshacer. La transacción será eliminada permanentemente de tu historial y balances.'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="flex-1 py-3.5 px-4 rounded-2xl bg-surface-container hover:bg-surface-container-high text-on-surface font-extrabold text-xs uppercase tracking-wider border border-on-surface/10 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={executeDelete}
                  disabled={isDeleting}
                  className="flex-1 py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Eliminando...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>Eliminar</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Date Pickers */}
      <CustomDatePickerModal
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDate={date}
        onSelectDate={(newDate) => setDate(newDate)}
        title="Fecha de la Transacción"
      />

      <CustomDatePickerModal
        isOpen={showFirstDueDatePicker}
        onClose={() => setShowFirstDueDatePicker(false)}
        selectedDate={firstDueDate}
        onSelectDate={(newDate) => setFirstDueDate(newDate)}
        title="Primer Vencimiento"
      />

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
                      haptic.light();
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
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0",
                      getProjectGradient(proj.cardColor)
                    )}>
                      <ProjectIconComponent name={proj.icon} size={24} />
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
