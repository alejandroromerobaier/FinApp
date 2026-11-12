import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Users, Utensils, Hotel, Car, ShoppingCart, ArrowLeft, Bell, ExternalLink, Plus, X, UserPlus, Trash2, Loader2, MoreHorizontal, ShoppingBag, Play, Heart, Book, Landmark, Tag, Gift, Briefcase, Home, Plane, Coffee, Zap, Smartphone, ShieldCheck, CreditCard, Layers, TrendingUp, Clock, CheckCircle2, Search, Filter, PieChart } from 'lucide-react';
import { formatCurrency, cn } from '@/src/lib/utils';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getTransactions, removeMemberFromProject, inviteUserToProjectByEmail, getUsersByIds } from '../services/firestoreService';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { expandProjectedTransactions } from '../lib/installmentUtils';
import { getLocalMonth } from '../lib/dateUtils';

import { getCategoryIcon } from '../lib/categoryIcons';
import { getProjectIcon, getProjectGradient } from '../lib/constants';

const IconComponent = ({ name, size = 20 }: { name: string, size?: number }) => {
  const Icon = getCategoryIcon(name);
  return <Icon size={size} />;
};

import { isProjectOwner } from './SharedProjects';

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, categories } = useData();
  const { user: currentUser } = useAuth();
  
  const [rawTransactions, setRawTransactions] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'transactions' | 'installments'>('transactions');
  const [planFilter, setPlanFilter] = useState<'all' | 'mine' | 'others'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAuthor, setFilterAuthor] = useState<string>('all');
  const [visibleLimit, setVisibleLimit] = useState(10);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const project = useMemo(() => projects.find(p => p.id === id), [projects, id]);
  const isOwner = isProjectOwner(project, currentUser?.uid);

  useEffect(() => {
    if (!id) return;

    const unsubscribe = getTransactions(id, (data) => {
      setRawTransactions(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  const transactions = useMemo(() => {
    return expandProjectedTransactions(rawTransactions);
  }, [rawTransactions]);

  // Active installment plans for this shared project
  const projectInstallmentPlans = useMemo(() => {
    const currentMonthKey = getLocalMonth(new Date());
    return rawTransactions
      .filter(t => t.isInstallmentPlan && t.totalInstallments > 1 && t.status !== 'cancelled')
      .map(t => {
        const planInstallments = transactions.filter(inst => (inst.parentPlanId === t.id || inst.installmentPlanId === t.id));
        const paidCount = planInstallments.filter(i => getLocalMonth(i.date) < currentMonthKey).length;
        const remaining = planInstallments.filter(i => getLocalMonth(i.date) >= currentMonthKey);
        const remainingAmount = remaining.reduce((acc, i) => acc + (i.amount || 0), 0);
        const progressPercent = Math.min(100, Math.round((paidCount / t.totalInstallments) * 100));
        const authorMember = members.find(m => m.id === t.authorId);
        
        return {
          ...t,
          paidCount,
          remainingCount: remaining.length,
          remainingAmount,
          progressPercent,
          authorMember,
          planInstallments
        };
      });
  }, [rawTransactions, transactions, members]);

  const totalCommittedFuture = useMemo(() => {
    return projectInstallmentPlans.reduce((sum, p) => sum + p.remainingAmount, 0);
  }, [projectInstallmentPlans]);

  const filteredInstallmentPlans = useMemo(() => {
    if (planFilter === 'mine') {
      return projectInstallmentPlans.filter(p => p.authorId === currentUser?.uid);
    }
    if (planFilter === 'others') {
      return projectInstallmentPlans.filter(p => p.authorId !== currentUser?.uid);
    }
    return projectInstallmentPlans;
  }, [projectInstallmentPlans, planFilter, currentUser?.uid]);

  useEffect(() => {
    const fetchMembers = async () => {
      if (project?.memberIds) {
        const users = await getUsersByIds(project.memberIds);
        setMembers(users || []);
      }
    };
    fetchMembers();
  }, [project?.memberIds]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const endOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    const validTransactions = transactions.filter(t => {
      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
      return !isNaN(tDate.getTime()) && tDate <= endOfCurrentMonth;
    });

    const total = validTransactions.reduce((acc, t) => acc + (t.type === 'expense' ? t.amount : 0), 0);
    const byMember: Record<string, number> = {};

    let currentMonthTotal = 0;

    validTransactions.forEach(t => {
      if (t.type === 'expense') {
        byMember[t.authorId] = (byMember[t.authorId] || 0) + t.amount;
        
        const tDate = t.date instanceof Date ? t.date : new Date(t.date);
        if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
          currentMonthTotal += t.amount;
        }
      }
    });

    const contributorStats = members.map(m => ({
      ...m,
      amount: byMember[m.id] || 0,
      percentage: total > 0 ? Math.round(((byMember[m.id] || 0) / total) * 100) : 0
    })).sort((a, b) => b.amount - a.amount);

    return { total, currentMonthTotal, contributorStats };
  }, [transactions, members]);

  // Category Breakdown for the project
  const categoryBreakdown = useMemo(() => {
    const byCat: Record<string, { total: number; count: number; category: any }> = {};
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    const totalExp = expenseTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);

    expenseTransactions.forEach(t => {
      const cId = t.categoryId || 'unknown';
      if (!byCat[cId]) {
        const foundCat = categories.find(c => c.id === cId) || { id: cId, name: t.categoryName || 'Otros', icon: t.categoryIcon || 'Tag', color: t.categoryColor || 'bg-slate-500' };
        byCat[cId] = { total: 0, count: 0, category: foundCat };
      }
      byCat[cId].total += (t.amount || 0);
      byCat[cId].count += 1;
    });

    return Object.values(byCat)
      .map(item => ({
        ...item,
        percentage: totalExp > 0 ? Math.round((item.total / totalExp) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [transactions, categories]);

  // Reset pagination when search or filters change
  useEffect(() => {
    setVisibleLimit(10);
  }, [searchQuery, filterAuthor, activeTab]);

  // Filtered transactions for the History tab
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (filterAuthor !== 'all' && t.authorId !== filterAuthor) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const desc = (t.description || '').toLowerCase();
        const catName = (categories.find(c => c.id === t.categoryId)?.name || t.categoryName || '').toLowerCase();
        const authorName = (members.find(m => m.id === t.authorId)?.name || '').toLowerCase();
        if (!desc.includes(q) && !catName.includes(q) && !authorName.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, filterAuthor, searchQuery, categories, members]);

  const paginatedTransactions = useMemo(() => {
    return filteredTransactions.slice(0, visibleLimit);
  }, [filteredTransactions, visibleLimit]);

  const hasMore = visibleLimit < filteredTransactions.length;

  // Infinite scroll observer
  useEffect(() => {
    if (activeTab !== 'transactions' || !hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleLimit(prev => Math.min(prev + 10, filteredTransactions.length));
      }
    }, {
      rootMargin: '200px',
      threshold: 0.1
    });

    observer.observe(sentinel);
    return () => {
      if (sentinel) observer.unobserve(sentinel);
    };
  }, [activeTab, hasMore, filteredTransactions.length]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    setInviteError(null);
    try {
      const result = await inviteUserToProjectByEmail(id!, inviteEmail);
      if (result.success) {
        setIsInviteModalOpen(false);
        setInviteEmail('');
        if (result.type === 'member') {
          alert('¡Usuario invitado con éxito!');
        } else {
          alert('Invitación enviada. El usuario verá el proyecto cuando se registre.');
        }
      } else {
        setInviteError('Error al invitar al usuario.');
      }
    } catch (error) {
      setInviteError('Error al invitar al usuario.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar a este colaborador?')) {
      await removeMemberFromProject(id!, userId);
    }
  };

  if (loading || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-on-surface-variant font-bold text-xs uppercase tracking-widest">Cargando detalles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 max-w-5xl mx-auto py-8 pb-32">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-3 bg-surface-container-lowest rounded-2xl shadow-sm border border-on-surface/10 hover:bg-on-surface/5 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0",
            getProjectGradient(project.cardColor)
          )}>
            {React.createElement(getProjectIcon(project.icon), { size: 22 })}
          </div>
          <div>
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1 block">Proyecto Compartido</span>
            <h2 className="text-2xl font-extrabold text-on-surface font-headline leading-tight">{project.name}</h2>
          </div>
        </div>
        <button 
          onClick={() => setIsInviteModalOpen(true)}
          className="bg-primary/10 text-primary p-3 rounded-2xl hover:bg-primary/20 transition-colors flex items-center gap-2"
        >
          <UserPlus size={20} />
          <span className="hidden sm:inline font-bold text-sm">Invitar</span>
        </button>
      </div>

      {/* Hero Stats */}
      <section className="mb-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-8">
            <div className="bg-surface-container-lowest p-8 rounded-[2.5rem] border border-on-surface/10 shadow-sm relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                    Proyecto Activo
                  </span>
                  <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-2 font-headline">{project.name}</h1>
                  <p className="text-on-surface-variant/70 flex items-center gap-2 font-medium">
                    <Calendar size={16} />
                    Creado el {
                      (() => {
                        const rawDate = project.createdAt;
                        if (!rawDate) return 'Recientemente';
                        const d = typeof rawDate?.toDate === 'function' ? rawDate.toDate() : new Date(rawDate);
                        return isNaN(d.getTime()) ? 'Recientemente' : d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                      })()
                    }
                  </p>
                </div>
                <div className={cn("text-white p-6 rounded-3xl shadow-xl min-w-[200px]", getProjectGradient(project.cardColor))}>
                  <p className="text-white/70 text-[10px] font-black uppercase tracking-widest mb-1">Gasto del Mes</p>
                  <div className="text-3xl font-black tracking-tight font-headline">{formatCurrency(stats.currentMonthTotal, project.currency)}</div>
                  <p className="text-white/40 text-[9px] font-bold uppercase mt-2">Total: {formatCurrency(stats.total, project.currency)}</p>
                </div>
              </div>
              <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-primary/5 blur-3xl rounded-full"></div>
            </div>
          </div>
          
          <div className="md:col-span-4 bg-surface-container-lowest p-8 rounded-[2.5rem] border border-on-surface/10 shadow-sm">
            <h3 className="text-sm font-black text-on-surface uppercase tracking-widest mb-6 flex items-center gap-2">
              <Users size={18} className="text-primary" />
              Colaboradores
            </h3>
            <div className="flex -space-x-3 mb-6">
              {members.map((m, i) => (
                <div key={m.id} className="w-12 h-12 rounded-full border-4 border-surface-container-lowest bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shadow-sm overflow-hidden">
                  {m.photoURL ? <img src={m.photoURL} alt={m.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : m.name.substring(0, 2).toUpperCase()}
                </div>
              ))}
              {isOwner && (
                <button 
                  onClick={() => setIsInviteModalOpen(true)}
                  className="w-12 h-12 rounded-full border-4 border-surface-container-lowest bg-on-surface/5 flex items-center justify-center text-on-surface-variant/40 hover:bg-on-surface/10 transition-colors"
                >
                  <Plus size={20} />
                </button>
              )}
            </div>
            <p className="text-xs text-on-surface-variant/70 font-medium">
              {members.length} personas compartiendo gastos en esta bóveda.
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Sidebar: Contributors */}
        <aside className="lg:col-span-4 space-y-8">
          <div className="bg-surface-container-lowest p-8 rounded-[2.5rem] border border-on-surface/10 shadow-sm">
            <h2 className="text-lg font-extrabold text-on-surface mb-8 flex items-center gap-2 font-headline">
              Contribuciones
            </h2>
            <div className="space-y-6">
              {stats.contributorStats.map((m) => (
                <div key={m.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-sm bg-on-surface/5 flex items-center justify-center border border-on-surface/10">
                      {m.photoURL ? <img src={m.photoURL} className="w-full h-full object-cover" alt={m.name} referrerPolicy="no-referrer" /> : <span className="font-bold text-on-surface-variant/40">{m.name.substring(0, 2).toUpperCase()}</span>}
                    </div>
                    <div>
                      <p className="font-bold text-on-surface group-hover:text-primary transition-colors">{m.name}</p>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">{m.percentage}% del total</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-on-surface">{formatCurrency(m.amount, project.currency)}</p>
                    {isOwner && m.id !== currentUser?.uid && (
                      <button 
                        onClick={() => handleRemoveMember(m.id)}
                        className="text-[10px] text-rose-500 font-bold hover:underline"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar: Categories Breakdown */}
          <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-[2.5rem] border border-on-surface/10 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-extrabold text-on-surface font-headline flex items-center gap-2">
                <Tag size={18} className="text-primary" />
                Por Categorías
              </h2>
              <span className="text-[10px] font-black uppercase text-on-surface-variant/60">
                {categoryBreakdown.length} rubros
              </span>
            </div>

            {categoryBreakdown.length === 0 ? (
              <p className="text-xs text-on-surface-variant/60 font-medium text-center py-4">Sin gastos categorizados</p>
            ) : (
              <div className="space-y-4">
                {categoryBreakdown.map(item => (
                  <div key={item.category.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0 text-[10px]", item.category.color || 'bg-slate-500')}>
                          <IconComponent name={item.category.icon || 'Tag'} size={12} />
                        </div>
                        <span className="font-bold text-on-surface truncate">{item.category.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-on-surface">{formatCurrency(item.total, project.currency)}</span>
                        <span className="text-[10px] font-black text-primary font-mono w-8 text-right">{item.percentage}%</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Expense History & Installments Tabs */}
        <section className="lg:col-span-8 space-y-6">
          {/* Tabs Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div className="flex bg-surface-container-low p-1.5 rounded-2xl border border-on-surface/5">
              <button
                type="button"
                onClick={() => setActiveTab('transactions')}
                className={cn(
                  "py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center gap-2 uppercase tracking-wider",
                  activeTab === 'transactions'
                    ? "bg-surface-container-lowest text-primary shadow-sm"
                    : "text-on-surface-variant/60 hover:text-on-surface"
                )}
              >
                <span>Historial</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-on-surface/5 font-mono">
                  {transactions.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('installments')}
                className={cn(
                  "py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center gap-2 uppercase tracking-wider",
                  activeTab === 'installments'
                    ? "bg-surface-container-lowest text-primary shadow-sm"
                    : "text-on-surface-variant/60 hover:text-on-surface"
                )}
              >
                <Layers size={14} />
                <span>Cuotas & Financiaciones</span>
                {projectInstallmentPlans.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary text-white font-mono font-bold">
                    {projectInstallmentPlans.length}
                  </span>
                )}
              </button>
            </div>

            <div className="text-xs font-bold text-on-surface-variant/70">
              {activeTab === 'transactions' 
                ? (filteredTransactions.length === 0 
                    ? '0 movimientos' 
                    : (hasMore 
                        ? `Mostrando ${paginatedTransactions.length} de ${filteredTransactions.length} movimientos` 
                        : `${filteredTransactions.length} movimiento${filteredTransactions.length > 1 ? 's' : ''}`))
                : `${projectInstallmentPlans.length} planes activos`}
            </div>
          </div>

          {/* TAB 1: Transactions History */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              {/* Search & Filters Bar */}
              {transactions.length > 0 && (
                <div className="bg-surface-container-lowest p-4 rounded-2xl border border-on-surface/10 space-y-3 shadow-xs">
                  {/* Search Input */}
                  <div className="relative">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por descripción, concepto o categoría..."
                      className="w-full bg-surface-container-low border border-on-surface/10 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-on-surface p-0.5"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Filter Chips: Authors & Categories */}
                  <div className="pt-1 border-t border-on-surface/5">
                    {/* Authors Filter */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                      <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/50 mr-1 shrink-0">Por:</span>
                      <button
                        onClick={() => setFilterAuthor('all')}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0",
                          filterAuthor === 'all'
                            ? "bg-primary text-white shadow-xs"
                            : "bg-surface-container-low text-on-surface-variant/70 hover:bg-surface-container"
                        )}
                      >
                        Todos
                      </button>
                      {members.map(m => (
                        <button
                          key={m.id}
                          onClick={() => setFilterAuthor(m.id)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 truncate max-w-[120px]",
                            filterAuthor === m.id
                              ? "bg-primary text-white shadow-xs"
                              : "bg-surface-container-low text-on-surface-variant/70 hover:bg-surface-container"
                          )}
                        >
                          {m.name || 'Usuario'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Transaction List or Empty State */}
              {transactions.length === 0 ? (
                <div className="bg-surface-container-low/50 border-2 border-dashed border-on-surface/10 rounded-[2.5rem] p-16 text-center">
                  <div className="w-20 h-20 bg-on-surface/5 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Plus size={40} className="text-on-surface-variant/30" />
                  </div>
                  <h3 className="text-xl font-bold text-on-surface mb-2">Sin gastos registrados</h3>
                  <p className="text-on-surface-variant/70 max-w-xs mx-auto">Comienza a registrar los gastos compartidos de este proyecto.</p>
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="bg-surface-container-low/50 border-2 border-dashed border-on-surface/10 rounded-3xl p-12 text-center space-y-2">
                  <p className="text-sm font-bold text-on-surface">No se encontraron movimientos con los filtros aplicados</p>
                  <p className="text-xs text-on-surface-variant/60">Prueba cambiando el término de búsqueda o el colaborador seleccionado.</p>
                  <button
                    onClick={() => { setSearchQuery(''); setFilterAuthor('all'); }}
                    className="mt-2 px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition-opacity"
                  >
                    Restablecer filtros
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {paginatedTransactions.map((t) => {
                    const cat = categories.find(c => c.id === t.categoryId);
                    const member = members.find(m => m.id === t.authorId);
                    return (
                      <div 
                        key={t.id} 
                        onClick={() => navigate(`/edit/${t.id}`)}
                        className="bg-surface-container-lowest p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-between hover:shadow-md transition-all border border-on-surface/10 cursor-pointer group active:scale-[0.99] gap-3 min-w-0"
                      >
                        <div className="flex items-center gap-3.5 sm:gap-5 min-w-0 flex-1">
                          <div className={cn(
                            "w-11 h-11 sm:w-14 sm:h-14 rounded-2xl sm:rounded-full flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 shrink-0",
                            cat?.color || 'bg-slate-500'
                          )}>
                            <div className="text-white">
                              <IconComponent name={cat?.icon || 'Tag'} size={20} />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-on-surface text-base sm:text-lg leading-tight truncate">{t.description || 'Sin descripción'}</h3>
                            <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap min-w-0">
                              <span className="text-xs font-medium text-on-surface-variant">Por <span className="text-primary dark:text-blue-400 font-bold">{member?.name || 'Usuario'}</span></span>
                              <span className="w-1 h-1 rounded-full bg-on-surface-variant/30"></span>
                              <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest truncate max-w-[100px] sm:max-w-none">
                                {cat?.name || 'Otros'}
                              </span>
                              {t.isInstallment && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-on-surface-variant/30"></span>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary dark:text-blue-400 text-[10px] font-black border border-primary/10">
                                    <CreditCard size={11} />
                                    <span>Cuota {t.installmentNumber}/{t.totalInstallments}</span>
                                  </span>
                                  {t.cardName && (
                                    <span className="text-[10px] text-on-surface-variant font-medium">
                                      ({t.cardName})
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <div className={cn(
                            "text-base sm:text-2xl font-black tracking-tight font-headline whitespace-nowrap",
                            t.type === 'expense' ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                          )}>
                            {t.type === 'expense' ? '-' : '+'}{formatCurrency(t.amount, project.currency)}
                          </div>
                          <div className="text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-widest mt-0.5">
                            {new Date(t.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Infinite scroll sentinel and load more fallback button */}
                  {hasMore && (
                    <div className="pt-3 pb-1 flex flex-col items-center gap-2">
                      <div ref={sentinelRef} className="h-4 w-full" />
                      <button
                        onClick={() => setVisibleLimit(prev => Math.min(prev + 10, filteredTransactions.length))}
                        className="px-6 py-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-on-surface/10 text-xs font-bold text-on-surface transition-all active:scale-95 cursor-pointer shadow-xs"
                      >
                        Cargar 10 movimientos más ({filteredTransactions.length - visibleLimit} restantes)...
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Cuotas & Financiaciones */}
          {activeTab === 'installments' && (
            <div className="space-y-6">
              {/* Summary Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-surface-container-lowest p-6 rounded-[2rem] border border-on-surface/10 shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-on-surface-variant/70 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider">Compromiso Futuro del Proyecto</span>
                    <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                      <TrendingUp size={16} />
                    </div>
                  </div>
                  <div className="text-3xl font-black font-headline text-rose-600">
                    {formatCurrency(totalCommittedFuture, project.currency)}
                  </div>
                  <p className="text-xs text-on-surface-variant/70 font-medium pt-1">
                    Saldo remanente por pagar en cuotas venideras
                  </p>
                </div>

                <div className="bg-surface-container-lowest p-6 rounded-[2rem] border border-on-surface/10 shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-on-surface-variant/70 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider">Compras Financiadas</span>
                    <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Layers size={16} />
                    </div>
                  </div>
                  <div className="text-3xl font-black font-headline text-on-surface">
                    {projectInstallmentPlans.length}
                  </div>
                  <p className="text-xs text-on-surface-variant/70 font-medium pt-1">
                    Planes de cuotas activos en esta bóveda
                  </p>
                </div>
              </div>

              {/* Plans List */}
              {projectInstallmentPlans.length === 0 ? (
                <div className="bg-surface-container-low/50 border-2 border-dashed border-on-surface/10 rounded-[2.5rem] p-16 text-center space-y-3">
                  <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-2">
                    <CreditCard size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-on-surface">Sin compras en cuotas en este proyecto</h3>
                  <p className="text-xs text-on-surface-variant/70 max-w-sm mx-auto">
                    Cuando algún colaborador registre un gasto pagado con Tarjeta de Crédito en más de 1 cuota, verás aquí el estado de amortización y los compromisos a futuro.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Sub-filter chips */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    <button
                      onClick={() => setPlanFilter('all')}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs font-bold transition-all border",
                        planFilter === 'all'
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-surface-container-low text-on-surface-variant/70 border-transparent hover:bg-surface-container"
                      )}
                    >
                      Todas ({projectInstallmentPlans.length})
                    </button>
                    <button
                      onClick={() => setPlanFilter('mine')}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs font-bold transition-all border",
                        planFilter === 'mine'
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-surface-container-low text-on-surface-variant/70 border-transparent hover:bg-surface-container"
                      )}
                    >
                      Financiadas por mí ({projectInstallmentPlans.filter(p => p.authorId === currentUser?.uid).length})
                    </button>
                    <button
                      onClick={() => setPlanFilter('others')}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs font-bold transition-all border",
                        planFilter === 'others'
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-surface-container-low text-on-surface-variant/70 border-transparent hover:bg-surface-container"
                      )}
                    >
                      Financiadas por otros ({projectInstallmentPlans.filter(p => p.authorId !== currentUser?.uid).length})
                    </button>
                  </div>

                  {filteredInstallmentPlans.length === 0 ? (
                    <div className="bg-surface-container-lowest p-8 rounded-[2rem] border border-on-surface/10 text-center text-xs text-on-surface-variant/60 font-medium">
                      No hay compras en cuotas para el filtro seleccionado.
                    </div>
                  ) : (
                    filteredInstallmentPlans.map((plan) => {
                      const cat = categories.find(c => c.id === plan.categoryId);
                      return (
                        <div 
                          key={plan.id}
                          className="bg-surface-container-lowest p-6 rounded-[2rem] border border-on-surface/10 shadow-sm space-y-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-4 overflow-hidden">
                              <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm",
                                cat?.color || 'bg-slate-700'
                              )}>
                                <IconComponent name={cat?.icon || 'Tag'} size={22} />
                              </div>
                              <div className="truncate">
                                <h3 className="font-extrabold text-on-surface text-base truncate leading-tight">
                                  {plan.description}
                                </h3>
                                <div className="flex items-center gap-2 mt-1.5 text-xs text-on-surface-variant/70 flex-wrap">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider",
                                    plan.authorId === currentUser?.uid
                                      ? "bg-primary/10 text-primary"
                                      : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                                  )}>
                                    {plan.authorId === currentUser?.uid ? 'Financiado por Ti' : `Financiado por ${plan.authorMember?.name || 'Miembro'}`}
                                  </span>
                                  {plan.cardName && (
                                    <span className="text-[11px] font-bold text-on-surface-variant/70 flex items-center gap-1">
                                      <CreditCard size={12} className="text-primary" />
                                      {plan.cardName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                          <div className="text-right shrink-0">
                            <p className="text-lg font-black text-on-surface font-headline">
                              {formatCurrency(plan.installmentAmount, project.currency)}
                              <span className="text-[10px] text-on-surface-variant/60 font-medium"> /mes</span>
                            </p>
                            <p className="text-[10px] font-extrabold text-rose-600">
                              Resta: {formatCurrency(plan.remainingAmount, project.currency)}
                            </p>
                          </div>
                        </div>

                        {/* Progress Bar & Badges */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-on-surface">
                              {plan.paidCount} de {plan.totalInstallments} cuotas amortizadas
                            </span>
                            <span className="font-black text-primary text-[11px]">
                              {plan.progressPercent}% completado
                            </span>
                          </div>

                          <div className="w-full h-2.5 bg-surface-container-low rounded-full overflow-hidden p-0.5">
                            <div 
                              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 shadow-xs transition-all duration-500" 
                              style={{ width: `${plan.progressPercent}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-on-surface-variant/60 font-medium pt-0.5">
                            <span>Total financiado: {formatCurrency(plan.originalPurchaseAmount || plan.amount, project.currency)}</span>
                            <span>Restan {plan.remainingCount} {plan.remainingCount === 1 ? 'cuota' : 'cuotas'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Invite Modal */}
      <AnimatePresence>
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsInviteModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-surface-container-lowest w-full max-w-md rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative z-10 flex flex-col max-h-[90vh] overflow-y-auto border border-on-surface/10"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-extrabold text-on-surface font-headline">Invitar Colaborador</h2>
                <button onClick={() => setIsInviteModalOpen(false)} className="p-2 hover:bg-on-surface/5 rounded-full transition-colors text-on-surface-variant">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleInvite} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3 ml-1">Correo Electrónico</label>
                  <input 
                    type="email" 
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className="w-full bg-surface-container-low border border-on-surface/10 text-on-surface placeholder:text-on-surface-variant/40 rounded-2xl p-4 text-lg font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  />
                  {inviteError && <p className="text-rose-500 text-xs font-bold mt-2 ml-1">{inviteError}</p>}
                </div>

                <button 
                  type="submit"
                  disabled={isInviting || !inviteEmail}
                  className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20 hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {isInviting ? <Loader2 size={24} className="animate-spin" /> : <UserPlus size={24} />}
                  {isInviting ? 'Invitando...' : 'Enviar Invitación'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <Link 
        to={`/add?projectId=${id}`}
        className="fixed bottom-24 right-6 md:right-12 w-16 h-16 bg-primary text-white rounded-2xl shadow-2xl shadow-primary/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-40 group"
      >
        <Plus size={32} />
      </Link>
    </div>
  );
};
