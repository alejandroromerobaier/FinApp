import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Clock,
  Layers,
  AlertTriangle,
  CheckCircle2,
  User,
  ArrowLeftRight
} from 'lucide-react';
import { formatCurrency, cn } from '@/src/lib/utils';
import { getGlobalTransactions, deleteTransaction, deleteInstallmentPlan, deleteSingleVirtualInstallment } from '../services/firestoreService';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatDisplayDate, parseLocalYYYYMMDD } from '../lib/dateUtils';

const ICON_MAP: Record<string, any> = {
  ShoppingBag, Utensils, Car, Play, Heart, Book, MoreHorizontal, 
  Landmark, Tag, Gift, Briefcase, Home, Plane, Coffee, Zap, Smartphone, ShieldCheck, ArrowLeftRight
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

const PAGE_SIZE = 35;

export type TimeScope = 'real_only' | 'all' | 'future_only';

export const History: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { categories, projects, transactions, userNames, loading: dataLoading } = useData();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterAuthor, setFilterAuthor] = useState<string>('all');
  const [filterClassification, setFilterClassification] = useState<'all' | 'fixed' | 'variable'>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'all'>('monthly');
  const [timeScope, setTimeScope] = useState<TimeScope>('real_only');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showFilters, setShowFilters] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<{
    planId: string;
    txId: string;
    installmentNumber?: number;
    totalInstallments?: number;
    description: string;
    isVirtual?: boolean;
  } | null>(null);
  const [isDeletingPlan, setIsDeletingPlan] = useState(false);

  const handleDeleteSingle = async () => {
    if (!planToDelete) return;
    setIsDeletingPlan(true);
    try {
      if (planToDelete.isVirtual && planToDelete.installmentNumber) {
        await deleteSingleVirtualInstallment(planToDelete.planId, planToDelete.installmentNumber);
      } else {
        await deleteTransaction(planToDelete.txId);
      }
      setPlanToDelete(null);
    } catch (err) {
      console.error('Error deleting single installment:', err);
    } finally {
      setIsDeletingPlan(false);
    }
  };

  const handleDeleteFullPlan = async (planId: string) => {
    setIsDeletingPlan(true);
    try {
      await deleteInstallmentPlan(planId);
      setPlanToDelete(null);
    } catch (err) {
      console.error('Error deleting installment plan:', err);
    } finally {
      setIsDeletingPlan(false);
    }
  };

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

  // Dynamically get unique authors for filtering
  const projectAuthors = useMemo(() => {
    const authorIds = new Set<string>();
    transactions.forEach(t => {
      if (t.authorId) authorIds.add(t.authorId);
    });
    return Array.from(authorIds).map(id => ({
      id,
      name: id === user?.uid ? 'Tú (Mis registros)' : (userNames[id] || 'Colaborador')
    }));
  }, [transactions, user?.uid, userNames]);

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
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const filtered = transactions.filter(t => {
      const matchesSearch = t.description?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           t.categoryName?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || t.type === filterType;
      const matchesCategory = filterCategory === 'all' || t.categoryId === filterCategory;
      const matchesProject = filterProject === 'all' 
        ? true 
        : filterProject === 'personal' 
          ? !t.projectId 
          : t.projectId === filterProject;
      const matchesAuthor = filterAuthor === 'all' || t.authorId === filterAuthor;
      const matchesClassification = filterClassification === 'all' || t.classification === filterClassification;
      
      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
      const isFuture = tDate > endOfToday;

      let matchesTimeScope = true;
      if (timeScope === 'real_only') {
        matchesTimeScope = !isFuture;
      } else if (timeScope === 'future_only') {
        matchesTimeScope = isFuture;
      }

      let matchesPeriod = true;
      if (selectedPeriod !== 'all') {
        const months = selectedPeriod === 'monthly' ? 1 : selectedPeriod === 'quarterly' ? 3 : selectedPeriod === 'semiannual' ? 6 : 12;
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        // Full end of month (e.g. Sept 30th 23:59:59.999 instead of Sept 8th)
        const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
        const start = new Date(year, month - (months - 1), 1, 0, 0, 0, 0);
        
        matchesPeriod = tDate >= start && tDate <= end;
      }

      return matchesSearch && matchesType && matchesCategory && matchesProject && matchesAuthor && matchesClassification && matchesPeriod && matchesTimeScope;
    });

    if (timeScope === 'future_only') {
      // Sort upcoming installments closest first
      return [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    return [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, searchQuery, filterType, filterCategory, filterProject, filterAuthor, filterClassification, selectedPeriod, currentDate, timeScope]);

  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset pagination limit when any filter or search changes
  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
  }, [searchQuery, filterType, filterCategory, filterProject, filterAuthor, filterClassification, selectedPeriod, currentDate, timeScope]);

  const hasMore = visibleLimit < filteredTransactions.length;

  const loadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      setIsLoadingMore(true);
      setTimeout(() => {
        setVisibleLimit(prev => Math.min(prev + PAGE_SIZE, filteredTransactions.length));
        setIsLoadingMore(false);
      }, 150);
    }
  }, [hasMore, isLoadingMore, filteredTransactions.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadMore();
      }
    }, {
      rootMargin: '250px',
      threshold: 0.1
    });

    observer.observe(sentinel);
    return () => {
      if (sentinel) observer.unobserve(sentinel);
    };
  }, [hasMore, loadMore]);

  const paginatedTransactions = useMemo(() => {
    return filteredTransactions.slice(0, visibleLimit);
  }, [filteredTransactions, visibleLimit]);

  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    paginatedTransactions.forEach(t => {
      const effectiveDate = (timeScope === 'real_only' && t.isInstallment && t.installmentNumber === 1 && t.purchaseDate)
        ? parseLocalYYYYMMDD(t.purchaseDate)
        : (t.date instanceof Date ? t.date : new Date(t.date));
      const dateKey = isNaN(effectiveDate.getTime()) ? 'Fecha Desconocida' : dateGroupFormatter.format(effectiveDate);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(t);
    });
    return groups;
  }, [paginatedTransactions, timeScope]);

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
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-on-surface font-headline leading-tight">Historial</h1>
            <p className="text-[11px] font-bold text-on-surface-variant/70">
              {filteredTransactions.length === 0 ? '0 movimientos' : (
                hasMore 
                  ? `Mostrando ${paginatedTransactions.length} de ${filteredTransactions.length} movimientos`
                  : `${filteredTransactions.length} movimiento${filteredTransactions.length > 1 ? 's' : ''}`
              )}
            </p>
          </div>
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
                  ? "bg-primary text-white shadow-lg shadow-primary/20" 
                  : "text-on-surface-variant/70 hover:bg-on-surface/5"
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

      {/* Time Scope Switcher: Hasta Hoy (Día a Día) vs Todo el Período vs Solo Cuotas Futuras */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none mb-6">
        <button
          type="button"
          onClick={() => setTimeScope('real_only')}
          className={cn(
            "px-3.5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 border",
            timeScope === 'real_only'
              ? "bg-on-surface text-surface-container-lowest border-on-surface shadow-md"
              : "bg-surface-container-low text-on-surface-variant/70 border-transparent hover:bg-surface-container"
          )}
        >
          <CheckCircle2 size={14} className={timeScope === 'real_only' ? "text-emerald-400" : "text-on-surface-variant/40"} />
          <span>Hasta Hoy (Día a Día)</span>
        </button>

        <button
          type="button"
          onClick={() => setTimeScope('all')}
          className={cn(
            "px-3.5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 border",
            timeScope === 'all'
              ? "bg-on-surface text-surface-container-lowest border-on-surface shadow-md"
              : "bg-surface-container-low text-on-surface-variant/70 border-transparent hover:bg-surface-container"
          )}
        >
          <span>Todo el Período</span>
        </button>

        <button
          type="button"
          onClick={() => setTimeScope('future_only')}
          className={cn(
            "px-3.5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 border",
            timeScope === 'future_only'
              ? "bg-primary text-white border-primary shadow-md"
              : "bg-surface-container-low text-on-surface-variant/70 border-transparent hover:bg-surface-container"
          )}
        >
          <Clock size={14} />
          <span>Solo Cuotas Futuras</span>
        </button>
      </div>

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

              {/* Member / Author Filter */}
              {projectAuthors.length > 1 && (
                <div>
                  <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.2em] mb-3 ml-1">Colaborador / Miembro</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setFilterAuthor('all')}
                      className={cn(
                        "px-3.5 py-2 rounded-lg font-bold text-xs transition-all border",
                        filterAuthor === 'all' ? "bg-primary text-white border-primary" : "bg-surface-container-low text-on-surface-variant/60 border-transparent"
                      )}
                    >
                      Todos
                    </button>
                    {projectAuthors.map((author) => (
                      <button
                        key={author.id}
                        onClick={() => setFilterAuthor(author.id)}
                        className={cn(
                          "px-3.5 py-2 rounded-lg font-bold text-xs transition-all border flex items-center gap-1.5",
                          filterAuthor === author.id ? "bg-primary text-white border-primary" : "bg-surface-container-low text-on-surface-variant/60 border-transparent"
                        )}
                      >
                        <User size={12} />
                        <span>{author.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
          <>
            {Object.entries(groupedTransactions).map(([date, items]) => (
            <div key={date}>
              <h3 className="text-[11px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] mb-4 ml-1">{date}</h3>
              <div className="space-y-3">
                {(items as any[]).map((t) => {
                  const category = categories.find(c => c.id === t.categoryId);
                  const endOfToday = new Date();
                  endOfToday.setHours(23, 59, 59, 999);
                  const tDate = t.date instanceof Date ? t.date : new Date(t.date);
                  const isFuture = tDate > endOfToday;

                  return (
                    <div 
                      key={t.id}
                      className={cn(
                        "p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between gap-2 sm:gap-4 group active:scale-[0.99] transition-all cursor-pointer shadow-sm min-w-0",
                        isFuture 
                          ? "bg-surface-container-low/60 border-blue-500/20 hover:bg-surface-container-low" 
                          : "bg-surface-container-lowest border-on-surface/5 hover:bg-on-surface/5"
                      )}
                      onClick={() => navigate(`/edit/${t.id}`)}
                    >
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        <div className={cn(
                          "w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110 shrink-0",
                          t.isTransfer ? "bg-cyan-600" : (category?.color || t.categoryColor || 'bg-slate-400')
                        )}>
                          <IconComponent name={t.isTransfer ? 'ArrowLeftRight' : (category?.icon || t.categoryIcon || 'MoreHorizontal')} size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          {/* Row 1: Description gets full width, never squeezed */}
                          <div className="flex items-center gap-2 min-w-0">
                            <h4 className="font-bold text-on-surface tracking-tight leading-snug truncate text-sm sm:text-base">
                              {t.description || (t.isTransfer ? 'Transferencia' : (category?.name || t.categoryName || 'Gasto'))}
                            </h4>
                          </div>

                          {/* Row 2: Badges wrap cleanly without squeezing description */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-1 min-w-0">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider leading-none truncate max-w-[110px] sm:max-w-none">
                              {t.isTransfer ? 'Transferencia' : (category ? category.name : (t.categoryName || (t.categoryId ? 'Cargando...' : 'Otros')))}
                            </span>
                            {t.projectId && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-on-surface-variant/30 shrink-0" />
                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1 leading-none shrink-0">
                                  {projects.find(p => p.id === t.projectId)?.name || 'Compartido'}
                                </span>
                              </>
                            )}
                            <span className="w-1 h-1 rounded-full bg-on-surface-variant/30 shrink-0" />
                            <span className={cn(
                              "text-[9px] font-bold uppercase tracking-wider leading-none shrink-0 px-1.5 py-0.5 rounded-md",
                              t.authorId === user?.uid 
                                ? "bg-primary/10 text-primary dark:text-blue-400" 
                                : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                            )}>
                              {t.authorId === user?.uid ? 'Pagado por Ti' : `Por: ${userNames[t.authorId] || 'Miembro'}`}
                            </span>

                            {t.isTransfer && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-on-surface-variant/30 shrink-0" />
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 leading-none shrink-0">
                                  <ArrowLeftRight size={9} />
                                  <span>{t.transferDirection === 'out' ? 'Salida' : 'Entrada'}</span>
                                  {t.exchangeRate && t.isCurrencyExchange && (
                                    <span className="hidden sm:inline font-mono">• TC: ${formatCurrency(t.exchangeRate, 'ARS')}</span>
                                  )}
                                </span>
                              </>
                            )}

                            {t.installmentNumber && t.totalInstallments ? (
                              <>
                                <span className="w-1 h-1 rounded-full bg-on-surface-variant/30 shrink-0" />
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-tight bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/10 leading-none shrink-0">
                                  <CreditCard size={9} />
                                  <span>Cuota {t.installmentNumber}/{t.totalInstallments}</span>
                                  {t.cardName && <span className="font-semibold hidden sm:inline">• {t.cardName}</span>}
                                </span>
                              </>
                            ) : (t.cardName || t.paymentMethod) ? (
                              <>
                                <span className="w-1 h-1 rounded-full bg-on-surface-variant/30 shrink-0" />
                                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1 leading-none shrink-0">
                                  {(t.paymentMethod === 'Tarjeta' || t.paymentMethod === 'Tarjeta de Crédito') ? <CreditCard size={10} className="text-primary dark:text-blue-400" /> : <Wallet size={10} />}
                                  <span>{t.cardName ? t.cardName : (t.paymentMethod || 'Efectivo')}</span>
                                </span>
                              </>
                            ) : null}

                            {t.classification && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-on-surface-variant/30 shrink-0 hidden sm:inline-block" />
                                <div className={cn(
                                  "hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter shrink-0",
                                  t.classification === 'fixed' 
                                    ? "bg-primary/10 text-primary dark:text-blue-400" 
                                    : "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                                )}>
                                  {t.classification === 'fixed' ? <Clock size={8} /> : <Zap size={8} />}
                                  {t.classification === 'fixed' ? 'Fijo' : 'Var'}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
                        <div className="text-right shrink-0">
                          <div className={cn(
                            "text-sm sm:text-lg font-black font-headline tracking-tight whitespace-nowrap",
                            t.type === 'expense' ? "text-on-surface" : "text-emerald-600 dark:text-emerald-400"
                          )}>
                            {t.type === 'expense' ? '-' : '+'}{formatCurrency(
                              t.amount, 
                              projects.find(p => p.id === t.projectId)?.currency || profile?.currency || 'ARS'
                            )}
                          </div>
                          {isFuture ? (
                            <div className="flex items-center justify-end gap-1 text-[9px] font-black text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-md uppercase tracking-tight">
                              <Clock size={9} />
                              <span>Vencimiento</span>
                            </div>
                          ) : (
                            <div className="text-[9px] sm:text-[10px] font-semibold text-on-surface-variant/70 uppercase tracking-widest">
                              {formatTime(t.date)}
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const planId = t.parentPlanId || t.installmentPlanId;
                            if (planId && t.installmentNumber && t.totalInstallments) {
                              setPlanToDelete({
                                planId,
                                txId: t.id,
                                installmentNumber: t.installmentNumber,
                                totalInstallments: t.totalInstallments,
                                description: t.description || 'Gasto en cuotas',
                                isVirtual: Boolean(t.isVirtualInstallment || t.parentPlanId)
                              });
                            } else {
                              if (window.confirm('¿Estás seguro de que deseas eliminar esta transacción?')) {
                                deleteTransaction(t.id);
                              }
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
          ))}

          {/* Infinite Scroll Sentinel and Load More */}
          {hasMore && (
            <div ref={sentinelRef} className="pt-6 pb-8 flex flex-col items-center justify-center gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant/70">
                <Loader2 size={16} className="animate-spin text-primary" />
                <span>Cargando más movimientos...</span>
              </div>
              <button
                type="button"
                onClick={loadMore}
                className="px-4 py-2.5 bg-surface-container-low hover:bg-on-surface/5 text-primary text-xs font-bold rounded-xl transition-all border border-on-surface/5 shadow-sm active:scale-95 cursor-pointer"
              >
                Cargar más ({filteredTransactions.length - paginatedTransactions.length} restantes)
              </button>
            </div>
          )}

          {!hasMore && filteredTransactions.length > PAGE_SIZE && (
            <div className="py-8 text-center border-t border-on-surface/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40">
                Has llegado al final • {filteredTransactions.length} transacciones cargadas
              </p>
            </div>
          )}
        </>
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

      {/* Plan Deletion Choice Modal */}
      <AnimatePresence>
        {planToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-container-lowest rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-on-surface/10 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-lg font-black text-on-surface">Eliminar Cuota</h3>
                <p className="text-xs text-on-surface-variant">
                  Esta transacción forma parte de un plan de <strong className="text-on-surface">{planToDelete.totalInstallments} cuotas</strong> ({planToDelete.description}). ¿Cómo querés proceder?
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  disabled={isDeletingPlan}
                  onClick={handleDeleteSingle}
                  className="w-full py-3 px-4 rounded-xl border border-on-surface/10 hover:bg-surface-container font-bold text-xs text-on-surface transition-colors flex items-center justify-center gap-2"
                >
                  <span>Eliminar solo esta cuota ({planToDelete.installmentNumber}/{planToDelete.totalInstallments})</span>
                </button>

                <button
                  type="button"
                  disabled={isDeletingPlan}
                  onClick={() => handleDeleteFullPlan(planToDelete.planId)}
                  className="w-full py-3 px-4 rounded-xl bg-error text-white font-bold text-xs hover:bg-error/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeletingPlan ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  <span>Eliminar las {planToDelete.totalInstallments} cuotas del plan</span>
                </button>

                <button
                  type="button"
                  disabled={isDeletingPlan}
                  onClick={() => setPlanToDelete(null)}
                  className="w-full py-2.5 rounded-xl font-bold text-xs text-on-surface-variant/70 hover:text-on-surface transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
