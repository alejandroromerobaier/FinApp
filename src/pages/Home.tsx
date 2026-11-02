import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  ChevronRight, 
  Bell, 
  Search, 
  TrendingUp, 
  Wallet,
  ShoppingBag,
  Utensils,
  Car,
  Play,
  Heart,
  Book,
  MoreHorizontal,
  Landmark,
  Tag,
  Gift,
  Briefcase,
  Home as HomeIcon,
  Plane,
  Coffee,
  Zap,
  Smartphone,
  ShieldCheck,
  Loader2,
  Clock,
  ChevronLeft,
  Eye,
  EyeOff,
  Plus,
  CreditCard,
  Users
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import { formatCurrency, cn } from '@/src/lib/utils';
import { useAuth } from '../lib/AuthContext';
import { useData } from '../lib/DataContext';
import { getTransactions, cleanupDuplicateCategories, Shortcut } from '../services/firestoreService';
import { formatDisplayDate, getLocalMonth, parseLocalMonth, parseLocalYYYYMMDD } from '../lib/dateUtils';
import { ShortcutKeypadModal } from '../components/ShortcutKeypadModal';
import { ShortcutIconComponent, ShortcutBadge } from './ManageShortcuts';
import { getProjectGradient } from '../lib/constants';

const ICON_MAP: Record<string, any> = {
  ShoppingBag, Utensils, Car, Play, Heart, Book, MoreHorizontal, 
  Landmark, Tag, Gift, Briefcase, Home: HomeIcon, HomeIcon, Plane, Coffee, Zap, Smartphone, ShieldCheck
};

