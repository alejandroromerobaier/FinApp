import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Users, Utensils, Hotel, Car, ShoppingCart, ArrowLeft, Bell, ExternalLink, Plus, X, UserPlus, Trash2, Loader2, MoreHorizontal, ShoppingBag, Play, Heart, Book, Landmark, Tag, Gift, Briefcase, Home, Plane, Coffee, Zap, Smartphone, ShieldCheck, CreditCard, Layers, TrendingUp, Clock, CheckCircle2, ArrowLeftRight } from 'lucide-react';
import { formatCurrency, cn } from '@/src/lib/utils';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getTransactions, removeMemberFromProject, inviteUserToProjectByEmail, getUsersByIds } from '../services/firestoreService';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { expandProjectedTransactions } from '../lib/installmentUtils';
import { getLocalMonth } from '../lib/dateUtils';

const ICON_MAP: Record<string, any> = {
  ShoppingBag, Utensils, Car, Play, Heart, Book, MoreHorizontal, 
  Landmark, Tag, Gift, Briefcase, Home, Plane, Coffee, Zap, Smartphone, ShieldCheck, Hotel, ShoppingCart, ArrowLeftRight
};

const IconComponent = ({ name, size = 20 }: { name: string, size?: number }) => {
  const Icon = ICON_MAP[name] || MoreHorizontal;
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
  const [activeTab, setActiveTab] = useState<'transactions' | 'installments' | 'savings'>('transactions');
  const [planFilter, setPlanFilter] = useState<'all' | 'mine' | 'others'>('all');
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

  const transferStats = useMemo(() => {
    // Only incoming transfers into this project or currency exchange operations
    const inTransfers = rawTransactions
      .filter(t => t.isTransfer && t.transferDirection === 'in')
      .sort((a, b) => {
        const da = a.date instanceof Date ? a.date : new Date(a.date);
        const db = b.date instanceof Date ? b.date : new Date(b.date);
        return db.getTime() - da.getTime();
      });

    const totalAcquired = inTransfers.reduce((acc, t) => acc + (t.amount || 0), 0);
    const totalSpent = inTransfers.reduce((acc, t) => {
      if (t.relatedAmount && t.relatedAmount > 0) return acc + t.relatedAmount;
      if (t.exchangeRate && t.exchangeRate > 0) return acc + (t.amount * t.exchangeRate);
      return acc;
    }, 0);

    const weightedAvgRate = totalAcquired > 0 ? (totalSpent / totalAcquired) : 0;
    const latestTransfer = inTransfers[0] || null;
    const latestRate = latestTransfer?.exchangeRate || 0;

    return {
      inTransfers,
      totalAcquired,
      totalSpent,
      weightedAvgRate,
      latestRate,
      hasTransfers: inTransfers.length > 0
    };
  }, [rawTransactions]);

  const isUsdProject = (project?.currency || '').toUpperCase() === 'USD' || transferStats.hasTransfers;

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

    const totalExpenses = validTransactions.reduce((acc, t) => acc + (t.type === 'expense' ? t.amount : 0), 0);
    const totalIncome = validTransactions.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : 0), 0);
    const balance = totalIncome - totalExpenses;
    const byMember: Record<string, number> = {};

    let currentMonthExpenses = 0;
    let currentMonthIncome = 0;

    validTransactions.forEach(t => {
      if (t.type === 'expense') {
        byMember[t.authorId] = (byMember[t.authorId] || 0) + t.amount;
      }
      
      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
      if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
        if (t.type === 'expense') {
          currentMonthExpenses += t.amount;
        } else if (t.type === 'income') {
          currentMonthIncome += t.amount;
        }
      }
    });

    const contributorStats = members.map(m => ({
      ...m,
      amount: byMember[m.id] || 0,
      percentage: totalExpenses > 0 ? Math.round(((byMember[m.id] || 0) / totalExpenses) * 100) : 0
    })).sort((a, b) => b.amount - a.amount);

    return { 
      total: totalExpenses, 
      totalExpenses,
      totalIncome,
      balance,
      currentMonthTotal: currentMonthExpenses, 
      currentMonthExpenses,
      currentMonthIncome,
      contributorStats 
    };
  }, [transactions, members]);

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
                <div className="bg-primary text-white p-6 rounded-3xl shadow-xl shadow-primary/20 min-w-[200px]">
                  <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">
                    {isUsdProject ? 'Saldo Total de Bóveda' : 'Gasto del Mes'}
                  </p>
                  <div className="text-3xl font-black tracking-tight font-headline">
                    {formatCurrency(isUsdProject ? stats.balance : stats.currentMonthTotal, project.currency)}
                  </div>
                  <p className="text-white/60 text-[9px] font-bold uppercase mt-2">
                    {isUsdProject 
                      ? `Ingreso del Mes: ${formatCurrency(stats.currentMonthIncome, project.currency)}`
                      : `Total Histórico: ${formatCurrency(stats.total, project.currency)}`
                    }
                  </p>
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
                <span>Cuotas</span>
                {projectInstallmentPlans.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary text-white font-mono font-bold">
                    {projectInstallmentPlans.length}
                  </span>
                )}
              </button>

              {isUsdProject && (
                <button
                  type="button"
                  onClick={() => setActiveTab('savings')}
                  className={cn(
                    "py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center gap-2 uppercase tracking-wider",
                    activeTab === 'savings'
                      ? "bg-surface-container-lowest text-cyan-600 dark:text-cyan-400 shadow-sm"
                      : "text-on-surface-variant/60 hover:text-on-surface"
                  )}
                >
                  <ArrowLeftRight size={14} />
                  <span>Cotizaciones & Ahorro</span>
                  {transferStats.inTransfers.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-cyan-600 text-white font-mono font-bold">
                      {transferStats.inTransfers.length}
                    </span>
                  )}
                </button>
              )}
            </div>

            <div className="text-xs font-bold text-on-surface-variant/70">
              {activeTab === 'transactions' 
                ? `${transactions.length} registros` 
                : activeTab === 'installments' 
                  ? `${projectInstallmentPlans.length} planes activos` 
                  : `${transferStats.inTransfers.length} compras / cambios`}
            </div>
          </div>

          {/* TAB 1: Transactions History */}
          {activeTab === 'transactions' && (
            <div>
              {transactions.length === 0 ? (
                <div className="bg-surface-container-low/50 border-2 border-dashed border-on-surface/10 rounded-[2.5rem] p-16 text-center">
                  <div className="w-20 h-20 bg-on-surface/5 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Plus size={40} className="text-on-surface-variant/30" />
                  </div>
                  <h3 className="text-xl font-bold text-on-surface mb-2">Sin gastos registrados</h3>
                  <p className="text-on-surface-variant/70 max-w-xs mx-auto">Comienza a registrar los gastos compartidos de este proyecto.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {transactions.map((t) => {
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
                            t.isTransfer ? "bg-cyan-600" : (cat?.color || 'bg-slate-500')
                          )}>
                            <div className="text-white">
                              <IconComponent name={t.isTransfer ? 'ArrowLeftRight' : (cat?.icon || 'Tag')} size={20} />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-on-surface text-base sm:text-lg leading-tight truncate">{t.description || 'Sin descripción'}</h3>
                            <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap min-w-0">
                              <span className="text-xs font-medium text-on-surface-variant">Por <span className="text-primary dark:text-blue-400 font-bold">{member?.name || 'Usuario'}</span></span>
                              <span className="w-1 h-1 rounded-full bg-on-surface-variant/30"></span>
                              <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest truncate max-w-[100px] sm:max-w-none">
                                {t.isTransfer ? 'Transferencia' : (cat?.name || 'Otros')}
                              </span>
                              {t.isTransfer && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-on-surface-variant/30"></span>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[10px] font-black border border-cyan-500/20">
                                    <ArrowLeftRight size={10} />
                                    <span>{t.transferDirection === 'out' ? 'Salida' : 'Entrada'}</span>
                                    {t.exchangeRate && t.isCurrencyExchange && <span>• TC: ${formatCurrency(t.exchangeRate, 'ARS')}</span>}
                                  </span>
                                </>
                              )}
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
                </div>
              )}
            </div>
          )}

          {/* TAB: Cotizaciones & Ahorro Histórico */}
          {activeTab === 'savings' && (
            <div className="space-y-8">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-surface-container-lowest p-5 rounded-3xl border border-on-surface/10 shadow-sm">
                  <span className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-widest block mb-2">
                    Total Adquirido / Ingresado
                  </span>
                  <p className="text-2xl font-black font-headline text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(transferStats.totalAcquired, project.currency)}
                  </p>
                  <p className="text-[11px] text-on-surface-variant/70 font-semibold mt-1">
                    {transferStats.inTransfers.length} operaciones registradas
                  </p>
                </div>

                <div className="bg-surface-container-lowest p-5 rounded-3xl border border-on-surface/10 shadow-sm">
                  <span className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-widest block mb-2">
                    Total Invertido
                  </span>
                  <p className="text-2xl font-black font-headline text-on-surface">
                    {formatCurrency(transferStats.totalSpent, 'ARS')}
                  </p>
                  <p className="text-[11px] text-on-surface-variant/70 font-semibold mt-1">
                    Costo total en pesos
                  </p>
                </div>

                <div className="bg-gradient-to-br from-cyan-500/10 via-sky-500/5 to-transparent p-5 rounded-3xl border border-cyan-500/20 shadow-sm">
                  <span className="text-[10px] font-black text-cyan-800 dark:text-cyan-200 uppercase tracking-widest block mb-2">
                    TC Promedio Ponderado
                  </span>
                  <p className="text-2xl font-black font-headline text-cyan-600 dark:text-cyan-400">
                    ${formatCurrency(transferStats.weightedAvgRate, 'ARS')}
                  </p>
                  <p className="text-[11px] text-on-surface-variant/70 font-semibold mt-1">
                    Costo medio por cada dólar
                  </p>
                </div>

                <div className="bg-surface-container-lowest p-5 rounded-3xl border border-on-surface/10 shadow-sm">
                  <span className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-widest block mb-2">
                    Última Cotización
                  </span>
                  <p className="text-2xl font-black font-headline text-primary">
                    {transferStats.latestRate > 0 ? `$${formatCurrency(transferStats.latestRate, 'ARS')}` : 'Sin datos'}
                  </p>
                  <p className="text-[11px] text-on-surface-variant/70 font-semibold mt-1">
                    Último cambio realizado
                  </p>
                </div>
              </div>

              {/* Acquisitions List */}
              <div className="bg-surface-container-lowest p-6 rounded-3xl border border-on-surface/10 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-extrabold text-on-surface font-headline">Historial de Compras & Cotizaciones</h3>
                    <p className="text-xs text-on-surface-variant font-medium">Registro detallado de cada ingreso de divisas y su tasa de cambio aplicada.</p>
                  </div>
                </div>

                {transferStats.inTransfers.length === 0 ? (
                  <div className="text-center py-12 text-on-surface-variant/60">
                    <ArrowLeftRight size={32} className="mx-auto mb-3 opacity-30 text-cyan-600" />
                    <p className="text-sm font-bold">Aún no hay compras o transferencias registradas hacia este proyecto.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transferStats.inTransfers.map((t) => {
                      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
                      return (
                        <div
                          key={t.id}
                          onClick={() => navigate(`/edit/${t.id}`)}
                          className="p-4 rounded-2xl bg-surface-container-low hover:bg-on-surface/5 transition-all border border-on-surface/5 flex items-center justify-between gap-4 cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                              <ArrowLeftRight size={18} />
                            </div>
                            <div>
                              <p className="font-extrabold text-sm text-on-surface">{t.description || 'Compra de Divisas'}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-on-surface-variant">
                                <span>{tDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                {t.relatedProjectName && (
                                  <>
                                    <span>•</span>
                                    <span>Desde: <strong>{t.relatedProjectName}</strong></span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-base font-black font-headline text-emerald-600 dark:text-emerald-400">
                              +{formatCurrency(t.amount, project.currency)}
                            </p>
                            <p className="text-xs font-bold text-on-surface-variant font-mono">
                              {t.exchangeRate ? `TC: $${formatCurrency(t.exchangeRate, 'ARS')}` : ''}
                              {t.relatedAmount ? ` (${formatCurrency(t.relatedAmount, 'ARS')})` : ''}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
