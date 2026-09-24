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
  EyeOff
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import { formatCurrency, cn } from '@/src/lib/utils';
import { useAuth } from '../lib/AuthContext';
import { useData } from '../lib/DataContext';
import { getTransactions, cleanupDuplicateCategories } from '../services/firestoreService';
import { formatDisplayDate, getLocalMonth, parseLocalMonth } from '../lib/dateUtils';

const ICON_MAP: Record<string, any> = {
  ShoppingBag, Utensils, Car, Play, Heart, Book, MoreHorizontal, 
  Landmark, Tag, Gift, Briefcase, HomeIcon, Plane, Coffee, Zap, Smartphone, ShieldCheck
};

const IconComponent = ({ name, size = 20 }: { name: string, size?: number }) => {
  const Icon = ICON_MAP[name] || MoreHorizontal;
  return <Icon size={size} />;
};

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { 
    categories, projects, transactions, userNames, loading: dataLoading, 
    budgetMonth, setBudgetMonth, showBalances, toggleShowBalances 
  } = useData();
  const [loading, setLoading] = useState(true);

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
    }> = {};
    
    // Use the global budget month for calculations
    const activeDate = parseLocalMonth(budgetMonth);
    const activeMonth = activeDate.getMonth();
    const activeYear = activeDate.getFullYear();

    transactions.forEach(t => {
      const projectId = t.projectId || 'personal';
      const project = projects.find(p => p.id === t.projectId);
      const currency = project?.currency || profile?.currency || 'ARS';
      const projectName = projectId === 'personal' ? 'Personal' : (project?.name || 'Proyecto');
      
      const tDate = new Date(t.date);

      if (!projectTotals[projectId]) {
        projectTotals[projectId] = { 
          income: 0, 
          expenses: 0, 
          total: 0, 
          currentIncome: 0, 
          currentExpenses: 0,
          currency,
          name: projectName
        };
      }
      
      // Total general acumulado
      if (t.type === 'income') {
        projectTotals[projectId].total += t.amount;
      } else {
        projectTotals[projectId].total -= t.amount;
      }

      // Actividad del mes seleccionado
      if (tDate.getMonth() === activeMonth && tDate.getFullYear() === activeYear) {
        if (t.type === 'income') {
          projectTotals[projectId].currentIncome += t.amount;
        } else {
          projectTotals[projectId].currentExpenses += t.amount;
        }
      }
      
      // Totales históricos (para las tarjetas de abajo)
      if (t.type === 'income') {
        projectTotals[projectId].income += t.amount;
      } else {
        projectTotals[projectId].expenses += t.amount;
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
  }, [transactions, projects, profile, budgetMonth]);

  const recentTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);
  }, [transactions]);

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
        <div className="flex items-center gap-3 sm:gap-4">
          <Link to="/settings" className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden border-2 border-primary/20 shadow-inner group">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover transition-transform group-active:scale-90" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-lg sm:text-xl font-black text-primary uppercase transition-transform group-active:scale-90">
                {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </span>
            )}
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  const d = parseLocalMonth(budgetMonth);
                  d.setMonth(d.getMonth() - 1);
                  setBudgetMonth(getLocalMonth(d));
                }}
                className="p-1 hover:bg-on-surface/5 rounded-lg text-on-surface-variant transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              
              <button 
                onClick={() => setBudgetMonth(getLocalMonth())}
                className={cn(
                  "text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] transition-colors hover:text-primary leading-none",
                  isCurrentMonth ? "text-primary/60" : "text-amber-500"
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
                className="p-1 hover:bg-on-surface/5 rounded-lg text-on-surface-variant transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-on-surface font-headline tracking-tight leading-none mt-1">
              {user?.displayName?.split(' ')[0] || 'Usuario'}
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
        {balancesByProject.map(([id, data], idx) => (
          <motion.div 
            key={id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={cn(
              "relative overflow-hidden rounded-[2.5rem] sm:rounded-[3.5rem] p-6 sm:p-10 text-white shadow-2xl group border border-white/10",
              id === 'personal' ? "bg-gradient-to-br from-primary via-primary/95 to-primary/90 shadow-primary/30" : "bg-gradient-to-br from-slate-800 via-slate-900 to-black shadow-slate-900/30"
            )}
          >
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 sm:w-80 sm:h-80 bg-white/10 blur-[60px] sm:blur-[90px] rounded-full -mr-24 -mt-24 sm:-mr-32 sm:-mt-32 transition-transform group-hover:scale-125 duration-1000" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6 sm:mb-10">
                <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white/10 rounded-full backdrop-blur-md border border-white/10 shadow-inner">
                  <Wallet size={14} className="text-white sm:w-[16px] sm:h-[16px]" />
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-white/80">{data.name} • {data.currency}</span>
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
                  >
                    {showBalances ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  <TrendingUp size={24} className="text-white/40 sm:w-[28px] sm:h-[28px]" />
                </div>
              </div>
              
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
            </div>
          </motion.div>
        ))}
      </div>

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

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => navigate('/history')}
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
          {formatDisplayDate(transaction.date, false)}
        </p>
      </div>
    </motion.div>
  );
};
