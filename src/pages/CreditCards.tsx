import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CreditCard as CreditCardIcon, 
  ArrowLeft, 
  Calendar, 
  CalendarRange, 
  Layers, 
  TrendingUp, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronRight, 
  ChevronDown, 
  Trash2, 
  DollarSign,
  Sparkles,
  Wallet,
  Landmark,
  Building2
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { formatCurrency, cn } from '../lib/utils';
import { getLocalToday, getLocalMonth, formatDisplayDate, formatLocalYYYYMMDD, parseLocalMonth } from '../lib/dateUtils';
import { deleteInstallmentPlan, deleteSingleVirtualInstallment } from '../services/firestoreService';

export const CreditCards: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { transactions, cards, projects, userNames } = useData();

  const [selectedCardFilter, setSelectedCardFilter] = useState<string>('all');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(getLocalMonth());
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [planToDelete, setPlanToDelete] = useState<{ id: string; description: string; totalInstallments: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const defaultCurrency = profile?.currency || 'ARS';
  const today = new Date();
  const currentMonthKey = getLocalMonth(today);

  // Group transactions into cohesive installment plans
  const allPlans = useMemo(() => {
    const map: Record<string, {
      id: string;
      description: string;
      totalAmount: number;
      installmentAmount: number;
      totalInstallments: number;
      cardId?: string | null;
      cardName?: string | null;
      categoryId: string;
      categoryName: string;
      categoryIcon: string;
      categoryColor: string;
      projectId?: string | null;
      firstDueDate: string;
      installments: any[];
    }> = {};

    transactions.forEach(t => {
      const planId = t.parentPlanId || t.installmentPlanId;
      if (planId && t.isInstallment) {
        if (!map[planId]) {
          const cleanDesc = (t.description || '').replace(/\s*\(\d+\/\d+\)$/, '').trim();
          map[planId] = {
            id: planId,
            description: cleanDesc || 'Compra en cuotas',
            totalAmount: t.originalPurchaseAmount || (t.amount * (t.totalInstallments || 1)),
            installmentAmount: t.amount,
            totalInstallments: t.totalInstallments || 1,
            cardId: t.cardId,
            cardName: t.cardName,
            categoryId: t.categoryId,
            categoryName: t.categoryName,
            categoryIcon: t.categoryIcon,
            categoryColor: t.categoryColor,
            projectId: t.projectId,
            firstDueDate: t.firstDueDate || formatLocalYYYYMMDD(t.date),
            installments: []
          };
        }
        map[planId].installments.push(t);
      }
    });

    // Sort installments inside each plan chronologically
    return Object.values(map).map(plan => {
      plan.installments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return plan;
    });
  }, [transactions]);

  // Filter plans based on card selection
  const filteredPlans = useMemo(() => {
    if (selectedCardFilter === 'all') return allPlans;
    return allPlans.filter(p => p.cardId === selectedCardFilter || p.cardName === selectedCardFilter);
  }, [allPlans, selectedCardFilter]);

  // Generate 12-month timeline starting from current month
  const timelineMonths = useMemo(() => {
    const months: {
      key: string; // YYYY-MM
      label: string;
      year: number;
      totalAmount: number;
      installmentsCount: number;
      installments: any[];
    }[] = [];

    const start = new Date(today.getFullYear(), today.getMonth(), 1);

    for (let i = 0; i < 12; i++) {
      const targetDate = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const key = getLocalMonth(targetDate);
      const label = targetDate.toLocaleDateString('es-ES', { month: 'short' });
      const year = targetDate.getFullYear();

      // Find all installments in this month (respecting card filter)
      const matchingInstallments = transactions.filter(t => {
        if (!t.isInstallment) return false;
        if (selectedCardFilter !== 'all') {
          if (t.cardId !== selectedCardFilter && t.cardName !== selectedCardFilter) return false;
        }
        return getLocalMonth(t.date) === key;
      });

      const totalAmount = matchingInstallments.reduce((sum, item) => sum + (item.amount || 0), 0);

      months.push({
        key,
        label: `${label.charAt(0).toUpperCase() + label.slice(1)} '${String(year).slice(2)}`,
        year,
        totalAmount,
        installmentsCount: matchingInstallments.length,
        installments: matchingInstallments
      });
    }

    return months;
  }, [transactions, today, selectedCardFilter]);

  // Find max monthly amount for relative bar graph height
  const maxMonthAmount = useMemo(() => {
    const max = Math.max(...timelineMonths.map(m => m.totalAmount), 0);
    return max > 0 ? max : 1;
  }, [timelineMonths]);

  // Overall KPIs
  const kpis = useMemo(() => {
    const currentMonthData = timelineMonths.find(m => m.key === currentMonthKey);
    const thisMonthTotal = currentMonthData?.totalAmount || 0;
    const thisMonthCount = currentMonthData?.installmentsCount || 0;

    // Remaining future commitment: all installments from this month forward
    let remainingDebt = 0;
    let lastMaturityDate: Date | null = null;

    transactions.forEach(t => {
      if (t.isInstallment) {
        if (selectedCardFilter !== 'all') {
          if (t.cardId !== selectedCardFilter && t.cardName !== selectedCardFilter) return;
        }
        const tDate = new Date(t.date);
        if (getLocalMonth(tDate) >= currentMonthKey) {
          remainingDebt += (t.amount || 0);
          if (!lastMaturityDate || tDate > lastMaturityDate) {
            lastMaturityDate = tDate;
          }
        }
      }
    });

    const finishMonthLabel = lastMaturityDate 
      ? (lastMaturityDate as Date).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
      : 'Sin cuotas pendientes';

    return {
      thisMonthTotal,
      thisMonthCount,
      remainingDebt,
      activePlansCount: filteredPlans.length,
      finishMonthLabel
    };
  }, [timelineMonths, currentMonthKey, transactions, selectedCardFilter, filteredPlans]);

  // Month selected details
  const selectedMonthData = useMemo(() => {
    return timelineMonths.find(m => m.key === selectedMonthKey) || timelineMonths[0];
  }, [timelineMonths, selectedMonthKey]);

  const handleDeletePlan = async () => {
    if (!planToDelete) return;
    setIsDeleting(true);
    try {
      await deleteInstallmentPlan(planToDelete.id);
      setPlanToDelete(null);
    } catch (err) {
      console.error('Error deleting plan:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-32 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2.5 hover:bg-surface-container rounded-2xl text-on-surface-variant hover:text-on-surface transition-colors border border-on-surface/5"
            title="Volver"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-on-surface tracking-tight font-headline flex items-center gap-2">
              <span>Compromisos & Cuotas</span>
              <Layers size={22} className="text-primary" />
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant font-medium">
              Cronograma de pagos, previsión mensual y seguimiento de compras financiadas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/cards"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container text-on-surface font-bold text-xs border border-on-surface/10 hover:bg-surface-container-high transition-all"
          >
            <CreditCardIcon size={14} />
            <span>Mis Tarjetas</span>
          </Link>
          <Link
            to="/add"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-md shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
          >
            <Plus size={15} />
            <span>Nueva Compra</span>
          </Link>
        </div>
      </div>

      {/* Card Filter Chips */}
      {cards.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCardFilter('all')}
            className={cn(
              "px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap shrink-0 border",
              selectedCardFilter === 'all'
                ? "bg-on-surface text-surface-container-lowest border-on-surface shadow-md"
                : "bg-surface-container-low text-on-surface-variant border-transparent hover:bg-surface-container"
            )}
          >
            Todas las tarjetas ({allPlans.length})
          </button>
          {cards.map(c => {
            const isSelected = selectedCardFilter === c.id;
            const cardPlansCount = allPlans.filter(p => p.cardId === c.id || p.cardName === c.name).length;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCardFilter(c.id)}
                className={cn(
                  "px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-2 border",
                  isSelected
                    ? "bg-primary text-on-primary border-primary shadow-md"
                    : "bg-surface-container-low text-on-surface-variant border-transparent hover:bg-surface-container"
                )}
              >
                <div className={`w-3 h-3 rounded-full ${c.color || 'bg-slate-700'}`} />
                <span>{c.name}</span>
                <span className="text-[10px] opacity-75 font-mono">({cardPlansCount})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* KPI Highlight Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Mes Actual */}
        <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-3xl border border-on-surface/5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant/70 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Este Mes</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Calendar size={14} />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black font-headline text-on-surface">
            {formatCurrency(kpis.thisMonthTotal, defaultCurrency)}
          </div>
          <p className="text-[10px] font-bold text-on-surface-variant/60">
            {kpis.thisMonthCount} {kpis.thisMonthCount === 1 ? 'cuota activa' : 'cuotas activas'}
          </p>
        </div>

        {/* Total Comprometido */}
        <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-3xl border border-on-surface/5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant/70 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Saldo Pendiente</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <TrendingUp size={14} />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black font-headline text-rose-600">
            {formatCurrency(kpis.remainingDebt, defaultCurrency)}
          </div>
          <p className="text-[10px] font-bold text-on-surface-variant/60">
            Total en cuotas futuras
          </p>
        </div>

        {/* Planes Activos */}
        <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-3xl border border-on-surface/5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant/70 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Planes Activos</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Layers size={14} />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black font-headline text-on-surface">
            {kpis.activePlansCount}
          </div>
          <p className="text-[10px] font-bold text-on-surface-variant/60">
            Compras financiadas
          </p>
        </div>

        {/* Fin de pagos */}
        <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-3xl border border-on-surface/5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant/70 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Fin de Cuotas</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <CheckCircle2 size={14} />
            </div>
          </div>
          <div className="text-sm sm:text-base font-extrabold text-on-surface truncate capitalize pt-1">
            {kpis.finishMonthLabel}
          </div>
          <p className="text-[10px] font-bold text-on-surface-variant/60">
            Último resumen proyectado
          </p>
        </div>
      </div>

      {/* 12-Month Interactive Projection Timeline */}
      <section className="bg-surface-container-lowest p-6 sm:p-8 rounded-[2.5rem] border border-on-surface/5 shadow-sm space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-black text-on-surface font-headline flex items-center gap-2">
              <CalendarRange size={18} className="text-primary" />
              <span>Cronograma de los Próximos 12 Meses</span>
            </h2>
            <p className="text-xs text-on-surface-variant">
              Toca un mes para ver las cuotas exactas que vencen en ese resumen.
            </p>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 block">
              Mes Seleccionado
            </span>
            <span className="text-sm font-black text-primary">
              {selectedMonthData.label}: {formatCurrency(selectedMonthData.totalAmount, defaultCurrency)}
            </span>
          </div>
        </div>

        {/* Bars Grid */}
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 pt-4 items-end min-h-[160px]">
          {timelineMonths.map((m) => {
            const isSelected = selectedMonthKey === m.key;
            const isCurrent = currentMonthKey === m.key;
            const heightPercentage = Math.max(10, Math.round((m.totalAmount / maxMonthAmount) * 100));

            return (
              <button
                key={m.key}
                onClick={() => setSelectedMonthKey(m.key)}
                className="group flex flex-col items-center gap-2 focus:outline-none"
              >
                {/* Amount tooltip text above bar */}
                <span className={cn(
                  "text-[9px] font-extrabold truncate max-w-full transition-opacity",
                  m.totalAmount > 0 ? "opacity-100 text-on-surface-variant" : "opacity-0"
                )}>
                  {m.totalAmount > 0 ? `$${Math.round(m.totalAmount / 1000)}k` : ''}
                </span>

                {/* Vertical Bar container */}
                <div className="w-full h-28 bg-surface-container-low rounded-2xl p-1 flex items-end justify-center relative overflow-hidden transition-all group-hover:bg-surface-container">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: m.totalAmount > 0 ? `${heightPercentage}%` : '6px' }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className={cn(
                      "w-full rounded-xl transition-colors",
                      isSelected
                        ? "bg-primary shadow-md shadow-primary/30"
                        : m.totalAmount > 0
                          ? isCurrent
                            ? "bg-blue-500/80 group-hover:bg-blue-600"
                            : "bg-blue-400/40 group-hover:bg-blue-400/70"
                          : "bg-on-surface-variant/10"
                    )}
                  />
                  {isCurrent && (
                    <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-500" />
                  )}
                </div>

                {/* Month label */}
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-wider transition-colors",
                  isSelected ? "text-primary font-black" : "text-on-surface-variant/70 group-hover:text-on-surface"
                )}>
                  {m.label.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Month Details Drawer */}
        <div className="mt-4 pt-4 border-t border-on-surface/5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-on-surface-variant">
              Detalle de cuotas en {selectedMonthData.label} ({selectedMonthData.installmentsCount})
            </h3>
            <span className="text-xs font-black text-on-surface">
              Total: {formatCurrency(selectedMonthData.totalAmount, defaultCurrency)}
            </span>
          </div>

          {selectedMonthData.installments.length === 0 ? (
            <div className="p-4 rounded-2xl bg-surface-container-low text-center text-xs font-medium text-on-surface-variant">
              No hay vencimientos de cuotas proyectados para este mes.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {selectedMonthData.installments.map((inst) => (
                <div
                  key={inst.id}
                  className="p-3.5 rounded-2xl bg-surface-container-low border border-on-surface/5 flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={cn(
                      "w-9 h-9 rounded-xl text-white flex items-center justify-center shrink-0 shadow-sm text-xs font-bold",
                      inst.categoryColor || 'bg-slate-500'
                    )}>
                      <Layers size={16} />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-black text-on-surface truncate">
                        {inst.description}
                      </p>
                      <p className="text-[10px] text-on-surface-variant/70 font-bold truncate">
                        {inst.cardName || 'Tarjeta'} • {formatDisplayDate(inst.date)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-on-surface">
                      {formatCurrency(inst.amount, defaultCurrency)}
                    </p>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
                      {inst.installmentNumber}/{inst.totalInstallments}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Active Plans Progress Cards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-lg font-black text-on-surface font-headline">
              Planes de Cuotas Activos ({filteredPlans.length})
            </h2>
            <p className="text-xs text-on-surface-variant">
              Progreso de amortización de cada compra financiada.
            </p>
          </div>
        </div>

        {filteredPlans.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-3xl p-10 text-center border border-on-surface/5 space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <CreditCardIcon size={28} />
            </div>
            <h3 className="text-base font-bold text-on-surface">No hay planes de cuotas activos</h3>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
              Cuando registres un gasto con Tarjeta de Crédito en más de 1 cuota, verás aquí el avance de pago, capital restante y fechas de vencimiento.
            </p>
            <Link
              to="/add"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs"
            >
              <Plus size={14} />
              <span>Registrar compra en cuotas</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPlans.map((plan) => {
              // Calculate progress: how many installments are past/current
              const paidCount = plan.installments.filter(i => getLocalMonth(i.date) < currentMonthKey).length;
              const currentDueThisMonth = plan.installments.find(i => getLocalMonth(i.date) === currentMonthKey);
              const remainingInstallments = plan.installments.filter(i => getLocalMonth(i.date) >= currentMonthKey);
              const remainingAmount = remainingInstallments.reduce((sum, item) => sum + item.amount, 0);

              const currentNumber = currentDueThisMonth 
                ? currentDueThisMonth.installmentNumber 
                : Math.min(plan.totalInstallments, paidCount + 1);

              const progressPercent = Math.min(100, Math.round((paidCount / plan.totalInstallments) * 100));
              const isExpanded = expandedPlanId === plan.id;

              return (
                <motion.div
                  key={plan.id}
                  layout
                  className="bg-surface-container-lowest rounded-3xl p-5 sm:p-6 border border-on-surface/5 shadow-sm space-y-4"
                >
                  {/* Plan Top Info */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={cn(
                        "w-11 h-11 rounded-2xl text-white flex items-center justify-center shrink-0 shadow-md",
                        plan.categoryColor || 'bg-slate-700'
                      )}>
                        <CreditCardIcon size={20} />
                      </div>
                      <div className="truncate">
                        <h3 className="text-sm sm:text-base font-black text-on-surface truncate">
                          {plan.description}
                        </h3>
                        <p className="text-[11px] font-bold text-on-surface-variant/70 flex items-center gap-1.5 mt-0.5">
                          <span className="text-primary font-black">{plan.cardName || 'Tarjeta'}</span>
                          <span>•</span>
                          <span>{plan.categoryName || 'General'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm sm:text-base font-black text-on-surface font-headline">
                        {formatCurrency(plan.installmentAmount, defaultCurrency)}
                        <span className="text-[10px] text-on-surface-variant/60 font-medium"> /mes</span>
                      </p>
                      <p className="text-[10px] font-extrabold text-rose-600">
                        Resta: {formatCurrency(remainingAmount, defaultCurrency)}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar & Badges */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-on-surface">
                        Cuota {currentNumber} de {plan.totalInstallments}
                      </span>
                      <span className="font-black text-primary text-[11px]">
                        {progressPercent}% completado
                      </span>
                    </div>

                    <div className="w-full h-3 bg-surface-container-low rounded-full overflow-hidden p-0.5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 shadow-xs"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-on-surface-variant/60 font-medium pt-0.5">
                      <span>Total financiado: {formatCurrency(plan.totalAmount, defaultCurrency)}</span>
                      <span>Inicio: {plan.firstDueDate}</span>
                    </div>
                  </div>

                  {/* Plan Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-on-surface/5">
                    <button
                      type="button"
                      onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <span>{isExpanded ? 'Ocultar cronograma' : 'Ver las cuotas'}</span>
                      <ChevronDown size={14} className={cn("transition-transform", isExpanded && "rotate-180")} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setPlanToDelete({ id: plan.id, description: plan.description, totalInstallments: plan.totalInstallments })}
                      className="flex items-center gap-1 text-xs font-bold text-error/80 hover:text-error px-2.5 py-1 rounded-xl hover:bg-error/10 transition-colors"
                    >
                      <Trash2 size={13} />
                      <span>Cancelar Plan</span>
                    </button>
                  </div>

                  {/* Expanded Installments List */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden pt-2"
                      >
                        <div className="bg-surface-container-low rounded-2xl p-3 space-y-2 max-h-56 overflow-y-auto">
                          {plan.installments.map((inst) => {
                            const instMonthKey = getLocalMonth(inst.date);
                            const isPaid = instMonthKey < currentMonthKey;
                            const isCurrent = instMonthKey === currentMonthKey;

                            return (
                              <div
                                key={inst.id}
                                className={cn(
                                  "p-2.5 rounded-xl flex items-center justify-between text-xs transition-colors",
                                  isCurrent ? "bg-primary/10 border border-primary/20" : "bg-surface-container-lowest"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  {isPaid ? (
                                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                                  ) : isCurrent ? (
                                    <Clock size={14} className="text-primary shrink-0" />
                                  ) : (
                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-on-surface-variant/30 shrink-0" />
                                  )}
                                  <span className="font-extrabold text-on-surface">
                                    Cuota {inst.installmentNumber}/{inst.totalInstallments}
                                  </span>
                                  <span className="text-[10px] text-on-surface-variant">
                                    • {formatDisplayDate(inst.date)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-on-surface">
                                    {formatCurrency(inst.amount, defaultCurrency)}
                                  </span>
                                  <span className={cn(
                                    "text-[9px] font-black uppercase px-1.5 py-0.5 rounded",
                                    isPaid ? "bg-emerald-500/10 text-emerald-600" : isCurrent ? "bg-primary/20 text-primary" : "bg-on-surface/5 text-on-surface-variant"
                                  )}>
                                    {isPaid ? 'Pagada' : isCurrent ? 'Este mes' : 'Pendiente'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Delete Plan Confirmation Modal */}
      <AnimatePresence>
        {planToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-container-lowest rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-on-surface/10 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-error/10 text-error flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-lg font-black text-on-surface">¿Cancelar plan de cuotas?</h3>
                <p className="text-xs text-on-surface-variant">
                  Vas a eliminar el plan completo de <strong className="text-on-surface">{planToDelete.description}</strong> ({planToDelete.totalInstallments} cuotas). Esta acción no se puede deshacer.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setPlanToDelete(null)}
                  className="flex-1 py-2.5 rounded-xl border border-on-surface/10 font-bold text-xs text-on-surface hover:bg-surface-container transition-colors"
                >
                  Volver
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeletePlan}
                  className="flex-1 py-2.5 rounded-xl bg-error text-white font-bold text-xs hover:bg-error/90 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Eliminando...' : 'Sí, eliminar plan'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
