import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Target, Save, Check, AlertCircle, ChevronLeft, ChevronRight, Copy,
  ShoppingBag, Utensils, Car, Play, Heart, Book, MoreHorizontal, 
  Landmark, Tag, Gift, Briefcase, Home as HomeIcon, Plane, Coffee, Zap, Smartphone, ShieldCheck,
  ShoppingCart, Hotel, CheckCircle2, TrendingUp, AlertTriangle, Sparkles, Receipt, X
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
  const { categories, budgets, projects, budgetMonth, setBudgetMonth, transactions } = useData();
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [successMap, setSuccessMap] = useState<Record<string, boolean>>({});
  const [localBudgets, setLocalBudgets] = useState<Record<string, string>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>('all');
  const [breakdownCategory, setBreakdownCategory] = useState<Category | null>(null);

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
  const isCurrentMonth = budgetMonth === getLocalMonth();

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

  // Filtered and sorted category list for display
  const displayedCategories = useMemo(() => {
    let list = [...expenseCategories];

    if (budgetFilter === 'alerts') {
      list = list.filter(cat => {
        const budgetObj = budgets.find(b => 
          b.categoryId === cat.id && 
          (!b.month || b.month === budgetMonth) &&
          ((selectedProjectId === null && (!b.projectId || b.projectId === 'personal' || b.projectId === null)) || 
           (selectedProjectId !== null && b.projectId === selectedProjectId))
        );
        if (!budgetObj || budgetObj.amount <= 0) return false;
        const spent = categorySpentMap[cat.id] || 0;
        return spent >= budgetObj.amount * 0.8;
      });
    } else if (budgetFilter === 'active') {
      list = list.filter(cat => {
        return budgets.some(b => 
          b.categoryId === cat.id && 
          (!b.month || b.month === budgetMonth) &&
          ((selectedProjectId === null && (!b.projectId || b.projectId === 'personal' || b.projectId === null)) || 
           (selectedProjectId !== null && b.projectId === selectedProjectId)) &&
          b.amount > 0
        );
      });
    } else if (budgetFilter === 'top_spent') {
      list.sort((a, b) => (categorySpentMap[b.id] || 0) - (categorySpentMap[a.id] || 0));
    }

    return list;
  }, [expenseCategories, budgetFilter, budgets, budgetMonth, selectedProjectId, categorySpentMap]);

  const handleSave = async (categoryId: string, rawAmount: number | string, isDelete: boolean = false) => {
    setSavingMap(prev => ({ ...prev, [categoryId]: true }));
    const amount = typeof rawAmount === 'string' ? parseFormattedAmount(rawAmount) : rawAmount;
    try {
      if (isDelete) {
        await deleteBudget(categoryId, budgetMonth, selectedProjectId);
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
    if (!isCurrentMonth) return;
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

  const copyFromLastMonth = async () => {
    if (copying) return;
    setCopying(true);
    haptic.light();
    try {
      const d = parseLocalMonth(budgetMonth);
      d.setMonth(d.getMonth() - 1);
      const prevMonthStr = getLocalMonth(d);
      
      const projectIds = activeProjects.map(p => p.id);
      const prevBudgets = await getBudgetsOnce(prevMonthStr, projectIds);
      
      const filteredPrev = prevBudgets.filter(b => 
        (selectedProjectId === null && (!b.projectId || b.projectId === 'personal')) ||
        (selectedProjectId !== null && b.projectId === selectedProjectId)
      );

      if (filteredPrev.length === 0) {
        toast.warning('No se encontraron presupuestos en el mes anterior');
        return;
      }

      for (const b of filteredPrev) {
        await updateBudget(b.categoryId, budgetMonth, b.amount, b.projectId);
      }
      
      haptic.success();
      toast.success(`Se copiaron ${filteredPrev.length} presupuestos con éxito`);
    } catch (err) {
      console.error(err);
      haptic.error();
      toast.error('Error al copiar presupuestos');
    } finally {
      setCopying(false);
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
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
              isCurrentMonth
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
            )}>
              {currentMonthDisplay} {!isCurrentMonth && '• Histórico'}
            </span>
          </div>
        }
      />

      {/* Month Navigator */}
      <section className="flex items-center justify-between bg-surface-container-low p-2 rounded-2xl border border-on-surface/5 shadow-xs">
        <button 
          onClick={handlePrevMonth}
          className="w-10 h-10 rounded-xl hover:bg-on-surface/5 flex items-center justify-center text-on-surface-variant transition-colors active:scale-95"
          title="Mes anterior"
        >
          <ChevronLeft size={20} />
        </button>
        <div 
          className="text-center group cursor-pointer" 
          onClick={() => {
            haptic.selection();
            setBudgetMonth(getLocalMonth());
          }}
          title="Volver al mes actual"
        >
          <p className="text-[10px] font-black uppercase text-on-surface-variant/40 group-hover:text-primary transition-colors italic">Snap to Present</p>
          <p className="text-xs font-bold text-on-surface uppercase tracking-tight">{currentMonthDisplay}</p>
        </div>
        <button 
          onClick={handleNextMonth}
          className="w-10 h-10 rounded-xl hover:bg-on-surface/5 flex items-center justify-center text-on-surface-variant transition-colors active:scale-95"
          title="Mes siguiente"
        >
          <ChevronRight size={20} />
        </button>
      </section>

      {/* Project Selector (Only Active Projects) */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {isPersonalActive && (
            <button
              onClick={() => {
                haptic.selection();
                setSelectedProjectId(null);
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all shrink-0 active:scale-95",
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
                "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all shrink-0 active:scale-95",
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

      {/* Hero: Global Budget Execution Summary Card */}
      {budgetSummary.hasBudgets && (
        <section className="bg-gradient-to-br from-surface-container-lowest via-surface-container-low to-surface-container-low p-5 sm:p-6 rounded-[2rem] border border-on-surface/10 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-44 h-44 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
                <Target size={20} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/60 block">
                  Ejecución del Mes
                </span>
                <h3 className="text-base font-black text-on-surface font-headline tracking-tight">
                  {selectedProjectId ? (activeProject?.name || 'Proyecto') : 'Presupuesto Personal'}
                </h3>
              </div>
            </div>

            <div className="text-right">
              <span className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1",
                budgetSummary.rawPercent > 100 
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" 
                  : budgetSummary.rawPercent >= 80 
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" 
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              )}>
                {budgetSummary.rawPercent > 100 && <AlertTriangle size={12} />}
                {budgetSummary.rawPercent.toFixed(0)}% Utilizado
              </span>
            </div>
          </div>

          {/* Primary KPIs */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 py-3 border-y border-on-surface/5">
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/60 block mb-0.5">
                Presupuestado
              </span>
              <span className="text-sm sm:text-base font-black text-on-surface font-headline block truncate whitespace-nowrap">
                {formatCurrency(budgetSummary.totalBudget, activeCurrency)}
              </span>
              <span className="text-[10px] font-bold text-on-surface-variant/50 block">
                {budgetSummary.activeBudgetsCount} {budgetSummary.activeBudgetsCount === 1 ? 'objetivo' : 'objetivos'}
              </span>
            </div>

            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/60 block mb-0.5">
                Gastado
              </span>
              <span className={cn(
                "text-sm sm:text-base font-black font-headline block truncate whitespace-nowrap",
                budgetSummary.rawPercent > 100 ? "text-rose-600 dark:text-rose-400" : "text-on-surface"
              )}>
                {formatCurrency(budgetSummary.totalSpent, activeCurrency)}
              </span>
              <span className="text-[10px] font-bold text-on-surface-variant/50 block">
                acumulado
              </span>
            </div>

            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/60 block mb-0.5">
                {budgetSummary.remaining >= 0 ? 'Disponible' : 'Excedido'}
              </span>
              <span className={cn(
                "text-sm sm:text-base font-black font-headline block truncate whitespace-nowrap",
                budgetSummary.remaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              )}>
                {formatCurrency(Math.abs(budgetSummary.remaining), activeCurrency)}
              </span>
              <span className={cn(
                "text-[10px] font-bold block truncate",
                budgetSummary.overBudgetCount > 0 ? "text-rose-500 font-black" : "text-on-surface-variant/50"
              )}>
                {budgetSummary.overBudgetCount > 0 
                  ? `${budgetSummary.overBudgetCount} ${budgetSummary.overBudgetCount === 1 ? 'alerta' : 'alertas'}`
                  : 'En regla'}
              </span>
            </div>
          </div>

          {/* Global Animated Progress Bar */}
          <div className="mt-4 space-y-1.5">
            <div className="relative h-2.5 w-full bg-on-surface/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${budgetSummary.percentUsed}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  budgetSummary.rawPercent > 100 
                    ? "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]" 
                    : budgetSummary.rawPercent >= 80 
                    ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]" 
                    : "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                )}
              />
            </div>
          </div>
        </section>
      )}

      {/* Info & Copy Action Banner */}
      <section className="bg-primary/5 border border-primary/10 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-3 sm:gap-4 items-start">
          <div className="p-2 bg-primary rounded-xl text-white shrink-0">
            <Target size={20} />
          </div>
          <div className="space-y-0.5">
            <h3 className="font-bold text-sm text-primary uppercase tracking-tight">
              {selectedProjectId ? 'Objetivos de Proyecto' : 'Objetivos Personales'}
            </h3>
            <p className="text-xs text-on-surface-variant/70 leading-relaxed">
              Define cuánto planeas gastar en {selectedProjectId ? 'este proyecto' : 'tus gastos personales'}.
            </p>
          </div>
        </div>

        {isCurrentMonth && (
          <button
            onClick={copyFromLastMonth}
            disabled={copying}
            className="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest border border-on-surface/10 rounded-xl text-xs font-black uppercase tracking-wider text-on-surface hover:bg-on-surface/5 transition-all shadow-sm active:scale-95 shrink-0"
            title="Copiar presupuestos del mes anterior"
          >
            {copying ? (
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : (
              <Copy size={14} className="text-primary" />
            )}
            Copiar Anterior
          </button>
        )}
      </section>

      {/* Quick Filters (Modern Fintech Segmented Bar) */}
      <section className="bg-surface-container-low/70 p-1 rounded-2xl border border-on-surface/5 flex items-center gap-1 overflow-x-auto no-scrollbar shadow-2xs">
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
          Todas ({expenseCategories.length})
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
      </section>

      {/* Categories Budget List (Fintech Cards) */}
      <div className="space-y-2.5">
        {displayedCategories.length === 0 ? (
          <div className="text-center py-12 space-y-3 opacity-60 bg-surface-container-lowest rounded-2xl border border-on-surface/5">
            <AlertCircle size={36} className="mx-auto text-on-surface-variant" />
            <p className="text-sm font-bold uppercase tracking-wider text-on-surface">
              {budgetFilter === 'alerts' 
                ? '¡Excelente! No hay categorías en alerta'
                : budgetFilter === 'active' 
                ? 'No hay objetivos activos para este mes' 
                : 'No hay categorías de gasto'}
            </p>
            {budgetFilter !== 'all' && (
              <button
                onClick={() => {
                  haptic.selection();
                  setBudgetFilter('all');
                }}
                className="text-xs font-bold text-primary hover:underline"
              >
                Ver todas las categorías
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
                  "group bg-surface-container-lowest border rounded-2xl p-3.5 sm:p-4 transition-all duration-150 shadow-2xs",
                  isOver 
                    ? "border-rose-500/25 bg-rose-500/[0.015]" 
                    : "border-on-surface/5 hover:border-on-surface/15",
                  (!isEnabled && isCurrentMonth) && "opacity-75 bg-surface-container-lowest/60",
                  (!isEnabled && !isCurrentMonth) && "hidden"
                )}
              >
                {/* Header Row: Category Details + Inline Editor */}
                <div className="flex items-center justify-between gap-3">
                  {/* Category Info (Clickable for transactions drawer) */}
                  <div 
                    onClick={() => {
                      haptic.light();
                      setBreakdownCategory(category);
                    }}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none"
                    title="Toca para ver el detalle de movimientos"
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-2xs shrink-0 transition-transform group-hover:scale-105", 
                      isEnabled ? category.color : "bg-on-surface/10 text-on-surface/40"
                    )}>
                      <IconComponent name={category.icon} size={20} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-on-surface text-sm tracking-tight truncate group-hover:text-primary transition-colors">
                          {category.name}
                        </h4>
                        {isOver && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-wider shrink-0 flex items-center gap-1">
                            <AlertTriangle size={11} /> Excedido
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-on-surface-variant/60 font-semibold truncate mt-0.5">
                        {isEnabled && budgetVal > 0 ? (
                          <>
                            <span className="font-extrabold text-on-surface">{formatCurrency(spent, activeCurrency)}</span>
                            <span className="text-on-surface-variant/40 font-normal"> de </span>
                            <span>{formatCurrency(budgetVal, activeCurrency)}</span>
                            <span className="text-on-surface-variant/40"> • </span>
                            <span className={cn(
                              "font-black",
                              isOver ? "text-rose-500" : percent >= 80 ? "text-amber-500" : "text-emerald-500"
                            )}>
                              {percent.toFixed(0)}%
                            </span>
                          </>
                        ) : isEnabled ? (
                          <span className="text-primary font-bold">Límite sin definir</span>
                        ) : (
                          <span className="text-on-surface-variant/40">Sin objetivo activo</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Inline Value Input or Activation Button (Fintech Style) */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {!isEnabled ? (
                      isCurrentMonth && (
                        <button
                          onClick={async () => {
                            haptic.light();
                            const targetVal = prevSpent > 0 ? prevSpent : 0;
                            if (prevSpent > 0) {
                              const display = formatAmountForDisplay(prevSpent);
                              setLocalBudgets(prev => ({ ...prev, [category.id]: display }));
                            }
                            await handleSave(category.id, targetVal);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-surface-container-low hover:bg-primary/10 text-on-surface-variant hover:text-primary border border-on-surface/5 text-xs font-bold transition-all active:scale-95 flex items-center gap-1"
                          title="Establecer límite para esta categoría"
                        >
                          <span>+ Fijar Meta</span>
                        </button>
                      )
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {/* Modern Pill Input */}
                        <div className="relative flex items-center">
                          <span className="absolute left-2.5 text-[10px] font-black text-on-surface-variant/40 uppercase tracking-tighter pointer-events-none">
                            {activeCurrency}
                          </span>
                          <input 
                            type="text"
                            inputMode="decimal"
                            value={currentAmount || ''}
                            disabled={!isCurrentMonth}
                            onChange={(e) => {
                              const input = e.target;
                              const oldVal = input.value;
                              const oldCursor = input.selectionStart || oldVal.length;
                              const charsFromRight = oldVal.length - oldCursor;

                              const { display } = formatCurrencyInput(oldVal);
                              setLocalBudgets(prev => ({ ...prev, [category.id]: display }));

                              requestAnimationFrame(() => {
                                if (input && document.activeElement === input) {
                                  const newCursor = Math.max(0, display.length - charsFromRight);
                                  input.setSelectionRange(newCursor, newCursor);
                                }
                              });
                            }}
                            onBlur={() => handleAutoSave(category.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            placeholder="0"
                            className={cn(
                              "w-28 sm:w-32 pl-9 pr-3 py-1.5 rounded-xl text-right font-headline font-black text-sm text-on-surface transition-all",
                              "bg-surface-container-low hover:bg-surface-container-high focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/25",
                              !isCurrentMonth && "opacity-80 bg-transparent pr-0"
                            )}
                          />
                        </div>

                        {/* Status feedback (saving spinner or checkmark or deactivation cross) */}
                        {isSaving ? (
                          <div className="w-6 h-6 flex items-center justify-center">
                            <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                          </div>
                        ) : isSuccess ? (
                          <div className="w-6 h-6 flex items-center justify-center text-emerald-500 animate-in fade-in zoom-in duration-200">
                            <Check size={16} />
                          </div>
                        ) : (
                          isCurrentMonth && (
                            <button
                              onClick={async () => {
                                haptic.light();
                                await handleSave(category.id, 0, true);
                              }}
                              className="w-7 h-7 rounded-lg hover:bg-on-surface/5 flex items-center justify-center text-on-surface-variant/30 hover:text-rose-500 transition-colors"
                              title="Desactivar objetivo"
                            >
                              <X size={14} />
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Suggested Budget Micro-chip if unconfigured & spent last month */}
                {isCurrentMonth && isEnabled && budgetVal === 0 && prevSpent > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-on-surface/5 flex items-center justify-between">
                    <span className="text-[11px] text-on-surface-variant/60 font-medium">
                      Gastaste <strong>{formatCurrency(prevSpent, activeCurrency)}</strong> el mes anterior
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        haptic.selection();
                        const display = formatAmountForDisplay(prevSpent);
                        setLocalBudgets(prev => ({ ...prev, [category.id]: display }));
                        handleSave(category.id, prevSpent);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold transition-all active:scale-95"
                    >
                      <Sparkles size={11} />
                      <span>Fijar como meta</span>
                    </button>
                  </div>
                )}

                {/* Progress Bar & Modern Fintech Footer */}
                {isEnabled && budgetVal > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-on-surface/5 space-y-1.5">
                    {/* Slim Progress Bar */}
                    <div className="relative h-1.5 w-full bg-on-surface/5 rounded-full overflow-hidden">
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
                    </div>

                    {/* Concise Metrics */}
                    <div className="flex items-center justify-between text-xs pt-0.5">
                      <div>
                        {isOver ? (
                          <span className="text-rose-600 dark:text-rose-400 font-black text-[11px]">
                            +{formatCurrency(spent - budgetVal, activeCurrency)} excedido
                          </span>
                        ) : (
                          <span className="text-on-surface-variant/70 text-[11px] font-medium">
                            Disponible: <strong className="text-on-surface font-black">{formatCurrency(remainingCat, activeCurrency)}</strong>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isCurrentMonth && remainingCat > 0 && daysRemainingInMonth > 0 && (
                          <span 
                            className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                            title={`Gasto diario recomendado (${daysRemainingInMonth} días restantes)`}
                          >
                            <Zap size={10} />
                            ~{formatCurrency(safeDaily, activeCurrency)}/día
                          </span>
                        )}

                        <button 
                          onClick={() => {
                            haptic.light();
                            setBreakdownCategory(category);
                          }}
                          className="flex items-center gap-0.5 text-[11px] font-bold text-on-surface-variant/40 hover:text-primary transition-colors"
                          title="Ver movimientos"
                        >
                          <span>Ver</span>
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Category Breakdown Bottom Sheet Drawer */}
      <AnimatePresence>
        {breakdownCategory && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setBreakdownCategory(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] flex flex-col bg-surface-container-lowest rounded-t-[2.5rem] border-t border-on-surface/10 shadow-2xl overflow-hidden max-w-xl mx-auto"
            >
              {/* Drawer Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-on-surface/20" />
              </div>

              {/* Drawer header */}
              <div className="px-5 py-3 border-b border-on-surface/5 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm", breakdownCategory.color)}>
                    <IconComponent name={breakdownCategory.icon} size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-on-surface text-base uppercase tracking-tight truncate">
                      {breakdownCategory.name}
                    </h3>
                    <p className="text-xs text-on-surface-variant/60 font-medium">
                      {currentMonthDisplay} • {breakdownTransactions.length} {breakdownTransactions.length === 1 ? 'movimiento' : 'movimientos'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setBreakdownCategory(null)}
                  className="w-9 h-9 rounded-full bg-on-surface/5 hover:bg-on-surface/10 flex items-center justify-center text-on-surface-variant transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Total spending summary in modal */}
              <div className="px-5 py-3 bg-surface-container-low/50 flex items-center justify-between border-b border-on-surface/5">
                <span className="text-xs font-bold text-on-surface-variant/70 uppercase tracking-wider">Total consumido</span>
                <span className="text-base font-black text-on-surface font-headline">
                  {formatCurrency(categorySpentMap[breakdownCategory.id] || 0, activeCurrency)}
                </span>
              </div>

              {/* Transactions list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {breakdownTransactions.length === 0 ? (
                  <div className="text-center py-10 text-on-surface-variant/40 space-y-2">
                    <Receipt size={32} className="mx-auto opacity-50" />
                    <p className="text-xs font-bold uppercase tracking-wider">No hay movimientos en este mes</p>
                  </div>
                ) : (
                  breakdownTransactions.map(t => {
                    const tDate = t.date instanceof Date ? t.date : new Date(t.date);
                    const formattedDate = !isNaN(tDate.getTime()) 
                      ? tDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
                      : '';
                    return (
                      <div 
                        key={t.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low/60 hover:bg-surface-container-high/60 transition-colors border border-on-surface/5"
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <p className="text-xs font-extrabold text-on-surface truncate">
                            {t.description || 'Gasto sin descripción'}
                          </p>
                          <p className="text-[10px] text-on-surface-variant/60 font-semibold flex items-center gap-1.5 mt-0.5">
                            <span>{formattedDate}</span>
                            {(t as any).installmentNumber && (
                              <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary text-[9px] font-bold">
                                Cuota {(t as any).installmentNumber}/{(t as any).installmentTotal}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-on-surface font-headline">
                            -{formatCurrency(t.amount, activeCurrency)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <footer className="pt-8 text-center">
        <p className="text-[10px] font-black text-on-surface-variant/20 uppercase tracking-[0.3em]">FinApp Budgeting Engine v2.1</p>
      </footer>
    </div>
  );
};
