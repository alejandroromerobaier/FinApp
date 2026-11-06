import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, Target, Save, Check, AlertCircle, ChevronLeft, ChevronRight, Copy,
  ShoppingBag, Utensils, Car, Play, Heart, Book, MoreHorizontal, 
  Landmark, Tag, Gift, Briefcase, Home as HomeIcon, Plane, Coffee, Zap, Smartphone, ShieldCheck,
  ShoppingCart, Hotel, CheckCircle2, TrendingUp, AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../context/ToastContext';
import { haptic } from '../lib/haptics';
import { updateBudget, deleteBudget, getBudgetsOnce } from '../services/firestoreService';
import { getLocalMonth, parseLocalMonth } from '../lib/dateUtils';
import { formatCurrency, cn, formatCurrencyInput, formatAmountForDisplay, parseFormattedAmount } from '../lib/utils';

const ICON_MAP: Record<string, any> = {
  ShoppingBag, Utensils, Car, Play, Heart, Book, MoreHorizontal, 
  Landmark, Tag, Gift, Briefcase, Home: HomeIcon, Plane, Coffee, Zap, Smartphone, ShieldCheck,
  ShoppingCart, Hotel, Target
};

const IconComponent = ({ name, size = 20 }: { name: string, size?: number }) => {
  const Icon = ICON_MAP[name] || Target;
  return <Icon size={size} />;
};

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
    <div className="px-4 sm:px-6 max-w-2xl mx-auto py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Header */}
      <header className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors active:scale-95"
          title="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-on-surface font-headline uppercase leading-none">Presupuestos</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className={cn(
              "text-[10px] font-black uppercase tracking-[0.2em] transition-colors",
              isCurrentMonth ? "text-primary" : "text-on-surface-variant/40"
            )}>
              {currentMonthDisplay}
            </p>
            {!isCurrentMonth && (
              <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">Histórico</span>
            )}
          </div>
        </div>
      </header>

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

      {/* Categories Budget List */}
      <div className="space-y-3">
        {expenseCategories.length === 0 ? (
          <div className="text-center py-12 space-y-3 opacity-40">
            <AlertCircle size={40} className="mx-auto" />
            <p className="text-sm font-bold uppercase tracking-widest">No hay categorías de gasto</p>
          </div>
        ) : (
          expenseCategories.map((category) => {
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
            const budgetVal = typeof currentAmount === 'string' ? parseFormattedAmount(currentAmount) : Number(currentAmount || 0);
            const percent = budgetVal > 0 ? (spent / budgetVal) * 100 : 0;
            const isOver = isEnabled && budgetVal > 0 && spent > budgetVal;
            const remainingCat = budgetVal - spent;
            
            return (
              <motion.div 
                key={`${category.id}-${selectedProjectId}`}
                layout
                className={cn(
                  "bg-surface-container-lowest border p-4 sm:p-5 rounded-2xl shadow-sm transition-all",
                  isOver 
                    ? "border-rose-500/30 bg-rose-500/[0.02]" 
                    : "border-on-surface/5",
                  (!isEnabled && isCurrentMonth) && "opacity-70",
                  (!isEnabled && !isCurrentMonth) && "hidden" // Hide disabled budgets in history
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm transition-all shrink-0", 
                      isEnabled ? category.color : "bg-on-surface/10 text-on-surface/40"
                    )}>
                      <IconComponent name={category.icon} size={20} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-on-surface text-sm uppercase tracking-tight truncate">{category.name}</h4>
                      <p className="text-[10px] text-on-surface-variant/50 font-black uppercase tracking-wider">
                        {isEnabled ? (isOver ? 'Límite superado' : 'Objetivo Activo') : 'Sin Objetivo'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Toggle Switch */}
                    {isCurrentMonth && (
                      <button
                        onClick={async () => {
                          if (isEnabled) {
                            await handleSave(category.id, 0, true);
                          } else {
                            await handleSave(category.id, 0);
                          }
                        }}
                        className={cn(
                          "w-12 h-6 rounded-full relative transition-all duration-300 flex items-center px-1",
                          isEnabled ? "bg-primary" : "bg-on-surface/10"
                        )}
                        title={isEnabled ? "Desactivar objetivo" : "Activar objetivo"}
                      >
                        <motion.div 
                          animate={{ x: isEnabled ? 24 : 0 }}
                          className="w-4 h-4 bg-white rounded-full shadow-sm"
                        />
                      </button>
                    )}

                    {isEnabled && (
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-on-surface-variant/40 uppercase tracking-tighter">{activeCurrency}</span>
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
                            placeholder="0"
                            className={cn(
                              "w-28 sm:w-32 pl-9 sm:pl-10 pr-2.5 sm:pr-3 py-2 bg-on-surface/5 border-none rounded-xl text-sm font-bold text-on-surface transition-all text-right focus:ring-2 focus:ring-primary/20",
                              !isCurrentMonth && "opacity-80 bg-transparent text-base pr-0"
                            )}
                          />
                        </div>
                        {isCurrentMonth && (
                          <button 
                            onClick={() => handleSave(category.id, currentAmount)}
                            disabled={isSaving}
                            className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-sm relative shrink-0",
                              isSuccess ? "bg-emerald-500 text-white" : "bg-primary text-white hover:bg-primary-dark"
                            )}
                            title="Guardar objetivo"
                          >
                            {isSaving ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              isSuccess ? <Check size={18} /> : <Save size={18} />
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Bar & Spending Indicator */}
                {isEnabled && budgetVal > 0 && (
                  <div className="mt-3 pt-3 border-t border-on-surface/5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-on-surface-variant/60 font-medium">Gastado:</span>
                        <span className={cn(
                          "whitespace-nowrap font-black font-mono",
                          isOver ? "text-rose-600 dark:text-rose-400" : "text-on-surface"
                        )}>
                          {formatCurrency(spent, activeCurrency)}
                        </span>
                        <span className="text-on-surface-variant/40">/</span>
                        <span className="text-on-surface-variant/70 whitespace-nowrap font-mono">
                          {formatCurrency(budgetVal, activeCurrency)}
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md inline-block whitespace-nowrap",
                          isOver 
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" 
                            : percent >= 80 
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" 
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        )}>
                          {isOver 
                            ? `+${formatCurrency(spent - budgetVal, activeCurrency)} excedido` 
                            : `${formatCurrency(remainingCat, activeCurrency)} disponible`}
                        </span>
                      </div>
                    </div>

                    <div className="relative h-2 w-full bg-on-surface/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(percent, 100)}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          isOver 
                            ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" 
                            : percent >= 80 
                            ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]" 
                            : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                        )}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      <footer className="pt-8 text-center">
        <p className="text-[10px] font-black text-on-surface-variant/20 uppercase tracking-[0.3em]">FinApp Budgeting Engine v2.1</p>
      </footer>
    </div>
  );
};
