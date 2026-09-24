import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Filter, 
  ChevronRight, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calendar, 
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
  Home,
  Plane,
  Coffee,
  Zap,
  Smartphone,
  ShieldCheck,
  X,
  Loader2,
  ChevronLeft,
  Trash2,
  Wallet,
  CreditCard,
  Clock
} from 'lucide-react';
import { formatCurrency, cn } from '@/src/lib/utils';
import { getGlobalTransactions, deleteTransaction } from '../services/firestoreService';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';

const ICON_MAP: Record<string, any> = {
  ShoppingBag, Utensils, Car, Play, Heart, Book, MoreHorizontal, 
  Landmark, Tag, Gift, Briefcase, Home, Plane, Coffee, Zap, Smartphone, ShieldCheck
};

const IconComponent = ({ name, size = 20 }: { name: string, size?: number }) => {
  const Icon = ICON_MAP[name] || MoreHorizontal;
  return <Icon size={size} />;
};

const timeFormatter = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });
const dateGroupFormatter = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

const formatTime = (rawDate: any): string => {
  if (!rawDate) return '';
  try {
    const d = rawDate instanceof Date ? rawDate : (typeof rawDate?.toDate === 'function' ? rawDate.toDate() : new Date(rawDate));
    if (isNaN(d.getTime())) return '';
    return timeFormatter.format(d);
  } catch {
    return '';
  }
};

