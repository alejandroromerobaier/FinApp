import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Target, Save, Check, AlertCircle, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { updateBudget, deleteBudget, getBudgetsOnce } from '../services/firestoreService';
import { getLocalMonth, parseLocalMonth } from '../lib/dateUtils';
import { formatCurrency, cn } from '../lib/utils';

export const Budgets: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { categories, budgets, projects, budgetMonth, setBudgetMonth } = useData();
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [successMap, setSuccessMap] = useState<Record<string, boolean>>({});
  const [localBudgets, setLocalBudgets] = useState<Record<string, string>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  // Filter only expense categories
  const expenseCategories = categories.filter(c => c.type === 'expense');

  // Initialize local budgets from store
  React.useEffect(() => {
    const initial: Record<string, string> = {};
    budgets.forEach(b => {
      // Only include budgets for the selected context
      if ((selectedProjectId === null && (!b.projectId || b.projectId === 'personal' || b.projectId === null)) || 
          (selectedProjectId !== null && b.projectId === selectedProjectId)) {
        initial[b.categoryId] = b.amount ? b.amount.toString() : '';
      }
    });
    setLocalBudgets(initial);
  }, [budgets, selectedProjectId]);

  const handleSave = async (categoryId: string, rawAmount: number | string, isDelete: boolean = false) => {
    setSavingMap(prev => ({ ...prev, [categoryId]: true }));
    const amount = typeof rawAmount === 'string' ? parseFloat(rawAmount.replace(',', '.')) || 0 : rawAmount;
    try {
      if (isDelete) {
        await deleteBudget(categoryId, budgetMonth, selectedProjectId);
      } else {
        await updateBudget(categoryId, budgetMonth, amount, selectedProjectId);
      }
      
      setSuccessMap(prev => ({ ...prev, [categoryId]: true }));
      setTimeout(() => {
        setSuccessMap(prev => ({ ...prev, [categoryId]: false }));
      }, 2000);
    } catch (err) {
      console.error(err);
      alert('Error al procesar el presupuesto. Por favor, intenta de nuevo.');
    } finally {
      setSavingMap(prev => ({ ...prev, [categoryId]: false }));
    }
  };

  const handlePrevMonth = () => {
    const d = parseLocalMonth(budgetMonth);
    d.setMonth(d.getMonth() - 1);
    setBudgetMonth(getLocalMonth(d));
  };

  const handleNextMonth = () => {
    const d = parseLocalMonth(budgetMonth);
    d.setMonth(d.getMonth() + 1);
    setBudgetMonth(getLocalMonth(d));
  };

  const copyFromLastMonth = async () => {
    if (copying) return;
    setCopying(true);
    try {
      const d = parseLocalMonth(budgetMonth);
      d.setMonth(d.getMonth() - 1);
      const prevMonthStr = getLocalMonth(d);
      
      const projectIds = projects.map(p => p.id);
      const prevBudgets = await getBudgetsOnce(prevMonthStr, projectIds);
      
      const filteredPrev = prevBudgets.filter(b => 
        (selectedProjectId === null && (!b.projectId || b.projectId === 'personal')) ||
        (selectedProjectId !== null && b.projectId === selectedProjectId)
      );

      if (filteredPrev.length === 0) {
        alert('No se encontraron presupuestos en el mes anterior para copiar.');
        return;
      }

      for (const b of filteredPrev) {
        await updateBudget(b.categoryId, budgetMonth, b.amount, b.projectId);
      }
      
      alert(`Se han copiado ${filteredPrev.length} presupuestos con éxito.`);
    } catch (err) {
      console.error(err);
      alert('Error al copiar presupuestos.');
    } finally {
      setCopying(false);
    }
  };

  const currentMonthDisplay = parseLocalMonth(budgetMonth).toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  const isCurrentMonth = budgetMonth === getLocalMonth();

  return (
    <div className="px-6 max-w-2xl mx-auto py-8 space-y-8">
      {/* Header */}
      <header className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
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
              <span className="text-[10px] bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">Histórico</span>
            )}
          </div>
        </div>
      </header>

      {/* Month Navigator */}
      <section className="flex items-center justify-between bg-surface-container-low p-2 rounded-2xl border border-on-surface/5">
        <button 
          onClick={handlePrevMonth}
          className="w-10 h-10 rounded-xl hover:bg-on-surface/5 flex items-center justify-center text-on-surface-variant transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center group cursor-pointer" onClick={() => setBudgetMonth(getLocalMonth())}>
          <p className="text-[10px] font-black uppercase text-on-surface-variant/40 group-hover:text-primary transition-colors italic">Snap to Present</p>
          <p className="text-xs font-bold text-on-surface uppercase tracking-tight">{currentMonthDisplay}</p>
        </div>
        <button 
          onClick={handleNextMonth}
          className="w-10 h-10 rounded-xl hover:bg-on-surface/5 flex items-center justify-center text-on-surface-variant transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </section>

      {/* Project Selector */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedProjectId(null)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all",
              selectedProjectId === null 
                ? "bg-primary text-white shadow-lg shadow-primary/20" 
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
            )}
          >
            Personal
          </button>
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProjectId(p.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all",
                selectedProjectId === p.id 
                  ? "bg-primary text-white shadow-lg shadow-primary/20" 
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      </section>

      <section className="bg-primary/5 border border-primary/10 rounded-2xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-4 items-start">
          <div className="p-2 bg-primary rounded-xl text-white">
            <Target size={20} />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-primary uppercase tracking-tight">
              {selectedProjectId ? 'Objetivos de Proyecto' : 'Objetivos Personales'}
            </h3>
            <p className="text-xs text-on-surface-variant/70 leading-relaxed">
              Define cuánto planeas gastar en {selectedProjectId ? 'este proyecto' : 'tus gastos personales'}.
            </p>
          </div>
        </div>

        {(budgets.length === 0 && isCurrentMonth) && (
          <button
            onClick={copyFromLastMonth}
            disabled={copying}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-on-surface/10 rounded-xl text-xs font-black uppercase tracking-wider text-on-surface hover:bg-on-surface/5 transition-all shadow-sm active:scale-95"
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
            const activeProject = projects.find(p => p.id === selectedProjectId);
            const activeCurrency = selectedProjectId ? (activeProject?.currency || 'ARS') : (profile?.currency || 'ARS');

            const isEnabled = budgets.some(b => 
              b.categoryId === category.id && 
              ((selectedProjectId === null && (!b.projectId || b.projectId === 'personal' || b.projectId === null)) || 
               (selectedProjectId !== null && b.projectId === selectedProjectId))
            );
            
            return (
              <motion.div 
                key={`${category.id}-${selectedProjectId}`}
                layout
                className={cn(
                  "bg-surface-container-lowest border border-on-surface/5 p-4 rounded-2xl shadow-sm space-y-4 transition-opacity",
                  (!isEnabled && isCurrentMonth) && "opacity-70",
                  (!isEnabled && !isCurrentMonth) && "hidden" // Hide disabled budgets in history
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg transition-all", 
                      isEnabled ? category.color : "bg-on-surface/10 text-on-surface/40"
                    )}>
                      <Target size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-on-surface text-sm uppercase tracking-tight">{category.name}</h4>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-widest">
                          {isEnabled ? 'Objetivo Activo' : 'Sin Objetivo'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
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
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-on-surface-variant/40 uppercase tracking-tighter">{activeCurrency}</span>
                          <input 
                            type="text"
                            inputMode="decimal"
                            value={currentAmount || ''}
                            disabled={!isCurrentMonth}
                            onChange={(e) => {
                              let val = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
                              const parts = val.split('.');
                              if (parts.length > 2) {
                                val = parts[0] + '.' + parts.slice(1).join('');
                              }
                              setLocalBudgets(prev => ({ ...prev, [category.id]: val }));
                            }}
                            placeholder="0"
                            className={cn(
                              "w-28 pl-10 pr-3 py-2 bg-on-surface/5 border-none rounded-xl text-sm font-bold text-on-surface transition-all text-right focus:ring-2 focus:ring-primary/20",
                              !isCurrentMonth && "opacity-80 bg-transparent text-lg pr-0"
                            )}
                          />
                        </div>
                        {isCurrentMonth && (
                          <button 
                            onClick={() => handleSave(category.id, currentAmount)}
                            disabled={isSaving}
                            className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-lg relative",
                              isSuccess ? "bg-emerald-500 text-white" : "bg-primary text-white hover:bg-primary-dark"
                            )}
                          >
                            {isSaving ? (
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              isSuccess ? <Check size={18} /> : <Save size={18} />
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <footer className="pt-10 text-center">
        <p className="text-[10px] font-black text-on-surface-variant/20 uppercase tracking-[0.3em]">FinApp Budgeting Engine v2.0</p>
      </footer>
    </div>
  );
};
