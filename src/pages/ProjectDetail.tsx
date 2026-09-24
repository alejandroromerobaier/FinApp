import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Users, Utensils, Hotel, Car, ShoppingCart, ArrowLeft, Bell, ExternalLink, Plus, X, UserPlus, Trash2, Loader2, MoreHorizontal, ShoppingBag, Play, Heart, Book, Landmark, Tag, Gift, Briefcase, Home, Plane, Coffee, Zap, Smartphone, ShieldCheck } from 'lucide-react';
import { formatCurrency, cn } from '@/src/lib/utils';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getTransactions, removeMemberFromProject, inviteUserToProjectByEmail, getUsersByIds } from '../services/firestoreService';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';

const ICON_MAP: Record<string, any> = {
  ShoppingBag, Utensils, Car, Play, Heart, Book, MoreHorizontal, 
  Landmark, Tag, Gift, Briefcase, Home, Plane, Coffee, Zap, Smartphone, ShieldCheck, Hotel, ShoppingCart
};

const IconComponent = ({ name, size = 20 }: { name: string, size?: number }) => {
  const Icon = ICON_MAP[name] || MoreHorizontal;
  return <Icon size={size} />;
};

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, categories } = useData();
  const { user: currentUser } = useAuth();
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const project = useMemo(() => projects.find(p => p.id === id), [projects, id]);
  const isOwner = project?.ownerId === currentUser?.uid;

  useEffect(() => {
    if (!id) return;

    const unsubscribe = getTransactions(id, (data) => {
      setTransactions(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

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
    const total = transactions.reduce((acc, t) => acc + (t.type === 'expense' ? t.amount : 0), 0);
    const byMember: Record<string, number> = {};
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let currentMonthTotal = 0;

    transactions.forEach(t => {
      if (t.type === 'expense') {
        byMember[t.authorId] = (byMember[t.authorId] || 0) + t.amount;
        
        const tDate = new Date(t.date);
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
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-black/40 font-bold text-xs uppercase tracking-widest">Cargando detalles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 max-w-5xl mx-auto py-8 pb-32">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-3 bg-white rounded-2xl shadow-sm border border-black/5 hover:bg-black/5 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1 block">Proyecto Compartido</span>
            <h2 className="text-2xl font-extrabold text-on-surface font-headline leading-tight">{project.name}</h2>
          </div>
        </div>
        {isOwner && (
          <button 
            onClick={() => setIsInviteModalOpen(true)}
            className="bg-primary/10 text-primary p-3 rounded-2xl hover:bg-primary/20 transition-colors flex items-center gap-2"
          >
            <UserPlus size={20} />
            <span className="hidden sm:inline font-bold text-sm">Invitar</span>
          </button>
        )}
      </div>

      {/* Hero Stats */}
      <section className="mb-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                    Proyecto Activo
                  </span>
                  <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-2 font-headline">{project.name}</h1>
                  <p className="text-on-surface-variant/60 flex items-center gap-2 font-medium">
                    <Calendar size={16} />
                    Creado el {new Date(project.createdAt?.toDate()).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div className="bg-primary text-white p-6 rounded-3xl shadow-xl shadow-primary/20 min-w-[200px]">
                  <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">Gasto del Mes</p>
                  <div className="text-3xl font-black tracking-tight font-headline">{formatCurrency(stats.currentMonthTotal, project.currency)}</div>
                  <p className="text-white/40 text-[9px] font-bold uppercase mt-2">Total: {formatCurrency(stats.total, project.currency)}</p>
                </div>
              </div>
              <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-primary/5 blur-3xl rounded-full"></div>
            </div>
          </div>
          
          <div className="md:col-span-4 bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
            <h3 className="text-sm font-black text-on-surface uppercase tracking-widest mb-6 flex items-center gap-2">
              <Users size={18} className="text-primary" />
              Colaboradores
            </h3>
            <div className="flex -space-x-3 mb-6">
              {members.map((m, i) => (
                <div key={m.id} className="w-12 h-12 rounded-full border-4 border-white bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shadow-sm overflow-hidden">
                  {m.photoURL ? <img src={m.photoURL} alt={m.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : m.name.substring(0, 2).toUpperCase()}
                </div>
              ))}
              {isOwner && (
                <button 
                  onClick={() => setIsInviteModalOpen(true)}
                  className="w-12 h-12 rounded-full border-4 border-white bg-black/5 flex items-center justify-center text-black/20 hover:bg-black/10 transition-colors"
                >
                  <Plus size={20} />
                </button>
              )}
            </div>
            <p className="text-xs text-on-surface-variant/60 font-medium">
              {members.length} personas compartiendo gastos en esta bóveda.
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Sidebar: Contributors */}
        <aside className="lg:col-span-4 space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
            <h2 className="text-lg font-extrabold text-on-surface mb-8 flex items-center gap-2 font-headline">
              Contribuciones
            </h2>
            <div className="space-y-6">
              {stats.contributorStats.map((m) => (
                <div key={m.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-sm bg-black/5 flex items-center justify-center border border-black/5">
                      {m.photoURL ? <img src={m.photoURL} className="w-full h-full object-cover" alt={m.name} referrerPolicy="no-referrer" /> : <span className="font-bold text-black/20">{m.name.substring(0, 2).toUpperCase()}</span>}
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

        {/* Expense History */}
        <section className="lg:col-span-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-extrabold text-on-surface font-headline">Historial de Gastos</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-black/40">{transactions.length} registros</span>
            </div>
          </div>
          
          {transactions.length === 0 ? (
            <div className="bg-white/50 border-2 border-dashed border-black/5 rounded-[2.5rem] p-16 text-center">
              <div className="w-20 h-20 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-6">
                <Plus size={40} className="text-black/10" />
              </div>
              <h3 className="text-xl font-bold text-on-surface mb-2">Sin gastos registrados</h3>
              <p className="text-on-surface-variant/60 max-w-xs mx-auto">Comienza a registrar los gastos compartidos de este proyecto.</p>
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
                    className="bg-white p-6 rounded-[2rem] flex items-center justify-between hover:shadow-md transition-all border border-black/5 cursor-pointer group active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-5">
                      <div className={cn(
                        "w-14 h-14 rounded-full flex items-center justify-center shadow-sm transition-transform group-hover:scale-110",
                        cat?.color || 'bg-slate-100'
                      )}>
                        <div className="text-white">
                          <IconComponent name={cat?.icon || 'Tag'} size={24} />
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-on-surface text-lg leading-tight">{t.description || 'Sin descripción'}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-medium text-on-surface-variant/60">Por <span className="text-primary font-bold">{member?.name || 'Usuario'}</span></span>
                          <span className="w-1 h-1 rounded-full bg-black/10"></span>
                          <span className="text-[10px] font-black text-black/40 uppercase tracking-widest">
                            {cat?.name || 'Otros'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "text-2xl font-black tracking-tight font-headline",
                        t.type === 'expense' ? "text-rose-600" : "text-emerald-600"
                      )}>
                        {t.type === 'expense' ? '-' : '+'}{formatCurrency(t.amount, project.currency)}
                      </div>
                      <div className="text-[10px] font-black text-black/20 uppercase tracking-widest mt-0.5">
                        {new Date(t.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  </div>
                );
              })}
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
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative z-10"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-extrabold text-on-surface font-headline">Invitar Colaborador</h2>
                <button onClick={() => setIsInviteModalOpen(false)} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleInvite} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-black/40 uppercase tracking-widest mb-3 ml-1">Correo Electrónico</label>
                  <input 
                    type="email" 
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className="w-full bg-[#F2F2F7] border-none rounded-2xl p-4 text-lg font-bold focus:ring-2 focus:ring-primary/20 transition-all"
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