const IconComponent = ({ name, size = 20 }: { name: string, size?: number }) => {
  const Icon = ICON_MAP[name] || MoreHorizontal;
  return <Icon size={size} />;
};

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { 
    categories, projects, transactions, userNames, shortcuts, loading: dataLoading, 
    budgetMonth, setBudgetMonth, showBalances, toggleShowBalances 
  } = useData();
  const [loading, setLoading] = useState(true);
  const [selectedShortcut, setSelectedShortcut] = useState<Shortcut | null>(null);

  useEffect(() => {
    if (!dataLoading) {
      setLoading(false);
      // Clean up duplicates on load
      cleanupDuplicateCategories();
    }
  }, [dataLoading]);

  const { balancesByProject } = useMemo(() => {
    const projectTotals: Record<string, { 
      income: number; 
      expenses: number; 
      total: number; 
      currentIncome: number; 
      currentExpenses: number;
      currency: string;
      name: string;
      cardColor?: string | null;
      isPersonal: boolean;
      totalExpensesAllTime: number;
      myContribution: number;
      myContributionPercent: number;
      membersCount: number;
      projectInstallmentsRemaining: number;
      projectInstallmentsCount: number;
    }> = {
      personal: {
        income: 0,
        expenses: 0,
        total: 0,
        currentIncome: 0,
        currentExpenses: 0,
        currency: profile?.currency || 'ARS',
        name: 'Personal',
        cardColor: profile?.personalCardColor || 'navy',
        isPersonal: true,
        totalExpensesAllTime: 0,
        myContribution: 0,
        myContributionPercent: 100,
        membersCount: 1,
        projectInstallmentsRemaining: 0,
        projectInstallmentsCount: 0
      }
    };

    projects.forEach(p => {
      projectTotals[p.id] = {
        income: 0,
        expenses: 0,
        total: 0,
        currentIncome: 0,
        currentExpenses: 0,
        currency: p.currency || profile?.currency || 'ARS',
        name: p.name,
        cardColor: p.cardColor || 'slate',
        isPersonal: false,
        totalExpensesAllTime: 0,
        myContribution: 0,
        myContributionPercent: 0,
        membersCount: p.memberIds?.length || 1,
        projectInstallmentsRemaining: 0,
        projectInstallmentsCount: 0
      };
    });

    // Use the global budget month for calculations
    const activeDate = parseLocalMonth(budgetMonth);
    const activeMonth = activeDate.getMonth();
    const activeYear = activeDate.getFullYear();
    const currentMonthKey = getLocalMonth();

    const projectPlanSets: Record<string, Set<string>> = {};

    transactions.forEach(t => {
      const projectId = t.projectId || 'personal';
      const project = projects.find(p => p.id === t.projectId);
      const currency = project?.currency || profile?.currency || 'ARS';
      const projectName = projectId === 'personal' ? 'Personal' : (project?.name || 'Proyecto');
      
      const tDate = t.date instanceof Date ? t.date : new Date(t.date);

      if (!projectTotals[projectId]) {
        projectTotals[projectId] = { 
          income: 0, 
          expenses: 0, 
          total: 0, 
          currentIncome: 0, 
          currentExpenses: 0,
          currency,
          name: projectName,
          cardColor: projectId === 'personal' ? (profile?.personalCardColor || 'navy') : (project?.cardColor || 'slate'),
          isPersonal: projectId === 'personal',
          totalExpensesAllTime: 0,
          myContribution: 0,
          myContributionPercent: 0,
          membersCount: project?.memberIds?.length || 1,
          projectInstallmentsRemaining: 0,
          projectInstallmentsCount: 0
        };
      }
      
      // Total general acumulado
      if (t.type === 'income') {
        projectTotals[projectId].total += t.amount;
        projectTotals[projectId].income += t.amount;
      } else {
        projectTotals[projectId].total -= t.amount;
        projectTotals[projectId].expenses += t.amount;
        projectTotals[projectId].totalExpensesAllTime += t.amount;
        if (t.authorId === user?.uid) {
          projectTotals[projectId].myContribution += t.amount;
        }
      }

      // Actividad del mes seleccionado (comparar por purchaseDate si es cuota 1, sino fecha de vencimiento)
      const effectiveDate = (t.isInstallment && t.installmentNumber === 1 && t.purchaseDate)
        ? parseLocalYYYYMMDD(t.purchaseDate)
        : tDate;

      if (effectiveDate.getMonth() === activeMonth && effectiveDate.getFullYear() === activeYear) {
        if (t.type === 'income') {
          projectTotals[projectId].currentIncome += t.amount;
        } else {
          projectTotals[projectId].currentExpenses += t.amount;
        }
      }

      // Track future installments in project
      if (t.isInstallment && projectId !== 'personal') {
        const itemMonthKey = getLocalMonth(tDate);
        if (itemMonthKey >= currentMonthKey) {
          projectTotals[projectId].projectInstallmentsRemaining += (t.amount || 0);
          if (!projectPlanSets[projectId]) {
            projectPlanSets[projectId] = new Set();
          }
          projectPlanSets[projectId].add(t.parentPlanId || t.installmentPlanId || t.id);
        }
      }
    });

    Object.entries(projectTotals).forEach(([pId, pt]) => {
      if (pt.totalExpensesAllTime > 0) {
        pt.myContributionPercent = Math.min(100, Math.round((pt.myContribution / pt.totalExpensesAllTime) * 100));
      }
      if (projectPlanSets[pId]) {
        pt.projectInstallmentsCount = projectPlanSets[pId].size;
      }
    });

    // 1. Prepare base data including visibility and order
    const projectConfigs: Record<string, { show: boolean, order: number, name: string }> = {
      personal: {
        show: profile?.personalShowInHome ?? true,
        order: profile?.personalHomeOrder ?? 1,
        name: 'Personal'
      }
    };
    
    projects.forEach(p => {
      projectConfigs[p.id] = {
        show: p.showInHome !== undefined ? p.showInHome : true,
        order: p.homeOrder || 0,
        name: p.name
      };
    });

    // 2. Filter and Sort
    const sortedBalances = Object.entries(projectTotals)
      .map(([id, data]) => ({
        id,
        data,
        config: projectConfigs[id] || { show: true, order: 99, name: data.name }
      }))
      .filter(item => item.config.show)
      .sort((a, b) => {
        const orderA = a.config.order || 99;
        const orderB = b.config.order || 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.config.name.localeCompare(b.config.name);
      })
      .map(item => [item.id, item.data] as [string, any]);

    return { balancesByProject: sortedBalances };
  }, [transactions, projects, profile, budgetMonth, user?.uid]);

  const recentTransactions = useMemo(() => {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    return transactions
      .filter(t => {
        // If it's an installment plan, only installment 1 represents the initial purchase; exclude future installments > 1
        if (t.isInstallment && t.installmentNumber && t.installmentNumber > 1) {
          return false;
        }

        const effectiveDate = (t.purchaseDate && t.installmentNumber === 1)
          ? parseLocalYYYYMMDD(t.purchaseDate)
          : (t.date instanceof Date ? t.date : new Date(t.date));

        return !isNaN(effectiveDate.getTime()) && effectiveDate <= endOfToday;
      })
      .sort((a, b) => {
        const timeA = (a.purchaseDate && a.installmentNumber === 1)
          ? parseLocalYYYYMMDD(a.purchaseDate).getTime()
          : (a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime());
        const timeB = (b.purchaseDate && b.installmentNumber === 1)
          ? parseLocalYYYYMMDD(b.purchaseDate).getTime()
          : (b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime());
        return timeB - timeA;
      })
      .slice(0, 5);
  }, [transactions]);

  const installmentSummary = useMemo(() => {
    const monthInstallments = transactions.filter(t => t.isInstallment && getLocalMonth(t.date) === budgetMonth);
    const totalThisMonth = monthInstallments.reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const currentMonthKey = getLocalMonth();
    const futureInstallments = transactions.filter(t => t.isInstallment && getLocalMonth(t.date) >= currentMonthKey);
    const totalRemaining = futureInstallments.reduce((sum, t) => sum + (t.amount || 0), 0);

    const activePlansCount = new Set(futureInstallments.map(t => t.parentPlanId || t.installmentPlanId)).size;

    return {
      thisMonthCount: monthInstallments.length,
      totalThisMonth,
      totalRemaining,
      activePlansCount,
      hasInstallments: monthInstallments.length > 0 || futureInstallments.length > 0
    };
  }, [transactions, budgetMonth]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  const isCurrentMonth = budgetMonth === getLocalMonth();

  return (
    <div className="px-4 sm:px-6 max-w-4xl mx-auto py-6 sm:py-8 pb-32 sm:pb-10">
      {/* Header */}
      <header className="flex items-center justify-between mb-8 sm:mb-10">
        <div className="flex items-center gap-3.5 sm:gap-4">
          <Link to="/settings" className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-surface-container-lowest flex items-center justify-center overflow-hidden border-2 border-blue-500/20 shadow-md shadow-blue-500/10 group transition-all duration-300 hover:scale-105 active:scale-95">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-lg sm:text-xl font-black text-blue-600 uppercase transition-transform group-hover:scale-110">
                {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </span>
            )}
          </Link>
          <div>
            <div className="flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1 rounded-full border border-on-surface/5 w-fit mb-1">
              <button 
                onClick={() => {
                  const d = parseLocalMonth(budgetMonth);
                  d.setMonth(d.getMonth() - 1);
                  setBudgetMonth(getLocalMonth(d));
                }}
                className="p-0.5 hover:bg-on-surface/5 rounded-full text-on-surface-variant transition-colors active:scale-90"
                title="Mes anterior"
              >
                <ChevronLeft size={14} />
              </button>
              
              <button 
                onClick={() => setBudgetMonth(getLocalMonth())}
                className={cn(
                  "text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-colors hover:text-blue-600 leading-none px-1",
                  isCurrentMonth ? "text-blue-600/80" : "text-amber-600"
                )}
              >
                {parseLocalMonth(budgetMonth).toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
              </button>

              <button 
                onClick={() => {
                  const d = parseLocalMonth(budgetMonth);
                  d.setMonth(d.getMonth() + 1);
                  setBudgetMonth(getLocalMonth(d));
                }}
                className="p-0.5 hover:bg-on-surface/5 rounded-full text-on-surface-variant transition-colors active:scale-90"
                title="Mes siguiente"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-on-surface font-headline tracking-tight leading-tight flex items-center gap-2">
              <span>Hola, {user?.displayName?.split(' ')[0] || 'Usuario'}</span>
              <span className="text-lg">👋</span>
            </h2>
          </div>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button 
            onClick={toggleShowBalances}
            className="p-2.5 sm:p-3 bg-surface-container-low rounded-2xl text-on-surface-variant hover:bg-on-surface/5 transition-all active:scale-95 border border-on-surface/5"
            title={showBalances ? "Ocultar saldos" : "Mostrar saldos"}
          >
            {showBalances ? <EyeOff size={20} className="sm:w-[22px] sm:h-[22px]" /> : <Eye size={20} className="sm:w-[22px] sm:h-[22px]" />}
          </button>
          <button className="p-2.5 sm:p-3 bg-surface-container-low rounded-2xl text-on-surface-variant hover:bg-on-surface/5 transition-all active:scale-95 border border-on-surface/5">
            <Search size={20} className="sm:w-[22px] sm:h-[22px]" />
          </button>
        </div>
      </header>

      {/* Main Balance Cards (Dynamic by Project) */}
      <div className="space-y-6 mb-8 sm:mb-12">
        {balancesByProject.map(([id, data], idx) => {
          const isPersonal = id === 'personal';
          return (
            <motion.div 
              key={id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => isPersonal ? navigate('/history') : navigate(`/project/${id}`)}
              className={cn(
                "relative overflow-hidden rounded-[2.5rem] sm:rounded-[3.5rem] p-6 sm:p-10 text-white shadow-2xl group border border-white/10 cursor-pointer active:scale-[0.99] transition-all",
                getProjectGradient(data.cardColor, isPersonal)
              )}
            >
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 sm:w-80 sm:h-80 bg-white/10 blur-[60px] sm:blur-[90px] rounded-full -mr-24 -mt-24 sm:-mr-32 sm:-mt-32 transition-transform group-hover:scale-125 duration-1000" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6 sm:mb-10">
                  <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white/10 rounded-full backdrop-blur-md border border-white/10 shadow-inner">
                    {isPersonal ? <Wallet size={14} className="text-white sm:w-[16px] sm:h-[16px]" /> : <Users size={14} className="text-white sm:w-[16px] sm:h-[16px]" />}
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-white/80">{data.name} • {data.currency}</span>
                    {!isPersonal && (
                      <span className="bg-white/20 px-2 py-0.5 rounded-full text-[8px] font-bold text-white uppercase tracking-wider">
                        Compartido
                      </span>
                    )}
                  </div>
                  {!isCurrentMonth && (
                     <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 rounded-full backdrop-blur-md border border-amber-500/10">
                       <span className="text-[8px] font-black uppercase text-amber-200 tracking-widest">Archivo Histórico</span>
                     </div>
                  )}
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleShowBalances();
                      }}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-xl backdrop-blur-md border border-white/10 transition-colors"
                      title={showBalances ? "Ocultar saldos" : "Mostrar saldos"}
                    >
                      {showBalances ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    {!isPersonal ? (
                      <div className="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl backdrop-blur-md text-[11px] font-black uppercase tracking-wider text-white transition-colors">
                        <span>Ver</span>
                        <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    ) : (
                      <TrendingUp size={24} className="text-white/40 sm:w-[28px] sm:h-[28px]" />
                    )}
                  </div>
                </div>
                
                {isPersonal ? (
                  <>
                    <h1 className="text-5xl sm:text-7xl font-black tracking-tighter mb-2 font-headline drop-shadow-lg break-all leading-tight">
                      {showBalances ? formatCurrency(data.total, data.currency) : '••••••'}
                    </h1>
                    
                    <div className="flex flex-wrap gap-4 sm:gap-8 mb-6 sm:mb-10 mt-2 px-1">
                      <div className="flex flex-col">
                        <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-white/50 mb-0.5">Saldo Anterior</span>
                        <span className="text-sm sm:text-base font-black font-headline opacity-95">
                          {showBalances ? formatCurrency(data.total - (data.currentIncome - data.currentExpenses), data.currency) : '••••••'}
                        </span>
                      </div>
                      <div className="flex flex-col border-l border-white/10 pl-4 sm:pl-8">
                        <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-white/50 mb-0.5">Resultado Mes</span>
                        <span className={cn(
                          "text-sm sm:text-base font-black font-headline opacity-95",
                          (data.currentIncome - data.currentExpenses) >= 0 ? "text-emerald-300" : "text-rose-300"
                        )}>
                          {(data.currentIncome - data.currentExpenses) >= 0 ? '+' : ''}
                          {showBalances ? formatCurrency(data.currentIncome - data.currentExpenses, data.currency) : '••••••'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
                      <div className="bg-white/10 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] backdrop-blur-md border border-white/5 group-hover:bg-white/15 transition-all shadow-inner">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-400/20 flex items-center justify-center shadow-inner">
                            <ArrowDownLeft size={16} className="text-emerald-400 sm:w-[18px] sm:h-[18px]" />
                          </div>
                          <div className="text-left">
                            <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-white/50 mb-1 leading-none">Ingresos</p>
                            <p className="text-lg sm:text-xl font-black text-white leading-none tracking-tight">
                              {showBalances ? formatCurrency(data.currentIncome, data.currency) : '••••••'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white/10 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] backdrop-blur-md border border-white/5 group-hover:bg-white/15 transition-all shadow-inner">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-rose-400/20 flex items-center justify-center shadow-inner">
                            <ArrowUpRight size={16} className="text-rose-400 sm:w-[18px] sm:h-[18px]" />
                          </div>
                          <div className="text-left">
                            <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-white/50 mb-1 leading-none">Gastos</p>
                            <p className="text-lg sm:text-xl font-black text-white leading-none tracking-tight">
                              {showBalances ? formatCurrency(data.currentExpenses, data.currency) : '••••••'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-1">
                      Gasto Total del Proyecto
                    </p>
                    <h1 className="text-5xl sm:text-7xl font-black tracking-tighter mb-2 font-headline drop-shadow-lg break-all leading-tight">
                      {showBalances ? formatCurrency(data.totalExpensesAllTime, data.currency) : '••••••'}
                    </h1>
                    
                    <div className="flex flex-wrap gap-4 sm:gap-8 mb-6 sm:mb-8 mt-2 px-1">
                      <div className="flex flex-col">
                        <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-white/60 mb-0.5">Mi Aporte ({data.myContributionPercent}%)</span>
                        <span className="text-sm sm:text-base font-black font-headline text-emerald-300">
                          {showBalances ? formatCurrency(data.myContribution, data.currency) : '••••••'}
                        </span>
                      </div>
                      <div className="flex flex-col border-l border-white/10 pl-4 sm:pl-8">
                        <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-white/60 mb-0.5">Gastos este Mes</span>
                        <span className="text-sm sm:text-base font-black font-headline opacity-95">
                          {showBalances ? formatCurrency(data.currentExpenses, data.currency) : '••••••'}
                        </span>
                      </div>
                      <div className="flex flex-col border-l border-white/10 pl-4 sm:pl-8">
                        <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-white/60 mb-0.5">Miembros</span>
                        <span className="text-sm sm:text-base font-black font-headline opacity-95">
                          {data.membersCount} {data.membersCount === 1 ? 'persona' : 'personas'}
                        </span>
                      </div>
                    </div>

                    {data.projectInstallmentsRemaining > 0 && (
                      <div className="mb-4 bg-white/10 p-3 sm:p-4 rounded-2xl backdrop-blur-md border border-white/10 flex items-center justify-between text-xs font-bold text-white/90">
                        <div className="flex items-center gap-2">
                          <CreditCard size={16} className="text-blue-300 shrink-0" />
                          <span>{data.projectInstallmentsCount} {data.projectInstallmentsCount === 1 ? 'compra en cuotas' : 'compras en cuotas'}</span>
                        </div>
                        <span className="font-headline font-black text-blue-200">
                          {showBalances ? formatCurrency(data.projectInstallmentsRemaining, data.currency) : '••••'} a liquidar
                        </span>
                      </div>
                    )}
                    
                    <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs font-bold text-white/70">
                      <span>Toca la tarjeta para ver balances y liquidación</span>
                      <span className="flex items-center gap-1 text-white font-extrabold group-hover:translate-x-1 transition-transform">
                        <span>Ver balances</span>
                        <ChevronRight size={14} />
                      </span>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Installment Commitments Summary Card */}
      {installmentSummary.hasInstallments && (
        <section className="mb-8">
          <div 
            onClick={() => navigate('/credit-cards')}
            className="bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-5 sm:p-6 rounded-[2rem] border border-primary/20 shadow-sm hover:border-primary/40 transition-all cursor-pointer group active:scale-[0.99] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-on-surface font-headline tracking-tight">
                    Compromisos en Cuotas
                  </h3>
                  <p className="text-[11px] font-bold text-on-surface-variant/70">
                    {installmentSummary.activePlansCount} {installmentSummary.activePlansCount === 1 ? 'compra financiada' : 'compras financiadas'}
                  </p>
                </div>
              </div>

              <span className="text-xs font-bold text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                <span>Ver cronograma</span>
                <ChevronRight size={15} />
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-on-surface/5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/70 block mb-0.5">
                  Cuotas este mes
                </span>
                <span className="text-base sm:text-lg font-black text-on-surface font-headline block">
                  {showBalances ? formatCurrency(installmentSummary.totalThisMonth, profile?.currency) : '••••••'}
                </span>
                <span className="text-[10px] font-bold text-on-surface-variant/60 block">
                  {installmentSummary.thisMonthCount} {installmentSummary.thisMonthCount === 1 ? 'vencimiento' : 'vencimientos'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/70 block mb-0.5">
                  Deuda total pendiente
                </span>
                <span className="text-base sm:text-lg font-black text-rose-600 font-headline block">
                  {showBalances ? formatCurrency(installmentSummary.totalRemaining, profile?.currency) : '••••••'}
                </span>
                <span className="text-[10px] font-bold text-on-surface-variant/60 block">
                  En cuotas futuras
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Quick Expense Shortcuts */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-amber-500 fill-amber-500/20" />
            <h3 className="text-sm font-black text-on-surface font-headline tracking-tight uppercase">Atajos Rápidos</h3>
          </div>
          <button 
            onClick={() => navigate('/shortcuts')}
            className="text-primary font-black text-xs uppercase tracking-widest hover:underline"
          >
            {shortcuts.length > 0 ? 'Administrar' : 'Crear Atajos'}
          </button>
        </div>

        {shortcuts.length === 0 ? (
          <div className="bg-surface-container-lowest border border-dashed border-on-surface/10 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold shrink-0">
                <Zap size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-on-surface">Crea accesos rápidos de gasto</p>
                <p className="text-[10px] text-on-surface-variant font-medium">Registra tus gastos frecuentes en 1 clic</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/shortcuts')}
              className="bg-primary/10 text-primary text-xs font-black px-3.5 py-2 rounded-xl hover:bg-primary/20 transition-all shrink-0 active:scale-95"
            >
              ＋ Nuevo
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none pt-1 -mx-1 px-1">
            {shortcuts.map((shortcut) => {
              const category = categories.find(c => c.id === shortcut.categoryId);
              return (
                <button
                  key={shortcut.id}
                  onClick={() => setSelectedShortcut(shortcut)}
                  className="bg-surface-container-lowest hover:bg-on-surface/5 border border-on-surface/5 p-3 rounded-2xl flex items-center gap-3 shrink-0 active:scale-95 transition-all shadow-sm group min-w-[140px]"
                >
                  <ShortcutBadge icon={shortcut.icon} size={20} containerClassName="w-10 h-10 rounded-xl" />
                  <div className="text-left min-w-0 pr-1">
                    <p className="font-extrabold text-xs text-on-surface truncate group-hover:text-primary transition-colors max-w-[100px]">
                      {shortcut.name}
                    </p>
                    <p className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-wider mt-0.5 truncate">
                      {shortcut.defaultAmount && shortcut.defaultAmount > 0 
                        ? formatCurrency(shortcut.defaultAmount, profile?.currency) 
                        : (category?.name || 'Gasto')}
                    </p>
                  </div>
                </button>
              );
            })}
            
            <button
              onClick={() => navigate('/shortcuts')}
              className="bg-surface-container-low hover:bg-on-surface/10 border border-dashed border-on-surface/10 p-3 rounded-2xl flex items-center justify-center gap-1.5 shrink-0 active:scale-95 transition-all text-on-surface-variant text-xs font-bold px-3.5 h-[50px]"
              title="Crear nuevo atajo"
            >
              <Plus size={16} />
              <span>Nuevo</span>
            </button>
          </div>
        )}
      </section>

      {/* Keypad Modal */}
      <ShortcutKeypadModal 
        shortcut={selectedShortcut}
        onClose={() => setSelectedShortcut(null)}
      />

      {/* Recent Activity */}
      <section>
        <div className="flex items-center justify-between mb-6 px-1">
          <h3 className="text-xl font-black text-on-surface font-headline tracking-tight uppercase">Actividad Reciente</h3>
          <button 
            onClick={() => navigate('/history')}
            className="text-primary font-black text-xs uppercase tracking-widest flex items-center gap-1 hover:opacity-70 transition-opacity"
          >
            Ver Todo
            <ChevronRight size={16} />
          </button>
        </div>
        
        <div className="space-y-4">
          {recentTransactions.length > 0 ? (
            recentTransactions.map((t, i) => {
              const category = categories.find(c => c.id === t.categoryId);
              return (
                <TransactionItem 
                  key={t.id}
                  transaction={t}
                  category={category}
                  projects={projects}
                  index={i}
                />
              );
            })
          ) : (
            <div className="text-center py-12 bg-surface-container-low rounded-[2.5rem] border border-dashed border-on-surface/10">
              <p className="text-on-surface-variant/60 font-bold uppercase tracking-widest text-xs">No hay movimientos aún</p>
              <button 
                onClick={() => navigate('/add')}
                className="mt-4 text-primary font-black text-sm hover:underline"
              >
                Registrar primer gasto
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

interface TransactionItemProps {
  transaction: any;
  category?: any;
  projects?: any[];
  index: number;
  color?: string;
}

const TransactionItem: React.FC<TransactionItemProps> = ({ transaction, category, projects, index, color }) => {
  const navigate = useNavigate();
  const { userNames, showBalances } = useData();
  const { user, profile } = useAuth();
  
  const userName = userNames[transaction.authorId] || (transaction.authorId === user?.uid ? 'Tú' : '...');
  const project = projects?.find(p => p.id === transaction.projectId);

  const displayDate = (transaction.purchaseDate && transaction.installmentNumber === 1)
    ? parseLocalYYYYMMDD(transaction.purchaseDate)
    : (transaction.date instanceof Date ? transaction.date : new Date(transaction.date));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => navigate(`/edit/${transaction.id}`)}
      className="bg-surface-container-lowest p-3.5 sm:p-4 rounded-[1.5rem] border border-on-surface/5 flex items-center justify-between gap-3 group hover:bg-on-surface/5 transition-all cursor-pointer min-w-0"
    >
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
        <div className={cn(
          "w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0",
          color || category?.color || transaction.categoryColor || 'bg-slate-400'
        )}>
          <IconComponent name={category?.icon || transaction.categoryIcon || 'MoreHorizontal'} size={20} />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <p className="font-bold text-on-surface text-sm leading-tight truncate">{transaction.description || category?.name || transaction.categoryName || 'Sin descripción'}</p>
            {transaction.classification && (
               <div className={cn(
                 "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter shrink-0",
                 transaction.classification === 'fixed' ? "bg-primary/10 text-primary" : "bg-orange-500/10 text-orange-600"
               )}>
                 {transaction.classification === 'fixed' ? <Clock size={8} /> : <Zap size={8} />}
                 {transaction.classification === 'fixed' ? 'Fijo' : 'Var'}
               </div>
            )}
            {transaction.isInstallment && transaction.installmentNumber && transaction.totalInstallments && (
               <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter shrink-0 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                 <CreditCard size={8} />
                 <span>Cuota {transaction.installmentNumber}/{transaction.totalInstallments}</span>
                 {transaction.installmentNumber === 1 && transaction.purchaseDate && (
                   <span className="opacity-70 font-medium hidden sm:inline"> • Vence {formatDisplayDate(transaction.date, false)}</span>
                 )}
               </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5 min-w-0">
            <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest truncate max-w-[100px] sm:max-w-none">
              {category?.name || transaction.categoryName || (transaction.categoryId ? 'Cargando...' : 'Otros')}
            </p>
            <span className="w-1 h-1 rounded-full bg-on-surface/10 shrink-0" />
            <p className="text-[10px] font-black text-primary uppercase tracking-widest shrink-0">{userName}</p>
            {project && (
              <>
                <span className="w-1 h-1 rounded-full bg-on-surface/10 shrink-0" />
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none shrink-0">{project.name}</p>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="text-right shrink-0 ml-2">
        <p className={cn(
          "font-bold font-headline tracking-tighter text-sm sm:text-base whitespace-nowrap",
          transaction.type === 'expense' ? "text-on-surface" : "text-emerald-600"
        )}>
          {transaction.type === 'expense' ? '-' : '+'}
          {showBalances ? formatCurrency(transaction.amount, project?.currency || profile?.currency) : '••••'}
        </p>
        <p className="text-[10px] text-on-surface-variant/40 font-bold">
          {formatDisplayDate(displayDate, false)}
        </p>
      </div>
    </motion.div>
  );
};
