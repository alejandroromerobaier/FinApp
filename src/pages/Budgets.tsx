import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Target, Save, Check, AlertCircle, ChevronLeft, ChevronRight, Copy,
  ShoppingBag, Utensils, Car, Play, Heart, Book, MoreHorizontal, 
  Landmark, Tag, Gift, Briefcase, Home as HomeIcon, Plane, Coffee, Zap, Smartphone, ShieldCheck,
  ShoppingCart, Hotel, CheckCircle2, TrendingUp, AlertTriangle, Sparkles, Receipt, X, Search,
  Flame, CreditCard as CardIcon, Pencil, Trash2, Wand2, Calendar, TrendingDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData, Category } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../context/ToastContext';
import { haptic } from '../lib/haptics';
import { updateBudget, deleteBudget, getBudgetsOnce } from '../services/firestoreService';
import { getLocalMonth, parseLocalMonth } from '../lib/dateUtils';
import { formatCurrency, cn, formatCurrencyInput, formatAmountForDisplay, parseFormattedAmount } from '../lib/utils';
import { PageHeader } from '../components/PageHeader';

import { getCategoryIcon } from '../lib/categoryIcons';

const IconComponent = ({ name, size = 20 }: { name: string, size?: number }) => {
  const Icon = getCategoryIcon(name);
  return <Icon size={size} />;
};

type BudgetFilter = 'all' | 'alerts' | 'active' | 'top_spent';

