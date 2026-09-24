import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Calendar, 
  ShoppingBag, 
  ChevronDown, 
  Utensils, 
  Car, 
  Play, 
  Heart, 
  Book, 
  MoreHorizontal, 
  Landmark, 
  Tag, 
  Gift,
  Check,
  ChevronRight,
  Loader2,
  Briefcase,
  Home,
  Plane,
  Coffee,
  Zap,
  Smartphone,
  ShieldCheck,
  Trash2,
  CreditCard,
  Wallet,
  Clock
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/src/lib/utils';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { addTransaction, updateTransaction, deleteTransaction, getTransaction } from '../services/firestoreService';
import { getLocalToday, formatDisplayDate, formatLocalYYYYMMDD } from '../lib/dateUtils';

const ICON_MAP: Record<string, any> = {
  ShoppingBag, Utensils, Car, Play, Heart, Book, MoreHorizontal, 
  Landmark, Tag, Gift, Briefcase, Home, Plane, Coffee, Zap, Smartphone, ShieldCheck
};

const IconComponent = ({ name, size = 20 }: { name: string, size?: number }) => {
  const Icon = ICON_MAP[name] || MoreHorizontal;
  return <Icon size={size} />;
};

export const AddExpense: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const { categories: allCategories, projects, loading: dataLoading } = useData();
  
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [destination, setDestination] = useState<'personal' | 'shared'>('shared');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showProjectSheet, setShowProjectSheet] = useState(false);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getLocalToday());
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Tarjeta'>('Efectivo');
  const [classification, setClassification] = useState<'fixed' | 'variable'>('variable');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!id);
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [originalDate, setOriginalDate] = useState<Date | null>(null);

  const isAuthor = !id || authorId === user?.uid;

  const categories = allCategories.filter(c => c.type === type);

  const [hasInitializedDefault, setHasInitializedDefault] = useState(false);

  const visibleProjects = useMemo(() => {
    return projects.filter(p => {
      if (id && p.id === selectedProjectId) return true;
      if (p.status === 'inactive') return false;
      return (p as any).showInExpenseSelector !== false;
    });
  }, [projects, id, selectedProjectId]);

  const isPersonalActive = (profile?.personalStatus || 'active') !== 'inactive';
  const isPersonalVisible = (isPersonalActive && (profile?.personalShowInExpenseSelector ?? true)) || (id && destination === 'personal');

  // Pre-select project based on user profile setting and visibility (runs once for new transactions)
  useEffect(() => {
    if (!id && !hasInitializedDefault && (projects.length > 0 || profile)) {
      const defaultId = profile?.defaultProjectId || 'personal';
      const personalVis = isPersonalActive && (profile?.personalShowInExpenseSelector ?? true);
      
      if (defaultId === 'personal') {
        if (personalVis) {
          setDestination('personal');
          setSelectedProjectId(null);
        } else if (visibleProjects.length > 0) {
          setDestination('shared');
          setSelectedProjectId(visibleProjects[0].id);
        }
      } else {
        const found = visibleProjects.find(p => p.id === defaultId);
        if (found) {
          setDestination('shared');
          setSelectedProjectId(found.id);
        } else if (visibleProjects.length > 0) {
          setDestination('shared');
          setSelectedProjectId(visibleProjects[0].id);
        } else if (personalVis) {
          setDestination('personal');
          setSelectedProjectId(null);
        }
      }
      setHasInitializedDefault(true);
    }
  }, [id, hasInitializedDefault, profile, projects, isPersonalActive, visibleProjects]);

  useEffect(() => {
    if (id) {
      const fetchTransaction = async () => {
        try {
          const t: any = await getTransaction(id);
          if (t) {
            setAmount(t.amount.toString());
            setType(t.type);
            setDescription(t.description || '');
            // Use original time from Firestore but normalize date string for the input
            const localDateStr = formatLocalYYYYMMDD(t.date);
            setDate(localDateStr);
            setOriginalDate(t.date);
            setAuthorId(t.authorId);
            setPaymentMethod(t.paymentMethod || 'Efectivo');
            setClassification(t.classification || 'variable');
            const cat = allCategories.find(c => c.id === t.categoryId);
            if (cat) setSelectedCategory(cat);
          }
        } catch (error) {
          console.error('Error fetching transaction:', error);
        } finally {
          setInitialLoading(false);
        }
      };
      if (allCategories.length > 0) {
        fetchTransaction();
      }
    } else {
      if (categories.length > 0 && !selectedCategory) {
        setSelectedCategory(categories[0]);
      }
    }
  }, [id, allCategories]);

  const handleTypeChange = (newType: 'expense' | 'income') => {
    setType(newType);
    const firstCat = allCategories.find(c => c.type === newType);
    setSelectedCategory(firstCat || null);
  };

  const formatDateDisplay = (dateStr: string) => {
    return formatDisplayDate(dateStr);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(',', '.');
    val = val.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) {
      val = parts[0] + '.' + parts.slice(1).join('');
    }
    setAmount(val);
  };

  const parsedAmount = parseFloat(amount.replace(',', '.'));
  const isValidAmount = Boolean(amount && !isNaN(parsedAmount) && parsedAmount > 0);

  const handleSave = async () => {
    if (!isValidAmount || !selectedCategory) return;
    if (destination === 'shared' && !selectedProjectId) {
      alert('Por favor selecciona un proyecto compartido');
      return;
    }
    
    setIsSaving(true);
    try {
      const transactionData = {
        amount: parsedAmount,
        type,
        description,
        date,
        paymentMethod,
        classification,
        categoryId: selectedCategory.id,
        categoryName: selectedCategory.name,
        categoryIcon: selectedCategory.icon,
        categoryColor: selectedCategory.color,
        projectId: destination === 'shared' ? selectedProjectId : null,
        originalDate: originalDate // Pass original date to preserve time during update
      };

      if (id) {
        await updateTransaction(id, transactionData);
      } else {
        await addTransaction(transactionData);
      }
      navigate(-1);
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Error al guardar la transacción');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm('¿Estás seguro de que deseas eliminar esta transacción?')) return;
    
    setIsDeleting(true);
    try {
      await deleteTransaction(id);
      navigate(-1);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Error al eliminar la transacción');
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  if (dataLoading || initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col pb-10">
      {/* Header */}
      <header className="fixed top-0 w-full z-40 flex items-center justify-between px-6 h-16 glass-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-on-surface-variant p-2 hover:bg-on-surface/5 rounded-full transition-colors">
            <X size={24} />
          </button>
          <span className="text-xl font-extrabold tracking-tight text-on-surface font-headline">
            {id ? 'Editar Transacción' : 'Nueva Transacción'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {id && isAuthor && (
            <button 
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-2 text-rose-600 hover:bg-rose-500/5 rounded-full transition-colors"
            >
              {isDeleting ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
            </button>
          )}
          {isAuthor && (
            <button 
              onClick={handleSave} 
              disabled={!isValidAmount || isSaving}
              className={cn(
                "font-bold px-4 py-2 rounded-xl transition-all active:scale-95 flex items-center gap-2",
                (!isValidAmount || isSaving) 
                  ? "text-on-surface-variant/30 bg-on-surface/5" 
                  : "text-primary bg-primary/10 hover:bg-primary/20"
              )}
            >
              {isSaving && <Loader2 size={16} className="animate-spin" />}
              {id ? 'Actualizar' : 'Guardar'}
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 pt-24 max-w-2xl mx-auto w-full px-6 flex flex-col gap-8">
        {!isAuthor && (
          <div className="bg-amber-500/10 border border-amber-500/10 p-4 rounded-2xl flex items-center gap-3 text-amber-700">
            <ShieldCheck size={20} />
            <p className="text-sm font-bold leading-tight">Solo el autor puede modificar esta transacción.</p>
          </div>
        )}

        {/* Type Toggle */}
        <div className={cn("flex bg-surface-container-low p-1.5 rounded-2xl border border-on-surface/5", !isAuthor && "pointer-events-none opacity-60")}>
          <button 
            onClick={() => handleTypeChange('expense')}
            className={cn(
              "flex-1 py-3.5 px-4 rounded-[14px] text-sm font-black transition-all flex items-center justify-center gap-2 uppercase tracking-wider",
              type === 'expense' ? "bg-surface-container-lowest text-rose-600 shadow-sm" : "text-on-surface-variant/50"
            )}
          >
            <div className={cn("w-2 h-2 rounded-full", type === 'expense' ? "bg-rose-600" : "bg-on-surface-variant/20")} />
            Gasto
          </button>
          <button 
            onClick={() => handleTypeChange('income')}
            className={cn(
              "flex-1 py-3.5 px-4 rounded-[14px] text-sm font-black transition-all flex items-center justify-center gap-2 uppercase tracking-wider",
              type === 'income' ? "bg-surface-container-lowest text-emerald-600 shadow-sm" : "text-on-surface-variant/50"
            )}
          >
            <div className={cn("w-2 h-2 rounded-full", type === 'income' ? "bg-emerald-600" : "bg-on-surface-variant/20")} />
            Ingreso
          </button>
        </div>

        {/* Amount Input Section */}
        <section className="text-center py-4">
          <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] mb-4">
            Importe de la {type === 'expense' ? 'Salida' : 'Entrada'}
          </p>
          <div className={cn("flex items-center justify-center gap-2", !isAuthor && "pointer-events-none")}>
            <span className={cn(
              "text-3xl sm:text-4xl font-black font-headline opacity-40",
              type === 'expense' ? "text-rose-600" : "text-emerald-600"
            )}>{destination === 'shared' ? projects.find(p => p.id === selectedProjectId)?.currency || 'ARS' : (profile?.currency || 'ARS')}</span>
            <input 
              type="text"
              inputMode="decimal"
              readOnly={!isAuthor}
              value={amount}
              onChange={handleAmountChange}
              placeholder="0.00"
              className={cn(
                "w-full max-w-[280px] bg-transparent border-none p-0 focus:ring-0 text-6xl sm:text-8xl font-black tracking-tighter font-headline text-center placeholder:text-on-surface-variant/10 transition-all",
                type === 'expense' ? "text-on-surface" : "text-emerald-900"
              )}
              autoFocus={isAuthor}
            />
          </div>
        </section>

        {/* Form Sections */}
        <div className="space-y-4">
          {/* Description */}
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-on-surface/5 shadow-sm">
            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/40 mb-3">Descripción</label>
            <input 
              readOnly={!isAuthor}
              className="w-full bg-transparent border-none p-0 focus:ring-0 text-xl font-bold placeholder:text-on-surface-variant/20 text-on-surface"
              placeholder={type === 'expense' ? "¿En qué gastaste?" : "¿De dónde viene el dinero?"}
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date Selector */}
            <div 
              onClick={(e) => {
                const input = e.currentTarget.querySelector('input');
                if (input && 'showPicker' in input) {
                  (input as any).showPicker();
                } else if (input) {
                  input.click();
                }
              }}
              className="relative bg-surface-container-lowest p-6 rounded-3xl border border-on-surface/5 shadow-sm flex items-center justify-between group cursor-pointer hover:bg-on-surface/5 transition-colors overflow-hidden"
            >
              <input 
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/40 mb-2">Fecha</label>
                <div className="flex items-center gap-3 text-on-surface font-extrabold">
                  <Calendar size={20} className="text-primary" />
                  <span>{formatDateDisplay(date)}</span>
                </div>
              </div>
              <ChevronRight size={20} className="text-on-surface-variant/20" />
            </div>

            <button 
              type="button"
              disabled={!isAuthor}
              onClick={() => setShowCategorySheet(true)}
              className={cn(
                "bg-surface-container-lowest p-6 rounded-3xl border border-on-surface/5 shadow-sm flex items-center justify-between group transition-colors text-left",
                isAuthor ? "hover:bg-on-surface/5 cursor-pointer" : "opacity-60 cursor-default"
              )}
            >
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/40 mb-2">Categoría</label>
                <div className="flex items-center gap-3 text-on-surface font-extrabold">
                  {selectedCategory ? (
                    <>
                      <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm",
                        selectedCategory.color
                      )}>
                        <IconComponent name={selectedCategory.icon} size={18} />
                      </div>
                      <span>{selectedCategory.name}</span>
                    </>
                  ) : (
                    <span className="text-on-surface-variant/30">Seleccionar...</span>
                  )}
                </div>
              </div>
              {isAuthor && <ChevronDown size={20} className="text-on-surface-variant/20" />}
            </button>
          </div>

          {/* Destination Selector */}
          <div className={cn("bg-surface-container-low p-6 rounded-[2rem] border border-on-surface/5", !isAuthor && "pointer-events-none opacity-60")}>
            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/40 mb-4">
              {type === 'expense' ? 'Destino de los fondos' : 'Origen de los fondos'}
            </label>
            <div className="flex bg-on-surface/5 p-1.5 rounded-2xl">
              {isPersonalVisible && (
                <button 
                  onClick={() => setDestination('personal')}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-[14px] text-xs font-black transition-all uppercase tracking-wider",
                    destination === 'personal' ? "bg-surface-container-lowest text-on-surface shadow-sm" : "text-on-surface-variant/40"
                  )}
                >
                  Personal
                </button>
              )}
              {visibleProjects.length > 0 && (
                <button 
                  onClick={() => {
                    setDestination('shared');
                    if (!selectedProjectId && visibleProjects.length > 0) {
                      setSelectedProjectId(visibleProjects[0].id);
                    }
                  }}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-[14px] text-xs font-black transition-all uppercase tracking-wider",
                    destination === 'shared' ? "bg-surface-container-lowest text-on-surface shadow-sm" : "text-on-surface-variant/40"
                  )}
                >
                  Compartido
                </button>
              )}
            </div>

            <AnimatePresence>
              {destination === 'shared' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div 
                    onClick={() => setShowProjectSheet(true)}
                    className="mt-4 flex items-center justify-between p-5 bg-surface-container-lowest rounded-2xl border border-on-surface/5 shadow-sm cursor-pointer hover:bg-on-surface/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {selectedProject ? (
                        <>
                          <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                            <IconComponent name={selectedProject.icon} size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-extrabold text-on-surface">{selectedProject.name}</p>
                            <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-wider">
                              {selectedProject.memberIds.length} colaboradores
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-3 text-on-surface-variant/40">
                          <Briefcase size={20} />
                          <span className="text-sm font-bold">Seleccionar Proyecto...</span>
                        </div>
                      )}
                    </div>
                    <ChevronDown size={18} className="text-on-surface-variant/20" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Payment Method Selector */}
          <div className={cn("bg-surface-container-low p-6 rounded-[2rem] border border-on-surface/5 shadow-sm space-y-4", !isAuthor && "pointer-events-none opacity-60")}>
            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/40">
              Método de Pago
            </label>
            <div className="flex gap-3">
              {(['Efectivo', 'Tarjeta'] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={cn(
                    "flex-1 py-4 px-2 rounded-2xl font-black text-xs transition-all uppercase tracking-widest flex items-center justify-center gap-2 border-2",
                    paymentMethod === method 
                      ? "bg-primary/10 border-primary text-primary shadow-inner" 
                      : "bg-surface-container-lowest border-transparent text-on-surface-variant/40 hover:bg-on-surface/5"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-lg flex items-center justify-center",
                    paymentMethod === method ? "bg-primary text-white" : "bg-on-surface-variant/10 text-on-surface-variant/40"
                  )}>
                    {method === 'Efectivo' ? <Wallet size={14} /> : <CreditCard size={14} />}
                  </div>
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Classification Selector (Fixed/Variable) */}
          <div className={cn("bg-surface-container-low p-6 rounded-[2rem] border border-on-surface/5 shadow-sm space-y-4", !isAuthor && "pointer-events-none opacity-60")}>
            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/40">
              Clasificación de Gasto
            </label>
            <div className="flex gap-3">
              {(['variable', 'fixed'] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setClassification(item)}
                  className={cn(
                    "flex-1 py-4 px-2 rounded-2xl font-black text-xs transition-all uppercase tracking-widest flex items-center justify-center gap-2 border-2",
                    classification === item 
                      ? "bg-primary/10 border-primary text-primary shadow-inner" 
                      : "bg-surface-container-lowest border-transparent text-on-surface-variant/40 hover:bg-on-surface/5"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-lg flex items-center justify-center",
                    classification === item ? "bg-primary text-white" : "bg-on-surface-variant/10 text-on-surface-variant/40"
                  )}>
                    {item === 'fixed' ? <Clock size={14} /> : <Zap size={14} />}
                  </div>
                  {item === 'fixed' ? 'Fijo' : 'Variable'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Confirm Button */}
        {isAuthor && (
          <button 
            onClick={handleSave}
            disabled={!amount || parseFloat(amount) <= 0 || isSaving}
            className={cn(
              "w-full py-6 rounded-[2rem] font-black text-xl shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3",
              (!amount || parseFloat(amount) <= 0 || isSaving)
                ? "bg-on-surface/5 text-on-surface-variant/20 cursor-not-allowed"
                : type === 'expense' 
                  ? "bg-on-surface text-surface-container-lowest shadow-on-surface/20" 
                  : "bg-emerald-600 text-white shadow-emerald-500/20"
            )}
          >
            {isSaving ? 'Guardando...' : id ? 'Actualizar Transacción' : `Confirmar ${type === 'expense' ? 'Gasto' : 'Ingreso'}`}
            {!isSaving && <Check size={24} strokeWidth={3} />}
            {isSaving && <Loader2 size={24} className="animate-spin" />}
          </button>
        )}

        {/* Delete Button (Only when editing and is Author) */}
        {id && isAuthor && (
          <button 
            onClick={handleDelete}
            disabled={isDeleting || isSaving}
            className="w-full py-5 rounded-[2rem] font-bold text-rose-600 bg-rose-500/5 hover:bg-rose-500/10 transition-all active:scale-95 flex items-center justify-center gap-2 mt-4"
          >
            {isDeleting ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
            Eliminar Transacción
          </button>
        )}
      </main>

      {/* Category Selection Sheet */}
      <AnimatePresence>
        {showCategorySheet && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCategorySheet(false)}
              className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 w-full bg-surface-container-lowest rounded-t-[3rem] z-[70] p-8 shadow-[0_-8px_40px_rgba(0,0,0,0.1)] max-h-[80vh] overflow-y-auto"
            >
              <div className="w-12 h-1.5 bg-on-surface/10 rounded-full mx-auto mb-8" />
              <h3 className="text-2xl font-black text-on-surface font-headline tracking-tight mb-8 text-center">Seleccionar Categoría</h3>
              
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-6">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setShowCategorySheet(false);
                    }}
                    className="flex flex-col items-center gap-3 group"
                  >
                    <div className={cn(
                      "w-16 h-16 rounded-[22px] flex items-center justify-center text-white transition-all duration-300 group-active:scale-90 shadow-lg",
                      cat.color,
                      selectedCategory?.id === cat.id ? "ring-4 ring-on-surface/10" : "opacity-80 group-hover:opacity-100"
                    )}>
                      <IconComponent name={cat.icon} size={28} />
                    </div>
                    <span className={cn(
                      "text-xs font-bold tracking-tight transition-colors",
                      selectedCategory?.id === cat.id ? "text-on-surface" : "text-on-surface-variant/60"
                    )}>
                      {cat.name}
                    </span>
                  </button>
                ))}
              </div>

              {categories.length === 0 && (
                <div className="text-center py-10 px-6">
                  <p className="text-on-surface-variant font-bold mb-2">No hay categorías disponibles.</p>
                  <p className="text-xs text-on-surface-variant/40">Si acabas de empezar, estamos preparando el sistema para ti...</p>
                </div>
              )}

              <button 
                onClick={() => setShowCategorySheet(false)}
                className="w-full mt-10 py-5 bg-on-surface/5 rounded-2xl text-on-surface font-black text-sm uppercase tracking-widest hover:bg-on-surface/10 transition-colors"
              >
                Cancelar
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Project Selection Sheet */}
      <AnimatePresence>
        {showProjectSheet && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProjectSheet(false)}
              className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 w-full bg-surface-container-lowest rounded-t-[3rem] z-[70] p-8 shadow-[0_-8px_40px_rgba(0,0,0,0.1)] max-h-[80vh] overflow-y-auto"
            >
              <div className="w-12 h-1.5 bg-on-surface/10 rounded-full mx-auto mb-8" />
              <h3 className="text-2xl font-black text-on-surface font-headline tracking-tight mb-8 text-center">Seleccionar Proyecto</h3>
              
              <div className="space-y-3">
                {visibleProjects.map((proj) => (
                  <button
                    key={proj.id}
                    onClick={() => {
                      setSelectedProjectId(proj.id);
                      setShowProjectSheet(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all",
                      selectedProjectId === proj.id ? "bg-primary/5 border-primary/20" : "bg-surface-container-low border-on-surface/5 hover:bg-on-surface/5"
                    )}
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <IconComponent name={proj.icon} size={24} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-on-surface">{proj.name}</p>
                      <p className="text-xs text-on-surface-variant">{proj.memberIds.length} colaboradores</p>
                    </div>
                    {selectedProjectId === proj.id && <Check size={20} className="ml-auto text-primary" />}
                  </button>
                ))}
                
                {visibleProjects.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-on-surface-variant font-medium">No tienes proyectos compartidos visibles para selección.</p>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setShowProjectSheet(false)}
                className="w-full mt-10 py-5 bg-on-surface/5 rounded-2xl text-on-surface font-black text-sm uppercase tracking-widest hover:bg-on-surface/10 transition-colors"
              >
                Cancelar
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Decorative Background */}
      <div className="fixed -z-10 top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className={cn(
          "absolute -top-[10%] -right-[5%] w-[40%] h-[40%] blur-[120px] rounded-full transition-colors duration-700",
          type === 'expense' ? "bg-rose-500/5" : "bg-emerald-500/5"
        )}></div>
        <div className="absolute top-[60%] -left-[10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full"></div>
      </div>
    </div>
  );
};
