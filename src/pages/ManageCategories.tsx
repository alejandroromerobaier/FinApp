import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Edit2, Trash2, AlertTriangle, PlusCircle,
  X, Check, Loader2, ArrowLeft, Search, Plus, Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/src/lib/utils';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../context/ToastContext';
import { deleteCategory, addCategory, updateCategory, reassignTransactions } from '../services/firestoreService';
import { getCategoryIcon, CATEGORY_ICON_GROUPS, CATEGORY_ICON_MAP } from '../lib/categoryIcons';

const COLORS = [
  'bg-rose-500', 'bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 
  'bg-purple-500', 'bg-indigo-500', 'bg-slate-600', 'bg-pink-500',
  'bg-cyan-500', 'bg-orange-500', 'bg-lime-500', 'bg-violet-500',
  'bg-teal-500', 'bg-fuchsia-500'
];

export const ManageCategories: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { categories, loading } = useData();
  const { toast } = useToast();

  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // New Category State
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('Tag');
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [newType, setNewType] = useState<'expense' | 'income'>('expense');
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reassignTo, setReassignTo] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus and select name input when opening modal
  useEffect(() => {
    if (showAddModal) {
      const timer = setTimeout(() => {
        if (nameInputRef.current) {
          nameInputRef.current.focus();
          nameInputRef.current.select();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showAddModal]);

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      if (reassignTo) {
        await reassignTransactions(id, reassignTo);
      }
      await deleteCategory(id);
      toast.success('Categoría eliminada con éxito');
      setShowDeleteModal(null);
      setReassignTo(null);
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Error al eliminar la categoría');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!newName.trim()) return;
    setIsAdding(true);
    try {
      const categoryData = {
        name: newName.trim(),
        icon: newIcon,
        color: newColor,
        type: newType
      };
      
      if (editingId) {
        await updateCategory(editingId, categoryData);
        toast.success('Categoría actualizada con éxito');
      } else {
        await addCategory(categoryData);
        toast.success('Categoría creada con éxito');
      }
      
      setShowAddModal(false);
      setEditingId(null);
      setNewName('');
      setNewIcon('Tag');
      setNewColor(COLORS[0]);
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error('Error al guardar la categoría');
    } finally {
      setIsAdding(false);
    }
  };

  const startEdit = (cat: any) => {
    setEditingId(cat.id);
    setNewName(cat.name);
    setNewIcon(cat.icon || 'Tag');
    setNewColor(cat.color || COLORS[0]);
    setNewType(cat.type);
    setShowAddModal(true);
  };

  const openNewCategory = () => {
    setEditingId(null);
    setNewName('');
    setNewIcon('Tag');
    setNewColor(COLORS[0]);
    setShowAddModal(true);
  };

  // Filter categories by type and search query
  const filteredCategories = useMemo(() => {
    const byType = categories.filter(c => c.type === newType);
    if (!searchQuery.trim()) return byType;
    const q = searchQuery.toLowerCase().trim();
    return byType.filter(c => c.name.toLowerCase().includes(q));
  }, [categories, newType, searchQuery]);

  const expenseCount = useMemo(() => categories.filter(c => c.type === 'expense').length, [categories]);
  const incomeCount = useMemo(() => categories.filter(c => c.type === 'income').length, [categories]);

  const selectedGroup = CATEGORY_ICON_GROUPS[selectedGroupIndex] || CATEGORY_ICON_GROUPS[0];
  const PreviewIcon = getCategoryIcon(newIcon);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface pb-32 sm:pb-20">
      {/* Header */}
      <header className="sticky top-0 w-full z-40 flex items-center justify-between px-4 sm:px-6 h-14 sm:h-16 glass-header">
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="text-on-surface-variant p-2 hover:bg-on-surface/5 rounded-full transition-colors active:scale-90"
            title="Volver"
          >
            <ArrowLeft size={22} className="sm:w-[24px] sm:h-[24px]" />
          </button>
          <span className="text-lg sm:text-xl font-extrabold tracking-tight text-on-surface font-headline">
            Categorías
          </span>
        </div>
        <button 
          onClick={openNewCategory}
          className="bg-primary text-white px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-transform flex items-center gap-2 font-bold text-xs uppercase tracking-wider cursor-pointer"
        >
          <Plus size={18} />
          <span>Nueva Categoría</span>
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        <section className="mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-on-surface font-headline mb-1 sm:mb-2">Tus Categorías</h2>
          <p className="text-on-surface-variant text-xs sm:text-sm font-medium">Organiza y personaliza las etiquetas de tus movimientos.</p>
        </section>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar categoría por nombre..."
            className="w-full bg-surface-container-low border border-on-surface/10 rounded-2xl pl-11 pr-10 py-3 text-sm font-bold text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-xs"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-on-surface p-1 rounded-full transition-colors"
              title="Limpiar búsqueda"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Tabs for Expense/Income */}
        <div className="flex gap-3 mb-6 sm:mb-8">
          <button 
            onClick={() => setNewType('expense')}
            className={cn(
              "px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
              newType === 'expense' 
                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-xs" 
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            )}
          >
            <span>Gastos</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-on-surface/5 font-mono">{expenseCount}</span>
          </button>
          <button 
            onClick={() => setNewType('income')}
            className={cn(
              "px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
              newType === 'income' 
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs" 
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            )}
          >
            <span>Ingresos</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-on-surface/5 font-mono">{incomeCount}</span>
          </button>
        </div>

        {/* Category Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          {filteredCategories.map((cat) => {
            const Icon = getCategoryIcon(cat.icon);
            return (
              <div 
                key={cat.id}
                className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-on-surface/10 flex items-center justify-between group hover:border-on-surface/20 transition-all shadow-xs"
              >
                <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1 mr-2">
                  <div className={cn("w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-white shadow-xs shrink-0", cat.color || 'bg-slate-600')}>
                    <Icon size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="font-bold text-on-surface tracking-tight font-headline text-base truncate">{cat.name}</h3>
                      {(cat.scope === 'system' || !cat.ownerId) && (
                        <span className="text-[9px] font-black text-on-surface-variant/50 uppercase tracking-widest px-2 py-0.5 bg-on-surface/5 border border-on-surface/10 rounded-md shrink-0">
                          Base
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mt-0.5">
                      {cat.type === 'expense' ? 'Gasto' : 'Ingreso'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={() => startEdit(cat)}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-surface-container-low hover:bg-surface-container text-primary transition-all flex items-center justify-center cursor-pointer border border-on-surface/5 shadow-2xs active:scale-95"
                    title="Editar categoría"
                    aria-label={`Editar categoría ${cat.name}`}
                  >
                    <Edit2 size={16} />
                  </button>
                  {cat.ownerId === user?.uid ? (
                    <button 
                      onClick={() => setShowDeleteModal(cat.id)}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-surface-container-low hover:bg-rose-500/10 text-rose-500 transition-all flex items-center justify-center cursor-pointer border border-on-surface/5 shadow-2xs active:scale-95"
                      title="Eliminar categoría"
                      aria-label={`Eliminar categoría ${cat.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : (
                    <div 
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-surface-container-low/50 text-on-surface-variant/30 flex items-center justify-center border border-on-surface/5 cursor-not-allowed select-none"
                      title="Categoría base del sistema (no eliminable)"
                      aria-label="Categoría base del sistema (no eliminable)"
                    >
                      <Lock size={15} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {filteredCategories.length === 0 && (
            <div className="col-span-full py-16 text-center bg-surface-container-low/50 rounded-[2.5rem] border-2 border-dashed border-on-surface/10 p-6 space-y-2">
              {searchQuery ? (
                <>
                  <p className="text-on-surface font-bold text-sm">No se encontraron categorías para "{searchQuery}"</p>
                  <p className="text-on-surface-variant/60 text-xs">Intenta con otro término o crea una nueva categoría.</p>
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="mt-3 px-4 py-2 rounded-xl bg-on-surface/5 hover:bg-on-surface/10 text-xs font-bold text-on-surface transition-colors cursor-pointer"
                  >
                    Limpiar búsqueda
                  </button>
                </>
              ) : (
                <>
                  <p className="text-on-surface-variant font-bold text-sm">No hay categorías para este tipo.</p>
                  <button 
                    onClick={openNewCategory}
                    className="mt-3 text-primary font-black text-xs uppercase tracking-widest hover:underline cursor-pointer"
                  >
                    Crear la primera categoría
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 w-full bg-surface-container-lowest rounded-t-[2.5rem] sm:rounded-t-[3rem] z-[70] p-6 sm:p-8 shadow-2xl max-h-[92vh] overflow-y-auto max-w-2xl mx-auto sm:left-1/2 sm:-translate-x-1/2 border-t border-on-surface/10"
            >
              <div className="w-12 h-1.5 bg-on-surface/10 rounded-full mx-auto mb-6" />
              
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-on-surface font-headline tracking-tight">
                    {editingId ? 'Editar Categoría' : 'Nueva Categoría'}
                  </h3>
                  <p className="text-xs text-on-surface-variant/60 font-bold uppercase tracking-wider mt-0.5">
                    Personaliza el nombre, color e ícono
                  </p>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-2 rounded-full hover:bg-on-surface/5 text-on-surface-variant/60"
                >
                  <X size={20} />
                </button>
              </div>

              {/* LIVE PREVIEW CARD */}
              <div className="bg-surface-container-low p-4 rounded-2xl border border-on-surface/10 mb-6 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-3">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm transition-all duration-300 shrink-0", newColor)}>
                    <PreviewIcon size={24} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/50 block">Vista Previa</span>
                    <h4 className="text-base font-extrabold text-on-surface font-headline truncate">
                      {newName.trim() || 'Nombre de categoría'}
                    </h4>
                  </div>
                </div>
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0",
                  newType === 'expense' ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                )}>
                  {newType === 'expense' ? 'Gasto' : 'Ingreso'}
                </span>
              </div>
              
              <div className="space-y-6">
                {/* Name */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 mb-2 ml-1">
                    Nombre de la Categoría
                  </label>
                  <input 
                    ref={nameInputRef}
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ej. Supermercado, Alquiler, Gimnasio..."
                    className="w-full bg-surface-container-low border border-on-surface/10 rounded-2xl p-4 text-base font-bold text-on-surface placeholder:text-on-surface-variant/30 focus:ring-2 focus:ring-primary/20 outline-none"
                    autoFocus
                  />
                </div>

                {/* Type Selection */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 mb-2 ml-1">
                    Tipo de Flujo
                  </label>
                  <div className="flex bg-surface-container-low p-1.5 rounded-2xl border border-on-surface/5">
                    <button 
                      type="button"
                      onClick={() => setNewType('expense')}
                      className={cn(
                        "flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all uppercase tracking-wider cursor-pointer",
                        newType === 'expense' ? "bg-surface-container-lowest text-rose-600 dark:text-rose-400 shadow-sm" : "text-on-surface-variant/60"
                      )}
                    >
                      Gasto
                    </button>
                    <button 
                      type="button"
                      onClick={() => setNewType('income')}
                      className={cn(
                        "flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all uppercase tracking-wider cursor-pointer",
                        newType === 'income' ? "bg-surface-container-lowest text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-on-surface-variant/60"
                      )}
                    >
                      Ingreso
                    </button>
                  </div>
                </div>

                {/* Color Selection */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 mb-2 ml-1">
                    Color Distintivo
                  </label>
                  <div className="flex flex-wrap gap-2.5 p-3 bg-surface-container-low rounded-2xl border border-on-surface/5">
                    {COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewColor(color)}
                        className={cn(
                          "w-9 h-9 sm:w-10 sm:h-10 rounded-xl transition-all relative flex items-center justify-center cursor-pointer",
                          color,
                          newColor === color ? "ring-4 ring-primary/30 scale-110 shadow-sm" : "opacity-80 hover:opacity-100 hover:scale-105"
                        )}
                      >
                        {newColor === color && (
                          <Check size={16} className="text-white drop-shadow-md stroke-[3]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Categorized Icon Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 ml-1">
                      Seleccionar Ícono ({selectedGroup.name})
                    </label>
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-[200px] sm:max-w-none scrollbar-none">
                      {CATEGORY_ICON_GROUPS.map((group, idx) => (
                        <button
                          key={group.name}
                          type="button"
                          onClick={() => setSelectedGroupIndex(idx)}
                          className={cn(
                            "px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer",
                            selectedGroupIndex === idx 
                              ? "bg-primary text-white shadow-xs" 
                              : "bg-surface-container-low text-on-surface-variant/60 hover:bg-surface-container"
                          )}
                        >
                          {group.name.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-6 sm:grid-cols-7 gap-2.5 max-h-44 overflow-y-auto p-3 bg-surface-container-low rounded-2xl border border-on-surface/5">
                    {selectedGroup.icons.map(({ id, label }) => {
                      const Icon = getCategoryIcon(id);
                      const isSelected = newIcon === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setNewIcon(id)}
                          title={label}
                          className={cn(
                            "aspect-square rounded-xl flex items-center justify-center transition-all cursor-pointer relative",
                            isSelected 
                              ? "bg-primary text-white shadow-md scale-105" 
                              : "bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                          )}
                        >
                          <Icon size={20} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-3">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-4 bg-surface-container-low rounded-2xl text-on-surface font-black text-xs uppercase tracking-widest hover:bg-surface-container cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button"
                    onClick={handleSave}
                    disabled={!newName.trim() || isAdding}
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isAdding ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      editingId ? 'Guardar Cambios' : 'Crear Categoría'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal with Reassignment */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-container-lowest rounded-[2.5rem] p-6 sm:p-8 shadow-2xl max-w-sm w-full text-center border border-on-surface/10"
            >
              <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-on-surface font-headline mb-2">Eliminar Categoría</h3>
              <p className="text-on-surface-variant text-xs font-medium leading-relaxed mb-6">
                Puedes reasignar los movimientos de esta categoría a otra antes de borrarla.
              </p>
              
              <div className="text-left mb-6">
                <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 mb-2 ml-1">
                  Reasignar a (Opcional):
                </label>
                <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
                  <button 
                    onClick={() => setReassignTo(null)}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-xl border transition-all text-xs font-bold cursor-pointer",
                      reassignTo === null ? "bg-primary text-white border-primary shadow-xs" : "bg-surface-container-low border-transparent text-on-surface hover:bg-surface-container"
                    )}
                  >
                    <Trash2 size={15} />
                    <span>Eliminar sin reasignar</span>
                  </button>
                  
                  {categories.filter(c => c.id !== showDeleteModal && c.type === categories.find(curr => curr.id === showDeleteModal)?.type).map(cat => {
                    const Icon = getCategoryIcon(cat.icon);
                    return (
                      <button 
                        key={cat.id}
                        onClick={() => setReassignTo(cat.id)}
                        className={cn(
                          "flex items-center gap-3 p-2.5 rounded-xl border transition-all text-xs font-bold cursor-pointer",
                          reassignTo === cat.id ? "bg-primary text-white border-primary shadow-xs" : "bg-surface-container-low border-transparent text-on-surface hover:bg-surface-container"
                        )}
                      >
                        <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0 text-[10px]", cat.color || 'bg-slate-600')}>
                          <Icon size={12} />
                        </div>
                        <span className="truncate">{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <button 
                  onClick={() => handleDelete(showDeleteModal)}
                  disabled={isDeleting}
                  className="w-full py-3.5 bg-rose-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-600/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  <span>{isDeleting ? 'Eliminando...' : 'Confirmar Eliminación'}</span>
                </button>
                <button 
                  onClick={() => setShowDeleteModal(null)}
                  className="w-full py-3 bg-surface-container-low text-on-surface font-black text-xs uppercase tracking-widest rounded-xl hover:bg-surface-container cursor-pointer transition-colors"
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