export const Budgets: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { categories, budgets, projects, budgetMonth, setBudgetMonth, transactions, cards } = useData();
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [successMap, setSuccessMap] = useState<Record<string, boolean>>({});
  const [localBudgets, setLocalBudgets] = useState<Record<string, string>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [breakdownCategory, setBreakdownCategory] = useState<Category | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editSheetAmount, setEditSheetAmount] = useState<string>('');
  const [isSavingSheet, setIsSavingSheet] = useState<boolean>(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyItems, setCopyItems] = useState<Array<{
    categoryId: string;
    categoryName: string;
    categoryIcon: string;
    categoryColor: string;
    prevAmount: number;
    avg3mAmount: number;
    existingAmount: number;
    chosenAmount: number;
    chosenDisplay: string;
    source: 'prev' | 'avg' | 'custom';
    selected: boolean;
  }>>([]);
  const [isApplyingBatch, setIsApplyingBatch] = useState(false);

  // Filter expense categories and omit system categories
  const expenseCategories = useMemo(() => {
    return categories.filter(c => c.type === 'expense' && c.id !== 'system_transferencia');
  }, [categories]);

  // Active project & currency
  const activeProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId);
  }, [projects, selectedProjectId]);

  const activeCurrency = selectedProjectId ? (activeProject?.currency || 'ARS') : (profile?.currency || 'ARS');

  // Month date computations
  const activeDate = useMemo(() => parseLocalMonth(budgetMonth), [budgetMonth]);
  const activeMonth = activeDate.getMonth();
  const activeYear = activeDate.getFullYear();
  const currentMonthDisplay = activeDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  const localMonthNow = getLocalMonth();
  const isCurrentMonth = budgetMonth === localMonthNow;
  const isFutureMonth = budgetMonth > localMonthNow;
  const isPastMonth = budgetMonth < localMonthNow;
  const isEditableMonth = budgetMonth >= localMonthNow;

  // Day & month elapsed ratio for pacing analysis
  const now = new Date();
  const currentDay = now.getDate();
  const daysInActiveMonth = new Date(activeYear, activeMonth + 1, 0).getDate();
  const monthElapsedRatio = isCurrentMonth ? Math.min(1, currentDay / daysInActiveMonth) : 1;

  // Initialize local budgets from store
  useEffect(() => {
    const initial: Record<string, string> = {};
    budgets.forEach(b => {
      // Only include budgets for the selected context and month
      if (b.month && b.month !== budgetMonth) return;
      if ((selectedProjectId === null && (!b.projectId || b.projectId === 'personal' || b.projectId === null)) || 
          (selectedProjectId !== null && b.projectId === selectedProjectId)) {
        initial[b.categoryId] = b.amount ? formatAmountForDisplay(b.amount) : '';
      }
    });
    setLocalBudgets(initial);
  }, [budgets, selectedProjectId, budgetMonth]);

  // Filter active shared projects
  const activeProjects = useMemo(() => {
    return projects.filter(p => (p.status || 'active') !== 'inactive');
  }, [projects]);

  const isPersonalActive = (profile?.personalStatus || 'active') !== 'inactive';

  // Ensure selectedProjectId is an active context (only after projects load)
  useEffect(() => {
    if (projects.length === 0) return;
    if (selectedProjectId !== null && !activeProjects.some(p => p.id === selectedProjectId)) {
      if (isPersonalActive) {
        setSelectedProjectId(null);
      } else if (activeProjects.length > 0) {
        setSelectedProjectId(activeProjects[0].id);
      }
    }
  }, [projects.length, activeProjects, selectedProjectId, isPersonalActive]);

  // Category spending aggregation for the active month and selected project
  const categorySpentMap = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.type !== 'expense') return;

      const isPersonalScope = selectedProjectId === null;
      const matchesProject = isPersonalScope 
        ? (!t.projectId || t.projectId === 'personal') 
        : t.projectId === selectedProjectId;
        
      if (!matchesProject) return;

      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
      if (isNaN(tDate.getTime())) return;
      if (tDate.getMonth() !== activeMonth || tDate.getFullYear() !== activeYear) return;

      if (t.categoryId) {
        map[t.categoryId] = (map[t.categoryId] || 0) + (t.amount || 0);
      }
    });
    return map;
  }, [transactions, selectedProjectId, activeMonth, activeYear]);

  // Days remaining in current month for daily safe-to-spend calculation
  const daysRemainingInMonth = useMemo(() => {
    if (!isCurrentMonth) return 0;
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    return Math.max(1, lastDay - currentDay + 1);
  }, [isCurrentMonth]);

  // Previous month spending for suggested budget calculation
  const prevMonthSpentMap = useMemo(() => {
    const d = parseLocalMonth(budgetMonth);
    d.setMonth(d.getMonth() - 1);
    const prevMonth = d.getMonth();
    const prevYear = d.getFullYear();

    const map: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.type !== 'expense') return;

      const isPersonalScope = selectedProjectId === null;
      const matchesProject = isPersonalScope 
        ? (!t.projectId || t.projectId === 'personal') 
        : t.projectId === selectedProjectId;
        
      if (!matchesProject) return;

      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
      if (isNaN(tDate.getTime())) return;
      if (tDate.getMonth() !== prevMonth || tDate.getFullYear() !== prevYear) return;

      if (t.categoryId) {
        map[t.categoryId] = (map[t.categoryId] || 0) + (t.amount || 0);
      }
    });
    return map;
  }, [transactions, selectedProjectId, budgetMonth]);

  // 3-Month Average Spending per Category (Previous 3 closed months)
  const avg3MonthSpentMap = useMemo(() => {
    const d = parseLocalMonth(budgetMonth);
    const m1 = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const m2 = new Date(d.getFullYear(), d.getMonth() - 2, 1);
    const m3 = new Date(d.getFullYear(), d.getMonth() - 3, 1);

    const m1Idx = m1.getMonth(); const m1Yr = m1.getFullYear();
    const m2Idx = m2.getMonth(); const m2Yr = m2.getFullYear();
    const m3Idx = m3.getMonth(); const m3Yr = m3.getFullYear();

    const catSums: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.type !== 'expense') return;
      const isPersonalScope = selectedProjectId === null;
      const matchesScope = isPersonalScope 
        ? (!t.projectId || t.projectId === 'personal' || t.projectId === null)
        : t.projectId === selectedProjectId;
      if (!matchesScope) return;

      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
      if (isNaN(tDate.getTime())) return;
      const tMonth = tDate.getMonth();
      const tYear = tDate.getFullYear();

      const inM1 = tMonth === m1Idx && tYear === m1Yr;
      const inM2 = tMonth === m2Idx && tYear === m2Yr;
      const inM3 = tMonth === m3Idx && tYear === m3Yr;

      if (inM1 || inM2 || inM3) {
        if (t.categoryId) {
          catSums[t.categoryId] = (catSums[t.categoryId] || 0) + (t.amount || 0);
        }
      }
    });

    const avgMap: Record<string, number> = {};
    Object.keys(catSums).forEach(catId => {
      avgMap[catId] = Math.round(catSums[catId] / 3);
    });
    return avgMap;
  }, [transactions, selectedProjectId, budgetMonth]);

  // Total Income for active month in current scope (Personal or Project)
  const totalScopeIncome = useMemo(() => {
    return transactions
      .filter(t => {
        if (t.type !== 'income') return false;
        const isPersonalScope = selectedProjectId === null;
        const matchesScope = isPersonalScope 
          ? (!t.projectId || t.projectId === 'personal' || t.projectId === null)
          : t.projectId === selectedProjectId;
        if (!matchesScope) return false;

        const tDate = t.date instanceof Date ? t.date : new Date(t.date);
        if (isNaN(tDate.getTime())) return false;
        return tDate.getMonth() === activeMonth && tDate.getFullYear() === activeYear;
      })
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [transactions, selectedProjectId, activeMonth, activeYear]);

  // Transactions list for Category Breakdown Drawer
  const breakdownTransactions = useMemo(() => {
    if (!breakdownCategory) return [];
    return transactions
      .filter(t => {
        if (t.type !== 'expense') return false;
        const isPersonalScope = selectedProjectId === null;
        const matchesProject = isPersonalScope 
          ? (!t.projectId || t.projectId === 'personal') 
          : t.projectId === selectedProjectId;
        if (!matchesProject) return false;
        if (t.categoryId !== breakdownCategory.id) return false;

        const tDate = t.date instanceof Date ? t.date : new Date(t.date);
        if (isNaN(tDate.getTime())) return false;
        return tDate.getMonth() === activeMonth && tDate.getFullYear() === activeYear;
      })
      .sort((a, b) => {
        const da = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
        const db = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
        return db - da;
      });
  }, [breakdownCategory, transactions, selectedProjectId, activeMonth, activeYear]);

  // Transaction count per category in active month
  const categoryTxCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.type !== 'expense') return;

      const isPersonalScope = selectedProjectId === null;
      const matchesProject = isPersonalScope 
        ? (!t.projectId || t.projectId === 'personal') 
        : t.projectId === selectedProjectId;
        
      if (!matchesProject) return;

      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
      if (isNaN(tDate.getTime())) return;
      if (tDate.getMonth() !== activeMonth || tDate.getFullYear() !== activeYear) return;

      if (t.categoryId) {
        map[t.categoryId] = (map[t.categoryId] || 0) + 1;
      }
    });
    return map;
  }, [transactions, selectedProjectId, activeMonth, activeYear]);

  // Global Budget Execution Summary
  const budgetSummary = useMemo(() => {
    let totalBudget = 0;
    let totalSpent = 0;
    let activeBudgetsCount = 0;
    let overBudgetCount = 0;

    expenseCategories.forEach(cat => {
      const budgetObj = budgets.find(b => 
        b.categoryId === cat.id && 
        (!b.month || b.month === budgetMonth) &&
        ((selectedProjectId === null && (!b.projectId || b.projectId === 'personal' || b.projectId === null)) || 
         (selectedProjectId !== null && b.projectId === selectedProjectId))
      );

      if (budgetObj && budgetObj.amount > 0) {
        activeBudgetsCount++;
        totalBudget += budgetObj.amount;
        const spent = categorySpentMap[cat.id] || 0;
        totalSpent += spent;
        if (spent > budgetObj.amount) {
          overBudgetCount++;
        }
      }
    });

    const remaining = totalBudget - totalSpent;
    const rawPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return {
      totalBudget,
      totalSpent,
      remaining,
      percentUsed: Math.min(rawPercent, 100),
      rawPercent,
      activeBudgetsCount,
      overBudgetCount,
      hasBudgets: activeBudgetsCount > 0
    };
  }, [budgets, expenseCategories, selectedProjectId, categorySpentMap]);

  // Top budget categories share distribution for modern segmented bar
  const topBudgetShares = useMemo(() => {
    if (budgetSummary.totalBudget <= 0) return [];
    const shares: { id: string; name: string; color: string; amount: number; pct: number }[] = [];
    expenseCategories.forEach(cat => {
      const budgetObj = budgets.find(b => 
        b.categoryId === cat.id && 
        (!b.month || b.month === budgetMonth) &&
        ((selectedProjectId === null && (!b.projectId || b.projectId === 'personal' || b.projectId === null)) || 
         (selectedProjectId !== null && b.projectId === selectedProjectId))
      );
      if (budgetObj && budgetObj.amount > 0) {
        shares.push({
          id: cat.id,
          name: cat.name,
          color: cat.color,
          amount: budgetObj.amount,
          pct: (budgetObj.amount / budgetSummary.totalBudget) * 100
        });
      }
    });
    return shares.sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [expenseCategories, budgets, budgetMonth, selectedProjectId, budgetSummary.totalBudget]);

  // Helper for enriched transaction payment method in modal
  const getPaymentMethodInfo = (t: any) => {
    if (t.cardId && cards && cards.length > 0) {
      const card = cards.find(c => c.id === t.cardId);
      if (card) {
        return {
          label: card.name ? `${card.name}${card.last4Digits ? ` •••• ${card.last4Digits}` : ''}` : 'Tarjeta',
          isCard: true
        };
      }
    }
    if (t.paymentMethod === 'credit_card') return { label: 'Crédito', isCard: true };
    if (t.paymentMethod === 'debit_card') return { label: 'Débito', isCard: true };
    if (t.paymentMethod === 'cash') return { label: 'Efectivo', isCard: false };
    if (t.paymentMethod === 'bank_transfer') return { label: 'Transferencia', isCard: false };
    return { label: '', isCard: false };
  };

  // Count of categories currently with alert (spent >= 80% or exceeded)
  const alertCategoriesCount = useMemo(() => {
    return expenseCategories.filter(cat => {
      const budgetObj = budgets.find(b => 
        b.categoryId === cat.id && 
        (!b.month || b.month === budgetMonth) &&
        ((selectedProjectId === null && (!b.projectId || b.projectId === 'personal' || b.projectId === null)) || 
         (selectedProjectId !== null && b.projectId === selectedProjectId))
      );
      if (!budgetObj || budgetObj.amount <= 0) return false;
      const spent = categorySpentMap[cat.id] || 0;
      return spent >= budgetObj.amount * 0.8;
    }).length;
  }, [expenseCategories, budgets, budgetMonth, selectedProjectId, categorySpentMap]);

  // Helper to get active budget amount for a category in current scope/month
  const getCategoryBudgetAmount = (categoryId: string) => {
    const budgetObj = budgets.find(b => 
      b.categoryId === categoryId && 
      (!b.month || b.month === budgetMonth) &&
      ((selectedProjectId === null && (!b.projectId || b.projectId === 'personal' || b.projectId === null)) || 
       (selectedProjectId !== null && b.projectId === selectedProjectId))
    );
    return budgetObj?.amount || 0;
  };

  // Filtered, searched and sorted category list for display
  const displayedCategories = useMemo(() => {
    let list = [...expenseCategories];

    // In past (historical) months, only show categories that actually had a budget or spending
    if (isPastMonth) {
      list = list.filter(cat => getCategoryBudgetAmount(cat.id) > 0);
    }

    if (budgetFilter === 'alerts') {
      list = list.filter(cat => {
        const bAmount = getCategoryBudgetAmount(cat.id);
        if (bAmount <= 0) return false;
        const spent = categorySpentMap[cat.id] || 0;
        return spent >= bAmount * 0.8;
      });
    } else if (budgetFilter === 'active') {
      list = list.filter(cat => getCategoryBudgetAmount(cat.id) > 0);
    } else if (budgetFilter === 'top_spent') {
      list.sort((a, b) => (categorySpentMap[b.id] || 0) - (categorySpentMap[a.id] || 0));
    } else {
      // 'all': Smart sorting -> Active budgets first (by % consumed desc), then unbudgeted (by spent desc)
      list.sort((a, b) => {
        const bA = getCategoryBudgetAmount(a.id);
        const bB = getCategoryBudgetAmount(b.id);
        const hasA = bA > 0;
        const hasB = bB > 0;

        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;

        const spentA = categorySpentMap[a.id] || 0;
        const spentB = categorySpentMap[b.id] || 0;

        if (hasA && hasB) {
          const pctA = spentA / bA;
          const pctB = spentB / bB;
          if (pctB !== pctA) return pctB - pctA;
          return bB - bA;
        }

        return spentB - spentA;
      });
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(cat => cat.name.toLowerCase().includes(q));
    }

    return list;
  }, [expenseCategories, budgetFilter, budgets, budgetMonth, selectedProjectId, categorySpentMap, searchTerm, isPastMonth]);

  const handleSave = async (categoryId: string, rawAmount: number | string, isDelete: boolean = false) => {
    setSavingMap(prev => ({ ...prev, [categoryId]: true }));
    const amount = typeof rawAmount === 'string' ? parseFormattedAmount(rawAmount) : rawAmount;
    try {
      if (isDelete) {
        const existingBudget = budgets.find(b => 
          b.categoryId === categoryId && 
          (!b.month || b.month === budgetMonth) &&
          ((selectedProjectId === null && (!b.projectId || b.projectId === 'personal' || b.projectId === null)) || 
           (selectedProjectId !== null && b.projectId === selectedProjectId))
        );
        await deleteBudget(categoryId, budgetMonth, selectedProjectId, existingBudget?.id);
        haptic.light();
        toast.info('Objetivo desactivado');
      } else {
        await updateBudget(categoryId, budgetMonth, amount, selectedProjectId);
        haptic.success();
        toast.success('Presupuesto guardado');
      }
      
      setSuccessMap(prev => ({ ...prev, [categoryId]: true }));
      setTimeout(() => {
        setSuccessMap(prev => ({ ...prev, [categoryId]: false }));
      }, 2000);
    } catch (err) {
      console.error(err);
      haptic.error();
      toast.error('Error al procesar el presupuesto');
    } finally {
      setSavingMap(prev => ({ ...prev, [categoryId]: false }));
    }
  };

  const handleAutoSave = (categoryId: string) => {
    if (!isEditableMonth) return;
    const currentVal = parseFormattedAmount(localBudgets[categoryId] || '');
    const existingBudget = budgets.find(b => 
      b.categoryId === categoryId && 
      (!b.month || b.month === budgetMonth) &&
      ((selectedProjectId === null && (!b.projectId || b.projectId === 'personal' || b.projectId === null)) || 
       (selectedProjectId !== null && b.projectId === selectedProjectId))
    );
    const oldAmount = existingBudget?.amount || 0;
    if (currentVal !== oldAmount) {
      handleSave(categoryId, currentVal);
    }
  };

  const openEditModal = (cat: Category) => {
    haptic.selection();
    setEditingCategory(cat);
    const existing = localBudgets[cat.id];
    if (existing && parseFormattedAmount(existing) > 0) {
      setEditSheetAmount(existing);
    } else if (prevMonthSpentMap[cat.id] > 0) {
      setEditSheetAmount(formatAmountForDisplay(prevMonthSpentMap[cat.id]));
    } else {
      setEditSheetAmount('');
    }
  };

  const handlePrevMonth = () => {
    haptic.selection();
    const d = parseLocalMonth(budgetMonth);
    d.setMonth(d.getMonth() - 1);
    setBudgetMonth(getLocalMonth(d));
  };

  const handleNextMonth = () => {
    haptic.selection();
    const d = parseLocalMonth(budgetMonth);
    d.setMonth(d.getMonth() + 1);
    setBudgetMonth(getLocalMonth(d));
  };

  const openCopyAssistantModal = async () => {
    if (copying) return;
    setCopying(true);
    haptic.selection();
    try {
      const d = parseLocalMonth(budgetMonth);
      d.setMonth(d.getMonth() - 1);
      const prevMonthStr = getLocalMonth(d);

      const projectIds = activeProjects.map(p => p.id);
      const prevBudgets = await getBudgetsOnce(prevMonthStr, projectIds);

      const filteredPrev = prevBudgets.filter(b => 
        (selectedProjectId === null && (!b.projectId || b.projectId === 'personal' || b.projectId === null)) ||
        (selectedProjectId !== null && b.projectId === selectedProjectId)
      );

      const items: Array<{
        categoryId: string;
        categoryName: string;
        categoryIcon: string;
        categoryColor: string;
        prevAmount: number;
        avg3mAmount: number;
        existingAmount: number;
        chosenAmount: number;
        chosenDisplay: string;
        source: 'prev' | 'avg' | 'custom';
        selected: boolean;
      }> = [];

      expenseCategories.forEach(cat => {
        const prevB = filteredPrev.find(b => b.categoryId === cat.id);
        const prevAmount = prevB ? prevB.amount : 0;
        const avg3m = avg3MonthSpentMap[cat.id] || 0;
        const prevSpent = prevMonthSpentMap[cat.id] || 0;
        const existingAmount = getCategoryBudgetAmount(cat.id);

        // Has any historical signal
        if (prevAmount > 0 || avg3m > 0 || prevSpent > 0) {
          const defaultAmount = prevAmount > 0 ? prevAmount : (avg3m > 0 ? avg3m : prevSpent);
          items.push({
            categoryId: cat.id,
            categoryName: cat.name,
            categoryIcon: cat.icon,
            categoryColor: cat.color,
            prevAmount,
            avg3mAmount: avg3m,
            existingAmount,
            chosenAmount: defaultAmount,
            chosenDisplay: formatAmountForDisplay(defaultAmount),
            source: prevAmount > 0 ? 'prev' : 'avg',
            selected: true
          });
        }
      });

      if (items.length === 0) {
        toast.info('No se encontraron metas en el mes anterior ni gastos en los últimos 3 meses.');
        return;
      }

      setCopyItems(items);
      setShowCopyModal(true);
    } catch (err) {
      console.error('Error opening copy assistant:', err);
      haptic.error();
      toast.error('Error al preparar el asistente de presupuesto');
    } finally {
      setCopying(false);
    }
  };

  const handleApplyBatchBudgets = async () => {
    const selected = copyItems.filter(item => item.selected && item.chosenAmount > 0);
    if (selected.length === 0) {
      toast.warning('Selecciona al menos una categoría con monto mayor a cero.');
      return;
    }

    setIsApplyingBatch(true);
    haptic.light();
    try {
      for (const item of selected) {
        await updateBudget(item.categoryId, budgetMonth, item.chosenAmount, selectedProjectId);
        setLocalBudgets(prev => ({ ...prev, [item.categoryId]: formatAmountForDisplay(item.chosenAmount) }));
      }
      haptic.success();
      toast.success(`Se aplicaron ${selected.length} presupuestos con éxito`);
      setShowCopyModal(false);
    } catch (err) {
      console.error('Error applying batch budgets:', err);
      haptic.error();
      toast.error('Error al aplicar los presupuestos');
    } finally {
      setIsApplyingBatch(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 max-w-4xl mx-auto py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Header */}
      <PageHeader
        backTo="/settings"
        categoryTag="Control de Gastos"
        title="Presupuestos"
        subtitle="Establece límites mensuales por categoría para mantener tus finanzas bajo control."
        badge={
          !isCurrentMonth ? (
            <span className={cn(
              "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
              isFutureMonth
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
            )}>
              {isFutureMonth ? 'Planificación' : 'Histórico'}
            </span>
          ) : undefined
        }
      />

      {/* Month Navigator */}
      <section className="flex items-center justify-between bg-surface-container-low p-2 rounded-2xl border border-on-surface/5 shadow-xs">
        <button 
          onClick={handlePrevMonth}
          className="w-10 h-10 rounded-xl hover:bg-on-surface/5 flex items-center justify-center text-on-surface-variant transition-colors active:scale-95 cursor-pointer"
          title="Mes anterior"
        >
          <ChevronLeft size={20} />
        </button>
        <div 
          className="text-center group cursor-pointer" 
          onClick={() => {
            if (!isCurrentMonth) {
              haptic.selection();
              setBudgetMonth(getLocalMonth());
            }
          }}
          title={!isCurrentMonth ? "Volver al mes actual" : undefined}
        >
          <p className="text-xs sm:text-sm font-black text-on-surface uppercase tracking-tight flex items-center justify-center gap-1.5">
            {isCurrentMonth && <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />}
            {currentMonthDisplay}
          </p>
          {!isCurrentMonth && (
            <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full hover:bg-primary/20 transition-all active:scale-95">
              <span>↩ Volver al mes actual</span>
            </span>
          )}
        </div>
        <button 
          onClick={handleNextMonth}
          className="w-10 h-10 rounded-xl hover:bg-on-surface/5 flex items-center justify-center text-on-surface-variant transition-colors active:scale-95 cursor-pointer"
          title="Mes siguiente"
        >
          <ChevronRight size={20} />
        </button>
      </section>

      {/* Project Selector (Only if active projects exist) */}
      {activeProjects.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {isPersonalActive && (
              <button
                onClick={() => {
                  haptic.selection();
                  setSelectedProjectId(null);
                }}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all shrink-0 active:scale-95 cursor-pointer",
                  selectedProjectId === null 
                    ? "bg-primary text-white shadow-md shadow-primary/20" 
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                )}
              >
                Personal
              </button>
            )}
            {activeProjects.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  haptic.selection();
                  setSelectedProjectId(p.id);
                }}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all shrink-0 active:scale-95 cursor-pointer",
                  selectedProjectId === p.id 
                    ? "bg-primary text-white shadow-md shadow-primary/20" 
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Hero: Global Budget Execution Summary Card */}
      {budgetSummary.hasBudgets ? (
        <section className="isolate bg-gradient-to-br from-surface-container-lowest via-surface-container-low to-surface-container-low p-5 sm:p-6 rounded-[2rem] border border-primary/15 shadow-sm relative overflow-hidden space-y-4">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          
          {/* Top Bar: Title & Fast Assistant Action */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs shrink-0">
                <Target size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/60 block">
                  Ejecución del Mes
                </span>
                <h3 className="text-sm sm:text-base font-black text-on-surface font-headline tracking-tight leading-snug break-words">
                  {selectedProjectId ? (activeProject?.name || 'Proyecto') : 'Presupuesto Personal'}
                </h3>
              </div>
            </div>

            {isEditableMonth && (
              <button
                onClick={openCopyAssistantModal}
                disabled={copying}
                className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black uppercase tracking-wider transition-all inline-flex items-center gap-1.5 active:scale-95 shadow-2xs shrink-0 cursor-pointer"
                title="Copiar metas anteriores o calcular promedios de 3 meses"
              >
                {copying ? (
                  <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                ) : (
                  <Wand2 size={13} />
                )}
                <span>Asistente</span>
              </button>
            )}
          </div>

          {/* Hero KPI: Saldo Disponible / Excedido destacado sin cortes */}
          <div className="py-1 flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-t border-on-surface/5 pt-3">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/60 block">
                {budgetSummary.remaining >= 0 ? 'Disponible para gastar' : 'Presupuesto excedido'}
              </span>
              <span className={cn(
                "text-2xl sm:text-3xl font-headline font-black tracking-tight block leading-tight",
                budgetSummary.remaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              )}>
                {budgetSummary.remaining >= 0 ? '' : '-'}{formatCurrency(Math.abs(budgetSummary.remaining), activeCurrency)}
              </span>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <span className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 shadow-2xs",
                budgetSummary.rawPercent > 100 
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" 
                  : budgetSummary.rawPercent >= 80 
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" 
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              )}>
                {budgetSummary.rawPercent > 100 && <AlertTriangle size={12} />}
                {budgetSummary.rawPercent.toFixed(0)}% Utilizado
              </span>
            </div>
          </div>

          {/* Global Progress Bar with Month Day Micro-Marker */}
          <div className="space-y-1.5">
            <div className="relative h-2.5 w-full bg-on-surface/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${budgetSummary.percentUsed}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  budgetSummary.rawPercent > 100 
                    ? "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]" 
                    : budgetSummary.rawPercent >= 80 
                    ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]" 
                    : "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                )}
              />
              {isCurrentMonth && (
                <div 
                  style={{ left: `${monthElapsedRatio * 100}%` }}
                  className="absolute top-0 bottom-0 w-0.5 bg-on-surface/40 z-10 pointer-events-none"
                  title={`Día actual: ${currentDay}`}
                />
              )}
            </div>

            {isCurrentMonth && (
              <div className="flex items-center justify-between text-[10px] text-on-surface-variant/60 font-bold px-0.5">
                <span>Día {currentDay} de {daysInActiveMonth} ({Math.round(monthElapsedRatio * 100)}% transcurrido)</span>
                {budgetSummary.overBudgetCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      haptic.selection();
                      setBudgetFilter('alerts');
                    }}
                    className="text-rose-500 hover:underline font-black inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>{budgetSummary.overBudgetCount} en alerta</span>
                    <ChevronRight size={11} />
                  </button>
                ) : (
                  <span>En regla</span>
                )}
              </div>
            )}
          </div>

          {/* Sub-KPIs: Presupuestado vs. Gastado real */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-on-surface/5">
            <div className="bg-surface-container-lowest/60 p-2.5 rounded-xl border border-on-surface/5">
              <span className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/60 block">
                Presupuestado
              </span>
              <span className="text-sm sm:text-base font-black text-on-surface font-headline block truncate">
                {formatCurrency(budgetSummary.totalBudget, activeCurrency)}
              </span>
              <span className="text-[10px] text-on-surface-variant/50 font-semibold block">
                {budgetSummary.activeBudgetsCount} {budgetSummary.activeBudgetsCount === 1 ? 'meta activa' : 'metas activas'}
              </span>
            </div>

            <div className="bg-surface-container-lowest/60 p-2.5 rounded-xl border border-on-surface/5">
              <span className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/60 block">
                Gastado real
              </span>
              <span className={cn(
                "text-sm sm:text-base font-black font-headline block truncate",
                budgetSummary.rawPercent > 100 ? "text-rose-600 dark:text-rose-400" : "text-on-surface"
              )}>
                {formatCurrency(budgetSummary.totalSpent, activeCurrency)}
              </span>
              <span className="text-[10px] text-on-surface-variant/50 font-semibold block">
                acumulado en el mes
              </span>
            </div>
          </div>

          {/* Alerta Inteligente de Déficit Presupuestario (No bloqueante) */}
          {totalScopeIncome > 0 && budgetSummary.totalBudget > totalScopeIncome && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs">
              <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 min-w-0 flex-1">
                <p className="font-bold text-amber-700 dark:text-amber-300">
                  Presupuesto en déficit respecto a tus ingresos
                </p>
                <p className="text-amber-600/90 dark:text-amber-400/90 text-[11px] leading-relaxed">
                  Estás presupuestando <strong>{formatCurrency(budgetSummary.totalBudget, activeCurrency)}</strong> frente a ingresos registrados de <strong>{formatCurrency(totalScopeIncome, activeCurrency)}</strong> (Déficit: {formatCurrency(budgetSummary.totalBudget - totalScopeIncome, activeCurrency)}).
                </p>
              </div>
            </div>
          )}

          {/* Category Share Distribution Bar (Revolut Style) */}
          {topBudgetShares.length > 1 && (
            <div className="pt-2 border-t border-on-surface/5 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-black text-on-surface-variant/60 uppercase tracking-wider">
                <span>Distribución del Presupuesto</span>
                <span>Top {topBudgetShares.length} categorías</span>
              </div>
              <div className="h-2 w-full rounded-full bg-on-surface/5 flex overflow-hidden gap-0.5">
                {topBudgetShares.map(s => (
                  <div
                    key={s.id}
                    style={{ width: `${s.pct}%` }}
                    className={cn("h-full transition-all", s.color)}
                    title={`${s.name}: ${s.pct.toFixed(0)}%`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pt-0.5">
                {topBudgetShares.map(s => (
                  <div key={s.id} className="flex items-center gap-1.5 text-[10px] font-bold whitespace-nowrap shrink-0">
                    <div className={cn("w-2 h-2 rounded-full", s.color)} />
                    <span className="text-on-surface-variant/80">{s.name}</span>
                    <span className="text-on-surface font-extrabold">{s.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : (
        /* Empty State Inspirador con CTA */
        <section className="bg-gradient-to-br from-surface-container-lowest via-surface-container-low to-surface-container-low p-6 sm:p-8 rounded-[2rem] border border-on-surface/10 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-xs">
            <Target size={28} />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base sm:text-lg font-black text-on-surface font-headline tracking-tight">
              Sin presupuestos en {currentMonthDisplay}
            </h3>
            <p className="text-xs text-on-surface-variant/70 leading-relaxed">
              Fija límites mensuales por categoría para mantener tus finanzas bajo control o utiliza el asistente predictivo.
            </p>
          </div>
          {isEditableMonth && (
            <button
              onClick={openCopyAssistantModal}
              disabled={copying}
              className="px-4 py-2.5 rounded-2xl bg-primary hover:bg-primary/90 text-on-primary font-headline font-black text-xs uppercase tracking-wider inline-flex items-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Wand2 size={15} />
              <span>Configurar con Inteligencia (Copiar mes ant. o Promedios 3M)</span>
            </button>
          )}
        </section>
      )}

      {/* Filter & Search Bar */}
      <section className="space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
          {/* Quick Filters (Modern Fintech Segmented Bar) */}
          <div className="bg-surface-container-low/70 p-1 rounded-2xl border border-on-surface/5 flex items-center gap-1 overflow-x-auto no-scrollbar shadow-2xs flex-1">
            <button
              onClick={() => {
                haptic.selection();
                setBudgetFilter('all');
              }}
              className={cn(
                "px-3.5 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider whitespace-nowrap transition-all shrink-0 active:scale-95",
                budgetFilter === 'all'
                  ? "bg-surface-container-lowest text-on-surface shadow-xs font-black"
                  : "text-on-surface-variant/70 hover:text-on-surface hover:bg-surface-container-high/40"
              )}
            >
              Todas ({isPastMonth ? budgetSummary.activeBudgetsCount : expenseCategories.length})
            </button>
            <button
              onClick={() => {
                haptic.selection();
                setBudgetFilter('alerts');
              }}
              className={cn(
                "px-3.5 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 active:scale-95",
                budgetFilter === 'alerts'
                  ? "bg-rose-500 text-white shadow-xs font-black"
                  : "text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
              )}
            >
              <AlertTriangle size={13} />
              En Alerta ({alertCategoriesCount})
            </button>
            <button
              onClick={() => {
                haptic.selection();
                setBudgetFilter('active');
              }}
              className={cn(
                "px-3.5 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 active:scale-95",
                budgetFilter === 'active'
                  ? "bg-surface-container-lowest text-primary shadow-xs font-black"
                  : "text-on-surface-variant/70 hover:text-primary hover:bg-surface-container-high/40"
              )}
            >
              <Target size={13} />
              Solo Activas ({budgetSummary.activeBudgetsCount})
            </button>
            <button
              onClick={() => {
                haptic.selection();
                setBudgetFilter('top_spent');
              }}
              className={cn(
                "px-3.5 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 active:scale-95",
                budgetFilter === 'top_spent'
                  ? "bg-surface-container-lowest text-amber-600 dark:text-amber-400 shadow-xs font-black"
                  : "text-on-surface-variant/70 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-surface-container-high/40"
              )}
            >
              <TrendingUp size={13} />
              Mayor Gasto
            </button>
          </div>

          {/* Quick Search Input */}
          <div className="relative w-full sm:w-56 shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar categoría..."
              className="w-full pl-8.5 pr-8 py-1.5 rounded-xl bg-surface-container-low/70 border border-on-surface/5 text-xs font-bold text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-on-surface"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Categories Budget List (3-Tier Fintech Cards) */}
      <div className="space-y-3">
        {displayedCategories.length === 0 ? (
          <div className="text-center py-12 space-y-3 opacity-60 bg-surface-container-lowest rounded-2xl border border-on-surface/5">
            <AlertCircle size={36} className="mx-auto text-on-surface-variant" />
            <p className="text-sm font-bold uppercase tracking-wider text-on-surface">
              {searchTerm 
                ? `No se encontraron categorías para "${searchTerm}"`
                : isPastMonth && budgetFilter === 'all'
                ? 'No se registraron presupuestos en este mes'
                : budgetFilter === 'alerts' 
                ? '¡Excelente! No hay categorías en alerta'
                : budgetFilter === 'active' 
                ? 'No hay objetivos activos para este mes' 
                : 'No hay categorías de gasto'}
            </p>
            {(budgetFilter !== 'all' || searchTerm) && (
              <button
                onClick={() => {
                  haptic.selection();
                  setBudgetFilter('all');
                  setSearchTerm('');
                }}
                className="text-xs font-bold text-primary hover:underline"
              >
                Limpiar filtros y ver todas
              </button>
            )}
          </div>
        ) : (
          displayedCategories.map((category) => {
            const currentAmount = localBudgets[category.id] || 0;
            const isSaving = savingMap[category.id];
            const isSuccess = successMap[category.id];

            const isEnabled = budgets.some(b => 
              b.categoryId === category.id && 
              (!b.month || b.month === budgetMonth) &&
              ((selectedProjectId === null && (!b.projectId || b.projectId === 'personal' || b.projectId === null)) || 
               (selectedProjectId !== null && b.projectId === selectedProjectId))
            );

            const spent = categorySpentMap[category.id] || 0;
            const txCount = categoryTxCountMap[category.id] || 0;
            const prevSpent = prevMonthSpentMap[category.id] || 0;
            const budgetVal = typeof currentAmount === 'string' ? parseFormattedAmount(currentAmount) : Number(currentAmount || 0);
            const percent = budgetVal > 0 ? (spent / budgetVal) * 100 : 0;
            const isOver = isEnabled && budgetVal > 0 && spent > budgetVal;
            const remainingCat = budgetVal - spent;
            const safeDaily = (remainingCat > 0 && daysRemainingInMonth > 0) 
              ? Math.floor(remainingCat / daysRemainingInMonth) 
              : 0;
            
            return (
              <div 
                key={`${category.id}-${selectedProjectId}`}
                className={cn(
                  "group bg-surface-container-lowest border rounded-2xl p-4 sm:p-5 transition-all duration-150 shadow-2xs space-y-3",
                  isOver 
                    ? "border-rose-500/25 bg-rose-500/[0.015]" 
                    : "border-on-surface/5 hover:border-on-surface/15",
                  (!isEnabled && isEditableMonth) && "opacity-75 bg-surface-container-lowest/60"
                )}
              >
                {/* TIER 1: Identity & Full Category Title (Full Width - Never Truncated) */}
                <div className="flex items-start justify-between gap-3">
                  <div 
                    onClick={() => {
                      haptic.light();
                      setBreakdownCategory(category);
                    }}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none"
                    title="Toca para ver movimientos del mes"
                  >
                    <div className={cn(
                      "w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-2xs shrink-0 transition-transform group-hover:scale-105", 
                      isEnabled ? category.color : "bg-on-surface/10 text-on-surface/40"
                    )}>
                      <IconComponent name={category.icon} size={22} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="font-extrabold text-on-surface text-sm sm:text-base tracking-tight break-words group-hover:text-primary transition-colors leading-snug">
                        {category.name}
                      </h4>
                      <p className="text-[11px] text-on-surface-variant/60 font-medium mt-0.5">
                        {txCount === 0 ? 'Sin movimientos en el mes' : `${txCount} ${txCount === 1 ? 'movimiento' : 'movimientos'}`}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0 pt-0.5">
                    {isEnabled && budgetVal > 0 ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 shadow-2xs",
                          isOver 
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" 
                            : percent >= 80 
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" 
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        )}>
                          {isOver && <AlertTriangle size={11} />}
                          {isOver ? `+${(percent - 100).toFixed(0)}% excedido` : `${percent.toFixed(0)}% consumido`}
                        </span>

                        {isCurrentMonth && !isOver && spent > 0 && (
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-tight inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md",
                            (spent / budgetVal) > (monthElapsedRatio * 1.15)
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          )}>
                            {(spent / budgetVal) > (monthElapsedRatio * 1.15) ? (
                              <>
                                <Flame size={10} className="shrink-0" />
                                <span>Ritmo acelerado</span>
                              </>
                            ) : (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                                <span>Ritmo óptimo</span>
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    ) : !isEnabled ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-on-surface/5 text-on-surface-variant/40 text-[10px] font-bold uppercase tracking-wider">
                        Sin Meta
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                        Activo
                      </span>
                    )}
                  </div>
                </div>

                {/* TIER 2: Amounts & Progress (Gastado vs Meta) */}
                <div className="pt-2.5 border-t border-on-surface/5 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    {/* Spent */}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/50 block">
                        Gastado
                      </span>
                      <span className={cn(
                        "font-headline font-black text-sm sm:text-base tracking-tight",
                        isOver ? "text-rose-600 dark:text-rose-400" : "text-on-surface"
                      )}>
                        {formatCurrency(spent, activeCurrency)}
                      </span>
                    </div>

                    {/* Target Amount - Tap to Edit (Mobile-first Fintech) */}
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/50 block">
                        Presupuesto
                      </span>
                      {!isEnabled || budgetVal === 0 ? (
                        isEditableMonth ? (
                          <button
                            type="button"
                            onClick={() => openEditModal(category)}
                            className="mt-0.5 px-3 py-1 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black transition-all active:scale-95 inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                          >
                            <span>+ Asignar meta</span>
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-on-surface-variant/40 mt-0.5 block">
                            Sin meta
                          </span>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (isEditableMonth) {
                              openEditModal(category);
                            }
                          }}
                          disabled={!isEditableMonth}
                          className={cn(
                            "mt-0.5 px-2.5 py-1 rounded-xl font-headline font-black text-sm sm:text-base tracking-tight transition-all inline-flex items-center gap-1.5",
                            isEditableMonth 
                              ? "bg-surface-container-low hover:bg-surface-container-high text-on-surface active:scale-95 border border-on-surface/5 shadow-2xs cursor-pointer group/btn" 
                              : "text-on-surface/80 cursor-default"
                          )}
                          title={isEditableMonth ? "Toca para modificar presupuesto" : undefined}
                        >
                          <span>{formatCurrency(budgetVal, activeCurrency)}</span>
                          {isEditableMonth && (
                            <Pencil size={11} className="text-on-surface-variant/40 group-hover/btn:text-primary transition-colors" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar (Only when budget is set) */}
                  {isEnabled && budgetVal > 0 && (
                    <div className="relative h-2 w-full bg-on-surface/5 rounded-full overflow-hidden mt-1">
                      <div
                        style={{ width: `${Math.min(percent, 100)}%` }}
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          isOver 
                            ? "bg-rose-500" 
                            : percent >= 80 
                            ? "bg-amber-500" 
                            : "bg-emerald-500"
                        )}
                      />
                      {isCurrentMonth && (
                        <div 
                          style={{ left: `${monthElapsedRatio * 100}%` }}
                          className="absolute top-0 bottom-0 w-0.5 bg-on-surface/35 z-10 pointer-events-none"
                          title={`Día actual: ${currentDay}`}
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* TIER 3: Metrics & Action (Disponible / Excedido + Ver detalle) */}
                {isEnabled && budgetVal > 0 && (
                  <div className="pt-2 border-t border-on-surface/5 flex items-center justify-between text-xs">
                    <div>
                      {isOver ? (
                        <span className="text-rose-600 dark:text-rose-400 font-black text-xs">
                          +{formatCurrency(spent - budgetVal, activeCurrency)} excedido
                        </span>
                      ) : (
                        <span className="text-on-surface-variant/70 text-xs font-medium">
                          Disponible: <strong className="text-on-surface font-black">{formatCurrency(remainingCat, activeCurrency)}</strong>
                        </span>
                      )}
                    </div>

                    <button 
                      onClick={() => {
                        haptic.light();
                        setBreakdownCategory(category);
                      }}
                      className="flex items-center gap-0.5 text-xs font-bold text-primary hover:text-primary-dark transition-colors px-1 py-0.5 rounded-lg active:scale-95 cursor-pointer"
                      title="Ver detalle de movimientos"
                    >
                      <span>Ver detalle</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Category Breakdown Centered Modal */}
      <AnimatePresence>
        {breakdownCategory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              onClick={() => setBreakdownCategory(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Centered Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-lg bg-surface-container-lowest rounded-[2rem] border border-on-surface/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10 my-auto"
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-on-surface/5 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xs", 
                    breakdownCategory.color
                  )}>
                    <IconComponent name={breakdownCategory.icon} size={22} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-on-surface text-base sm:text-lg uppercase tracking-tight truncate">
                      {breakdownCategory.name}
                    </h3>
                    <p className="text-xs text-on-surface-variant/60 font-semibold">
                      {currentMonthDisplay} • {breakdownTransactions.length} {breakdownTransactions.length === 1 ? 'movimiento' : 'movimientos'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setBreakdownCategory(null)}
                  className="w-9 h-9 rounded-full bg-on-surface/5 hover:bg-on-surface/10 flex items-center justify-center text-on-surface-variant transition-colors active:scale-95 shrink-0"
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Total spending summary banner with Average Ticket */}
              {(() => {
                const cSpent = categorySpentMap[breakdownCategory.id] || 0;
                const avgExpense = breakdownTransactions.length > 0 ? (cSpent / breakdownTransactions.length) : 0;
                const currentAmount = localBudgets[breakdownCategory.id] || 0;
                const bVal = typeof currentAmount === 'string' ? parseFormattedAmount(currentAmount) : Number(currentAmount || 0);
                const isOver = bVal > 0 && cSpent > bVal;

                return (
                  <div className="px-5 py-3.5 bg-surface-container-low/60 flex items-center justify-between border-b border-on-surface/5">
                    <div>
                      <span className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-wider block">
                        Total gastado en el mes
                      </span>
                      <span className="text-lg font-black text-on-surface font-headline">
                        {formatCurrency(cSpent, activeCurrency)}
                      </span>
                      {avgExpense > 0 && breakdownTransactions.length > 1 && (
                        <span className="text-[10px] text-on-surface-variant/70 font-semibold block mt-0.5">
                          Promedio: <strong className="text-on-surface font-bold">~{formatCurrency(Math.round(avgExpense), activeCurrency)}</strong> / compra
                        </span>
                      )}
                    </div>

                    {bVal > 0 && (
                      <div className="text-right">
                        <span className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-wider block">
                          Presupuesto
                        </span>
                        <span className={cn(
                          "text-xs font-black px-2.5 py-0.5 rounded-full inline-block mt-0.5",
                          isOver ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        )}>
                          {isOver ? `+${formatCurrency(cSpent - bVal, activeCurrency)} excedido` : `${formatCurrency(bVal - cSpent, activeCurrency)} restante`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Transactions list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
                {breakdownTransactions.length === 0 ? (
                  <div className="text-center py-12 text-on-surface-variant/40 space-y-2">
                    <Receipt size={36} className="mx-auto opacity-40" />
                    <p className="text-xs font-bold uppercase tracking-wider">No hay movimientos registrados en este mes</p>
                  </div>
                ) : (
                  breakdownTransactions.map(t => {
                    const tDate = t.date instanceof Date ? t.date : new Date(t.date);
                    const formattedDate = !isNaN(tDate.getTime()) 
                      ? tDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
                      : '';
                    const payInfo = getPaymentMethodInfo(t);

                    return (
                      <div 
                        key={t.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-low/50 hover:bg-surface-container-high/60 transition-colors border border-on-surface/5"
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <p className="text-xs font-extrabold text-on-surface truncate">
                            {t.description || 'Gasto sin descripción'}
                          </p>
                          <p className="text-[10px] text-on-surface-variant/60 font-semibold flex items-center flex-wrap gap-1.5 mt-0.5">
                            <span>{formattedDate}</span>
                            {payInfo.label && (
                              <span className="px-1.5 py-0.2 rounded bg-on-surface/5 text-on-surface-variant/80 text-[9px] font-bold inline-flex items-center gap-1">
                                {payInfo.isCard && <CardIcon size={9} />}
                                {payInfo.label}
                              </span>
                            )}
                            {(t as any).installmentNumber && (
                              <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary text-[9px] font-bold">
                                Cuota {(t as any).installmentNumber}/{(t as any).installmentTotal}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs sm:text-sm font-black text-on-surface font-headline">
                            -{formatCurrency(t.amount, activeCurrency)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tap-to-Edit Budget Modal (Mobile-friendly Centered Dialog) */}
      <AnimatePresence>
        {editingCategory && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              onClick={() => setEditingCategory(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Modal Dialog Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-md bg-surface-container-lowest rounded-[2.5rem] border border-on-surface/10 shadow-2xl p-5 sm:p-6 z-10 overflow-y-auto no-scrollbar flex flex-col gap-5 max-h-[85dvh] my-auto"
            >

              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xs shrink-0",
                    editingCategory.color
                  )}>
                    <IconComponent name={editingCategory.icon} size={24} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-wider block">
                      Presupuesto Mensual
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-on-surface truncate">
                      {editingCategory.name}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="w-9 h-9 rounded-full bg-on-surface/5 hover:bg-on-surface/10 flex items-center justify-center text-on-surface-variant transition-colors shrink-0"
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Big Hero Amount Input */}
              <div className="bg-surface-container-low/70 rounded-2xl p-4 sm:p-5 border border-on-surface/5 text-center space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/60 block">
                  Límite deseado para {currentMonthDisplay}
                </span>

                <div className="flex items-center justify-center gap-2 py-1">
                  <span className="text-xl sm:text-2xl font-black text-on-surface-variant/40 font-headline pointer-events-none select-none">
                    {activeCurrency}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    value={editSheetAmount}
                    onChange={(e) => {
                      const { display } = formatCurrencyInput(e.target.value);
                      setEditSheetAmount(display);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    placeholder="0"
                    className="w-full max-w-[240px] text-center font-headline font-black text-3xl sm:text-4xl text-on-surface bg-transparent border-b-2 border-primary/30 focus:border-primary focus:outline-hidden transition-colors"
                  />
                </div>

                {/* Context Helper info */}
                <div className="pt-2 flex items-center justify-center flex-wrap gap-2 text-xs text-on-surface-variant/70 font-semibold border-t border-on-surface/5">
                  <span>Gastado este mes: <strong className="text-on-surface font-extrabold">{formatCurrency(categorySpentMap[editingCategory.id] || 0, activeCurrency)}</strong></span>
                  {prevMonthSpentMap[editingCategory.id] > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        haptic.selection();
                        setEditSheetAmount(formatAmountForDisplay(prevMonthSpentMap[editingCategory.id]));
                      }}
                      className="text-primary hover:underline font-bold text-[11px] inline-flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-lg active:scale-95 transition-all cursor-pointer"
                      title="Usar el gasto real del mes pasado como referencia"
                    >
                      <Calendar size={11} />
                      <span>Gasto mes ant: {formatCurrency(prevMonthSpentMap[editingCategory.id], activeCurrency)}</span>
                    </button>
                  )}
                  {avg3MonthSpentMap[editingCategory.id] > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        haptic.selection();
                        setEditSheetAmount(formatAmountForDisplay(avg3MonthSpentMap[editingCategory.id]));
                      }}
                      className="text-primary hover:underline font-bold text-[11px] inline-flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-lg active:scale-95 transition-all cursor-pointer"
                      title="Usar promedio de gasto de los últimos 3 meses"
                    >
                      <Sparkles size={11} />
                      <span>Prom 3M: {formatCurrency(avg3MonthSpentMap[editingCategory.id], activeCurrency)}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={isSavingSheet}
                  onClick={async () => {
                    haptic.success();
                    setIsSavingSheet(true);
                    const numVal = parseFormattedAmount(editSheetAmount);
                    setLocalBudgets(prev => ({ ...prev, [editingCategory.id]: editSheetAmount }));
                    await handleSave(editingCategory.id, numVal);
                    setIsSavingSheet(false);
                    setEditingCategory(null);
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl bg-primary hover:bg-primary/90 text-on-primary font-headline font-black text-sm uppercase tracking-wider transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSavingSheet ? (
                    <div className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check size={18} />
                      <span>Guardar Presupuesto</span>
                    </>
                  )}
                </button>

                {/* Delete budget option if category has an active budget */}
                {budgets.some(b => 
                  b.categoryId === editingCategory.id && 
                  (!b.month || b.month === budgetMonth) && 
                  b.amount > 0 &&
                  ((selectedProjectId === null && (!b.projectId || b.projectId === 'personal' || b.projectId === null)) || 
                   (selectedProjectId !== null && b.projectId === selectedProjectId))
                ) && (
                  <button
                    type="button"
                    disabled={isSavingSheet}
                    onClick={async () => {
                      haptic.medium();
                      setIsSavingSheet(true);
                      setLocalBudgets(prev => {
                        const next = { ...prev };
                        delete next[editingCategory.id];
                        return next;
                      });
                      await handleSave(editingCategory.id, 0, true);
                      setIsSavingSheet(false);
                      setEditingCategory(null);
                    }}
                    className="w-full py-2.5 px-4 text-center text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/5 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={13} />
                    <span>Eliminar meta de esta categoría</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Smart Copy & 3M Predictor Assistant Modal */}
      <AnimatePresence>
        {showCopyModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              onClick={() => setShowCopyModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Modal Dialog Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-lg bg-surface-container-lowest rounded-[2.5rem] border border-on-surface/10 shadow-2xl p-5 sm:p-6 z-10 overflow-y-auto no-scrollbar flex flex-col gap-4 max-h-[85dvh] my-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-on-surface/5 pb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs shrink-0">
                    <Wand2 size={22} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-on-surface text-base sm:text-lg font-headline tracking-tight truncate">
                      Asistente de Presupuesto
                    </h3>
                    <p className="text-xs text-on-surface-variant/60 font-semibold truncate">
                      Copia el mes anterior o aplica promedios de 3 meses
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCopyModal(false)}
                  className="w-9 h-9 rounded-full bg-on-surface/5 hover:bg-on-surface/10 flex items-center justify-center text-on-surface-variant transition-colors shrink-0"
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Mass Selection Controls */}
              <div className="flex items-center justify-between text-xs px-0.5">
                <span className="font-bold text-on-surface-variant/70">
                  {copyItems.filter(i => i.selected).length} de {copyItems.length} seleccionadas
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      haptic.selection();
                      setCopyItems(prev => prev.map(i => ({ ...i, selected: true })));
                    }}
                    className="text-[11px] font-black text-primary hover:underline cursor-pointer"
                  >
                    Seleccionar todas
                  </button>
                  <span className="text-on-surface-variant/30">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      haptic.selection();
                      setCopyItems(prev => prev.map(i => ({ ...i, selected: false })));
                    }}
                    className="text-[11px] font-bold text-on-surface-variant/60 hover:text-on-surface cursor-pointer"
                  >
                    Deseleccionar
                  </button>
                </div>
              </div>

              {/* Category Cards List (Interactive Fintech Cards - Option A) */}
              <div className="space-y-2.5 overflow-y-auto max-h-[46vh] pr-0.5 no-scrollbar">
                {copyItems.map((item) => {
                  return (
                    <div
                      key={item.categoryId}
                      className={cn(
                        "rounded-2xl p-3 border transition-all select-none space-y-2",
                        item.selected 
                          ? "bg-surface-container-low/70 border-primary/25 shadow-2xs" 
                          : "bg-surface-container-lowest/40 border-on-surface/5 opacity-45"
                      )}
                    >
                      {/* Top row: Checkmark + Category + Inline Amount Edit */}
                      <div 
                        onClick={() => {
                          haptic.selection();
                          setCopyItems(prev => prev.map(i => i.categoryId === item.categoryId ? { ...i, selected: !i.selected } : i));
                        }}
                        className="flex items-center justify-between gap-2.5 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {/* Circular iOS Checkmark */}
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center transition-all shrink-0",
                            item.selected ? "bg-primary text-white shadow-xs" : "border-2 border-on-surface/20"
                          )}>
                            {item.selected && <Check size={14} />}
                          </div>

                          <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs", item.categoryColor)}>
                            <IconComponent name={item.categoryIcon} size={16} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <span className="font-extrabold text-xs sm:text-sm text-on-surface block leading-snug break-words">
                              {item.categoryName}
                            </span>
                            {item.existingAmount > 0 && (
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block">
                                Ya tiene meta: {formatCurrency(item.existingAmount, activeCurrency)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Inline Editable Amount */}
                        <div 
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 flex items-center gap-1 bg-surface-container-lowest/90 border border-on-surface/10 rounded-xl px-2 py-1 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all"
                        >
                          <span className="text-[10px] font-black text-on-surface-variant/40 select-none">
                            {activeCurrency}
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            disabled={!item.selected}
                            value={item.chosenDisplay}
                            onChange={(e) => {
                              const { display, numeric } = formatCurrencyInput(e.target.value);
                              setCopyItems(prev => prev.map(i => 
                                i.categoryId === item.categoryId 
                                  ? { ...i, chosenAmount: numeric, chosenDisplay: display, source: 'custom' } 
                                  : i
                              ));
                            }}
                            placeholder="0"
                            className="w-20 sm:w-24 text-right font-headline font-black text-xs sm:text-sm text-on-surface bg-transparent focus:outline-hidden"
                          />
                        </div>
                      </div>

                      {/* Source Pills (Mes anterior vs Promedio 3m) */}
                      {item.selected && (
                        <div className="flex items-center justify-end flex-wrap gap-1.5 pt-1.5 border-t border-on-surface/5">
                          {item.prevAmount > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                haptic.selection();
                                setCopyItems(prev => prev.map(i => 
                                  i.categoryId === item.categoryId 
                                    ? { ...i, chosenAmount: item.prevAmount, chosenDisplay: formatAmountForDisplay(item.prevAmount), source: 'prev' } 
                                    : i
                                ));
                              }}
                              className={cn(
                                "px-2 py-0.5 rounded-lg text-[10px] font-black transition-all active:scale-95 inline-flex items-center gap-1 cursor-pointer",
                                item.source === 'prev' 
                                  ? "bg-primary text-white shadow-2xs" 
                                  : "bg-on-surface/5 text-on-surface-variant hover:bg-on-surface/10"
                              )}
                            >
                              <Calendar size={10} />
                              <span>Presup. ant: {formatCurrency(item.prevAmount, activeCurrency)}</span>
                            </button>
                          )}

                          {item.avg3mAmount > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                haptic.selection();
                                setCopyItems(prev => prev.map(i => 
                                  i.categoryId === item.categoryId 
                                    ? { ...i, chosenAmount: item.avg3mAmount, chosenDisplay: formatAmountForDisplay(item.avg3mAmount), source: 'avg' } 
                                    : i
                                ));
                              }}
                              className={cn(
                                "px-2 py-0.5 rounded-lg text-[10px] font-black transition-all active:scale-95 inline-flex items-center gap-1 cursor-pointer",
                                item.source === 'avg' 
                                  ? "bg-primary text-white shadow-2xs" 
                                  : "bg-on-surface/5 text-on-surface-variant hover:bg-on-surface/10"
                              )}
                            >
                              <Sparkles size={10} />
                              <span>Prom 3M: {formatCurrency(item.avg3mAmount, activeCurrency)}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Total Summary & Apply Button */}
              {(() => {
                const selectedItems = copyItems.filter(i => i.selected && i.chosenAmount > 0);
                const totalBatch = selectedItems.reduce((sum, i) => sum + i.chosenAmount, 0);

                return (
                  <div className="pt-2 border-t border-on-surface/5 space-y-3">
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="font-bold text-on-surface-variant/70">Total a presupuestar:</span>
                      <span className="font-headline font-black text-base text-on-surface">
                        {formatCurrency(totalBatch, activeCurrency)}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isApplyingBatch || selectedItems.length === 0}
                      onClick={handleApplyBatchBudgets}
                      className="w-full py-3.5 px-4 rounded-2xl bg-primary hover:bg-primary/90 text-on-primary font-headline font-black text-sm uppercase tracking-wider transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isApplyingBatch ? (
                        <div className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                      ) : (
                        <>
                          <Check size={18} />
                          <span>Aplicar {selectedItems.length} {selectedItems.length === 1 ? 'Presupuesto' : 'Presupuestos'}</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="pt-8 text-center">
        <p className="text-[10px] font-black text-on-surface-variant/20 uppercase tracking-[0.3em]">FinApp Budgeting Engine v2.1</p>
      </footer>
    </div>
  );
};