export const History: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { categories, projects, transactions, userNames, loading: dataLoading } = useData();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterClassification, setFilterClassification] = useState<'all' | 'fixed' | 'variable'>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'all'>('all');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!dataLoading) {
      setLoading(false);
    }
  }, [dataLoading]);

  // Dynamically get categories that actually exist in transactions or defined categories
  const dynamicCategories = useMemo(() => {
    const categoryIdsInTransactions = new Set(transactions.map(t => t.categoryId));
    const usedCategories = categories.filter(c => categoryIdsInTransactions.has(c.id));
    
    // Also include categories that might be denormalized only (e.g. from shared projects)
    const denormalizedCats: any[] = [];
    transactions.forEach(t => {
      if (!categories.find(c => c.id === t.categoryId) && !denormalizedCats.find(c => c.id === t.categoryId)) {
        if (t.categoryId) {
          denormalizedCats.push({
            id: t.categoryId,
            name: t.categoryName || 'Otros',
            icon: t.categoryIcon || 'MoreHorizontal',
            color: t.categoryColor || 'bg-slate-400'
          });
        }
      }
    });

    return [...usedCategories, ...denormalizedCats].sort((a, b) => a.name.localeCompare(b.name));
  }, [transactions, categories]);

  const periodLabel = useMemo(() => {
    if (selectedPeriod === 'all') return 'Todo el Tiempo';
    const months = selectedPeriod === 'monthly' ? 1 : selectedPeriod === 'quarterly' ? 3 : selectedPeriod === 'semiannual' ? 6 : 12;
    if (months === 1) {
      return currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    }
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const end = new Date(year, month + 1, 0);
    const start = new Date(year, month - (months - 1), 1);
    return `${start.toLocaleDateString('es-ES', { month: 'short' })} - ${end.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}`;
  }, [selectedPeriod, currentDate]);

  const changeMonth = (delta: number) => {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + delta);
    setCurrentDate(next);
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = t.description?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           t.categoryName?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || t.type === filterType;
      const matchesCategory = filterCategory === 'all' || t.categoryId === filterCategory;
      const matchesProject = filterProject === 'all' 
        ? true 
        : filterProject === 'personal' 
          ? !t.projectId 
          : t.projectId === filterProject;
      const matchesClassification = filterClassification === 'all' || t.classification === filterClassification;
      
      let matchesPeriod = true;
      if (selectedPeriod !== 'all') {
        const tDate = new Date(t.date);
        const months = selectedPeriod === 'monthly' ? 1 : selectedPeriod === 'quarterly' ? 3 : selectedPeriod === 'semiannual' ? 6 : 12;
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        // Full end of month (e.g. Sept 30th 23:59:59.999 instead of Sept 8th)
        const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
        const start = new Date(year, month - (months - 1), 1, 0, 0, 0, 0);
        matchesPeriod = tDate >= start && tDate <= end;
      }

      return matchesSearch && matchesType && matchesCategory && matchesProject && matchesClassification && matchesPeriod;
    });
  }, [transactions, searchQuery, filterType, filterCategory, filterProject, filterClassification, selectedPeriod, currentDate]);

  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    filteredTransactions.forEach(t => {
      const date = t.date instanceof Date ? t.date : new Date(t.date);
      const dateKey = isNaN(date.getTime()) ? 'Fecha Desconocida' : dateGroupFormatter.format(date);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(t);
    });
    return groups;
  }, [filteredTransactions]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 max-w-4xl mx-auto py-6 sm:py-8 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div className="flex items-center gap-3 sm:gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2.5 bg-surface-container-low rounded-xl text-on-surface-variant hover:bg-on-surface/5 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-on-surface font-headline">Historial</h1>
        </div>
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "p-2.5 rounded-xl transition-all flex items-center gap-2 font-bold text-sm",
            showFilters ? "bg-on-surface text-surface-container-lowest" : "bg-surface-container-low text-on-surface-variant hover:bg-on-surface/5"
          )}
        >
          <Filter size={20} />
          <span className="hidden sm:inline">Filtros</span>
        </button>
      </div>

      {/* Period Selector */}
      <section className="space-y-6 mb-8">
        <div className="flex bg-surface-container-low p-1.5 rounded-2xl border border-on-surface/5 gap-1 overflow-x-auto scrollbar-none">
          {[
            { id: 'all', label: 'Todo' },
            { id: 'monthly', label: 'Mes' },
            { id: 'quarterly', label: 'Trim' },
            { id: 'semiannual', label: 'Sem' },
            { id: 'annual', label: 'Año' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedPeriod(p.id as any)}
              className={cn(
                "flex-1 min-w-[50px] py-2 px-1 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all text-center truncate shrink-0 sm:shrink",
                selectedPeriod === p.id 
                  ? "bg-slate-900 text-white shadow-lg" 
                  : "text-on-surface-variant/40 hover:bg-on-surface/5"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {selectedPeriod !== 'all' && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-black p-6 rounded-[2rem] border border-white/10 shadow-xl">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 blur-[40px] rounded-full -mr-12 -mt-12" />
                <div className="relative z-10 flex items-center justify-between">
                  <button onClick={() => changeMonth(-1)} className="p-2.5 bg-white/5 rounded-xl hover:bg-white/10 transition-all text-white active:scale-90 border border-white/5">
                    <ChevronLeft size={20} />
                  </button>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 text-primary/80 mb-1">
                      <Calendar size={12} className="animate-pulse" />
                      <span className="text-[9px] font-black uppercase tracking-[0.3em]">Ventana Temporal</span>
                    </div>
                    <h2 className="text-lg font-black text-white capitalize font-headline tracking-tight">{periodLabel}</h2>
                  </div>
                  <button onClick={() => changeMonth(1)} className="p-2.5 bg-white/5 rounded-xl hover:bg-white/10 transition-all text-white active:scale-90 border border-white/5">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Search Bar */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={20} />
        <input 
          type="text"
          placeholder="Buscar transacciones o categorías..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-surface-container-lowest border border-on-surface/5 rounded-2xl py-4 pl-12 pr-4 text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm text-sm sm:text-base"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-on-surface transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Filter Options (Expandable) */}
      <AnimatePresence>
        {showFilters && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-8 space-y-6"
          >
            <div className="bg-surface-container-lowest rounded-3xl p-4 sm:p-6 border border-on-surface/5 shadow-sm space-y-6">
              {/* Type Filter */}
              <div>
                <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.2em] mb-3 ml-1">Tipo de Transacción</p>
                <div className="flex gap-2">
                  {(['all', 'expense', 'income'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setFilterType(tab)}
                      className={cn(
                        "flex-1 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all border min-w-0 truncate",
                        filterType === tab 
                          ? "bg-on-surface text-surface-container-lowest border-on-surface" 
                          : "bg-surface-container-low text-on-surface-variant/60 border-transparent hover:border-on-surface/10"
                      )}
                    >
                      {tab === 'all' ? 'Todas' : tab === 'expense' ? 'Gastos' : 'Ingresos'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Project Filter */}
              <div>
                <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.2em] mb-3 ml-1">Origen / Proyecto</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilterProject('all')}
                    className={cn(
                      "px-3.5 py-2 rounded-lg font-bold text-xs transition-all border",
                      filterProject === 'all' ? "bg-primary text-white border-primary" : "bg-surface-container-low text-on-surface-variant/60 border-transparent"
                    )}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setFilterProject('personal')}
                    className={cn(
                      "px-3.5 py-2 rounded-lg font-bold text-xs transition-all border",
                      filterProject === 'personal' ? "bg-primary text-white border-primary" : "bg-surface-container-low text-on-surface-variant/60 border-transparent"
                    )}
                  >
                    Solo Personales
                  </button>
                  {projects.map((proj) => (
                    <button
                      key={proj.id}
                      onClick={() => setFilterProject(proj.id)}
                      className={cn(
                        "px-3.5 py-2 rounded-lg font-bold text-xs transition-all border flex items-center gap-2",
                        filterProject === proj.id ? "bg-primary text-white border-primary" : "bg-surface-container-low text-on-surface-variant/60 border-transparent"
                      )}
                    >
                      <Briefcase size={12} />
                      {proj.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Filter */}
              <div>
                <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.2em] mb-3 ml-1">Categoría</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilterCategory('all')}
                    className={cn(
                      "px-3.5 py-2 rounded-lg font-bold text-xs transition-all border",
                      filterCategory === 'all' 
                        ? "bg-primary/10 text-primary border-primary/20" 
                        : "bg-surface-container-low text-on-surface-variant/60 border-transparent hover:border-on-surface/10"
                    )}
                  >
                    Todas
                  </button>
                  {dynamicCategories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setFilterCategory(cat.id)}
                      className={cn(
                        "px-3.5 py-2 rounded-lg font-bold text-xs transition-all border flex items-center gap-2",
                        filterCategory === cat.id 
                          ? "bg-primary/10 text-primary border-primary/20" 
                          : "bg-surface-container-low text-on-surface-variant/60 border-transparent hover:border-on-surface/10"
                      )}
                    >
                      <IconComponent name={cat.icon} size={14} />
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Classification Filter */}
              <div>
                <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.2em] mb-3 ml-1">Clasificación</p>
                <div className="flex gap-2">
                  {(['all', 'variable', 'fixed'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setFilterClassification(tab)}
                      className={cn(
                        "flex-1 py-3 rounded-xl font-bold text-xs transition-all border min-w-0 truncate text-center",
                        filterClassification === tab 
                          ? "bg-primary text-white border-primary" 
                          : "bg-surface-container-low text-on-surface-variant/60 border-transparent hover:border-on-surface/10"
                      )}
                    >
                      {tab === 'all' ? 'Todas' : tab === 'fixed' ? 'Fijas' : 'Variables'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transactions List */}
      <div className="space-y-8">
        {Object.keys(groupedTransactions).length > 0 ? (
          Object.entries(groupedTransactions).map(([date, items]) => (
            <div key={date}>
              <h3 className="text-[11px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] mb-4 ml-1">{date}</h3>
              <div className="space-y-3">
                {(items as any[]).map((t) => {
                  const category = categories.find(c => c.id === t.categoryId);
                  return (
                    <div 
                      key={t.id}
                      className="bg-surface-container-lowest p-3.5 sm:p-4 rounded-2xl border border-on-surface/5 flex items-center justify-between gap-2 sm:gap-4 group hover:bg-on-surface/5 active:scale-[0.99] transition-all cursor-pointer shadow-sm min-w-0"
                      onClick={() => navigate(`/edit/${t.id}`)}
                    >
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        <div className={cn(
                          "w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110 shrink-0",
                          category?.color || t.categoryColor || 'bg-slate-400'
                        )}>
                          <IconComponent name={category?.icon || t.categoryIcon || 'MoreHorizontal'} size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <h4 className="font-bold text-on-surface tracking-tight leading-snug truncate text-sm sm:text-base">
                              {t.description || category?.name || t.categoryName || 'Gasto'}
                            </h4>
                            {t.classification && (
                              <div className={cn(
                                "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter shrink-0",
                                t.classification === 'fixed' ? "bg-primary/10 text-primary" : "bg-orange-500/10 text-orange-600"
                              )}>
                                {t.classification === 'fixed' ? <Clock size={8} /> : <Zap size={8} />}
                                {t.classification === 'fixed' ? 'Fijo' : 'Var'}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mt-1 min-w-0">
                            <span className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-wider leading-none truncate max-w-[100px] sm:max-w-none">
                              {category ? category.name : (t.categoryName || (t.categoryId ? 'Cargando...' : 'Otros'))}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-on-surface-variant/20 shrink-0" />
                            <span className="text-[10px] font-black text-primary uppercase tracking-wider leading-none shrink-0">{userNames[t.authorId] || 'Usuario'}</span>
                            {t.projectId && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-on-surface-variant/20 shrink-0" />
                                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1 leading-none shrink-0">
                                  {projects.find(p => p.id === t.projectId)?.name || 'Compartido'}
                                </span>
                              </>
                            )}
                            <span className="w-1 h-1 rounded-full bg-on-surface-variant/20 shrink-0" />
                            <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider flex items-center gap-1 leading-none shrink-0">
                              {t.paymentMethod === 'Tarjeta' ? <CreditCard size={10} /> : <Wallet size={10} />}
                              {t.paymentMethod || 'Efectivo'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
                        <div className="text-right shrink-0">
                          <div className={cn(
                            "text-sm sm:text-lg font-black font-headline tracking-tight whitespace-nowrap",
                            t.type === 'expense' ? "text-on-surface" : "text-emerald-600"
                          )}>
                            {t.type === 'expense' ? '-' : '+'}{formatCurrency(
                              t.amount, 
                              projects.find(p => p.id === t.projectId)?.currency || profile?.currency || 'ARS'
                            )}
                          </div>
                          <div className="text-[9px] sm:text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">
                            {formatTime(t.date)}
                          </div>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('¿Estás seguro de que deseas eliminar esta transacción?')) {
                              deleteTransaction(t.id);
                            }
                          }}
                          className="p-1.5 sm:p-2 text-on-surface-variant/30 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-all opacity-80 sm:opacity-0 sm:group-hover:opacity-100 shrink-0"
                          title="Eliminar"
                        >
                          <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-surface-container-low rounded-[3rem] border border-dashed border-on-surface/10">
            <div className="w-20 h-20 bg-on-surface/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search size={32} className="text-on-surface-variant/20" />
            </div>
            <h3 className="text-xl font-bold text-on-surface font-headline">No hay resultados</h3>
            <p className="text-on-surface-variant mt-2 max-w-[240px] mx-auto text-sm font-medium">No encontramos transacciones que coincidan con tus filtros.</p>
            <button 
              onClick={() => {
                setFilterType('all');
                setFilterCategory('all');
                setFilterProject('all');
                setFilterClassification('all');
                setSearchQuery('');
              }}
              className="mt-6 text-primary font-bold text-sm hover:underline"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
