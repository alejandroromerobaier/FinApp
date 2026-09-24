import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Landmark, Home, Plane, ShoppingBag, Edit2, Trash2, 
  AlertTriangle, ChevronRight, UnfoldVertical, PlusCircle,
  X, Check, Loader2, Utensils, Car, Play, Heart, Book, 
  MoreHorizontal, Tag, Gift, Briefcase, Coffee, Zap, 
  Smartphone, ShieldCheck, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/src/lib/utils';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { deleteCategory, deleteProject, addCategory, updateCategory, deleteAllTransactions, cleanupDuplicateCategories, reassignTransactions } from '../services/firestoreService';

const ICON_MAP: Record<string, any> = {
  ShoppingBag, Utensils, Car, Play, Heart, Book, MoreHorizontal, 
  Landmark, Tag, Gift, Briefcase, Home, Plane, Coffee, Zap, Smartphone, ShieldCheck
};

const IconComponent = ({ name, size = 20 }: { name: string, size?: number }) => {
  const Icon = ICON_MAP[name] || MoreHorizontal;
  return <Icon size={size} />;
};

const COLORS = [
  'bg-rose-500', 'bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 
  'bg-purple-500', 'bg-indigo-500', 'bg-slate-500', 'bg-pink-500',
  'bg-cyan-500', 'bg-orange-500', 'bg-lime-500', 'bg-violet-500'
];

const ICONS = Object.keys(ICON_MAP);

export const ManageCategories: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { categories, projects, loading } = useData();
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // New Category State
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('Tag');
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [newType, setNewType] = useState<'expense' | 'income'>('expense');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [reassignTo, setReassignTo] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      if (reassignTo) {
        await reassignTransactions(id, reassignTo);
      }
      await deleteCategory(id);
      setShowDeleteModal(null);
      setReassignTo(null);
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Error al eliminar la categoría');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!newName.trim()) return;
    setIsAdding(true);
    try {
      const categoryData = {
        name: newName,
        icon: newIcon,
        color: newColor,
        type: newType
      };
      
      if (editingId) {
        await updateCategory(editingId, categoryData);
      } else {
        await addCategory(categoryData);
      }
      
      setShowAddModal(false);
      setEditingId(null);
      setNewName('');
      setNewIcon('Tag');
      setNewColor(COLORS[0]);
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Error al guardar la categoría');
    } finally {
      setIsAdding(false);
    }
  };

  const startEdit = (cat: any) => {
    setEditingId(cat.id);
    setNewName(cat.name);
    setNewIcon(cat.icon);
    setNewColor(cat.color);
    setNewType(cat.type);
    setShowAddModal(true);
  };

  const handleFullReset = async () => {
    setIsResetting(true);
    try {
      await deleteAllTransactions();
      await cleanupDuplicateCategories();
      // Also delete all projects if user wants a FULL clean
      for (const p of projects) {
         await deleteProject(p.id);
      }
      setShowResetConfirm(false);
      alert('Se han eliminado todas las transacciones y las categorías duplicadas.');
    } catch (error) {
      console.error('Error during full reset:', error);
      alert('Error al realizar el reset.');
    } finally {
      setIsResetting(false);
    }
  };

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
          <button onClick={() => navigate(-1)} className="text-on-surface-variant p-2 hover:bg-on-surface/5 rounded-full transition-colors active:scale-90">
            <ArrowLeft size={22} className="sm:w-[24px] sm:h-[24px]" />
          </button>
          <span className="text-lg sm:text-xl font-extrabold tracking-tight text-on-surface font-headline">
            Categorías
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowResetConfirm(true)}
            className="p-2.5 text-rose-500 hover:bg-rose-50 transition-colors rounded-xl"
            title="Borrar todo y limpiar duplicados"
          >
            <Trash2 size={20} />
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-primary text-white p-2.5 rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-transform"
          >
            <PlusCircle size={22} />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-8">
        <section className="mb-8">
          <h2 className="text-3xl font-black tracking-tight text-on-surface font-headline mb-2">Tus Categorías</h2>
          <p className="text-on-surface-variant text-sm font-medium">Organiza tus finanzas con etiquetas personalizadas.</p>
        </section>

        {/* Tabs for Expense/Income */}
        <div className="flex gap-4 mb-8">
          <button 
            onClick={() => setNewType('expense')}
            className={cn(
              "px-6 py-2 rounded-full text-sm font-bold transition-all",
              newType === 'expense' ? "bg-rose-100 text-rose-700" : "bg-on-surface/5 text-on-surface-variant"
            )}
          >
            Gastos
          </button>
          <button 
            onClick={() => setNewType('income')}
            className={cn(
              "px-6 py-2 rounded-full text-sm font-bold transition-all",
              newType === 'income' ? "bg-emerald-100 text-emerald-700" : "bg-on-surface/5 text-on-surface-variant"
            )}
          >
            Ingresos
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.filter(c => c.type === newType).map((cat) => (
            <div 
              key={cat.id}
              className="bg-surface-container-lowest p-5 rounded-2xl border border-on-surface/5 flex items-center justify-between group hover:bg-on-surface/5 transition-colors shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm", cat.color)}>
                  <IconComponent name={cat.icon} size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-on-surface tracking-tight font-headline">{cat.name}</h3>
                  <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
                    {cat.type === 'expense' ? 'Gasto' : 'Ingreso'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {cat.ownerId === user?.uid && (
                  <>
                    <button 
                      onClick={() => startEdit(cat)}
                      className="p-2.5 rounded-xl text-primary hover:bg-primary/5 transition-colors"
                    >
                      <Edit2 size={20} />
                    </button>
                    <button 
                      onClick={() => setShowDeleteModal(cat.id)}
                      className="p-2.5 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 size={20} />
                    </button>
                  </>
                )}
                {(cat.scope === 'system' || !cat.ownerId) && (
                  <span className="text-[9px] font-black text-on-surface-variant/20 uppercase tracking-widest px-3 py-1 bg-on-surface/5 rounded-full">Sistema</span>
                )}
              </div>
            </div>
          ))}

          {categories.filter(c => c.type === newType).length === 0 && (
            <div className="col-span-full py-20 text-center bg-on-surface/5 rounded-[2.5rem] border-2 border-dashed border-on-surface/10">
              <p className="text-on-surface-variant font-bold">No hay categorías para este tipo.</p>
              <button 
                onClick={() => setShowAddModal(true)}
                className="mt-4 text-primary font-black text-sm uppercase tracking-widest"
              >
                Crear la primera
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="fixed bottom-0 left-0 w-full bg-surface-container-lowest rounded-t-[3rem] z-[70] p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="w-12 h-1.5 bg-on-surface/10 rounded-full mx-auto mb-8" />
              <h3 className="text-2xl font-black text-on-surface font-headline tracking-tight mb-8 text-center">{editingId ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
              
              <div className="space-y-8">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40 mb-3">Nombre</label>
                  <input 
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ej. Gimnasio, Freelance..."
                    className="w-full bg-on-surface/5 border-none rounded-2xl p-5 text-xl font-bold text-on-surface placeholder:text-on-surface-variant/20 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40 mb-3">Tipo</label>
                  <div className="flex bg-on-surface/5 p-1.5 rounded-2xl">
                    <button 
                      type="button"
                      onClick={() => setNewType('expense')}
                      className={cn(
                        "flex-1 py-3 px-4 rounded-[14px] text-xs font-black transition-all uppercase tracking-wider",
                        newType === 'expense' ? "bg-surface-container-lowest text-rose-600 shadow-sm" : "text-on-surface-variant/40"
                      )}
                    >
                      Gasto
                    </button>
                    <button 
                      type="button"
                      onClick={() => setNewType('income')}
                      className={cn(
                        "flex-1 py-3 px-4 rounded-[14px] text-xs font-black transition-all uppercase tracking-wider",
                        newType === 'income' ? "bg-surface-container-lowest text-emerald-600 shadow-sm" : "text-on-surface-variant/40"
                      )}
                    >
                      Ingreso
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40 mb-3">Color</label>
                  <div className="flex flex-wrap gap-3">
                    {COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setNewColor(color)}
                        className={cn(
                          "w-10 h-10 rounded-full transition-all",
                          color,
                          newColor === color ? "ring-4 ring-on-surface/10 scale-110" : "opacity-60 hover:opacity-100"
                        )}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40 mb-3">Icono</label>
                  <div className="grid grid-cols-6 gap-4">
                    {ICONS.map(icon => (
                      <button
                        key={icon}
                        onClick={() => setNewIcon(icon)}
                        className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                          newIcon === icon ? "bg-primary text-white shadow-lg" : "bg-on-surface/5 text-on-surface-variant hover:bg-on-surface/10"
                        )}
                      >
                        <IconComponent name={icon} size={20} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-5 bg-on-surface/5 rounded-2xl text-on-surface font-black text-sm uppercase tracking-widest"
                  >
                    Cancelar
                  </button>
                    <button 
                    onClick={handleSave}
                    disabled={!newName.trim() || isAdding}
                    className="flex-1 py-5 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isAdding ? 'Guardando...' : (editingId ? 'Guardar Cambios' : 'Crear')}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-container-lowest rounded-[2.5rem] p-8 shadow-2xl max-w-sm w-full text-center"
            >
              <div className="w-20 h-20 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={40} />
              </div>
              <p className="text-on-surface-variant text-sm font-medium leading-relaxed mb-6">
                ¿A qué categoría quieres mover las transacciones existentes?
              </p>
              
              <div className="text-left mb-8">
                <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40 mb-3 ml-1">REASIGNAR A (OPCIONAL)</label>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  <button 
                    onClick={() => setReassignTo(null)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all",
                      reassignTo === null ? "bg-on-surface text-white shadow-lg" : "bg-on-surface/5 border-transparent"
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                      <Trash2 size={16} />
                    </div>
                    <span className="text-sm font-bold">Eliminar Directamente</span>
                  </button>
                  
                  {categories.filter(c => c.id !== showDeleteModal && c.type === categories.find(curr => curr.id === showDeleteModal)?.type).map(cat => (
                    <button 
                      key={cat.id}
                      onClick={() => setReassignTo(cat.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-all",
                        reassignTo === cat.id ? "bg-primary text-white shadow-lg" : "bg-on-surface/5 border-transparent transition-all"
                      )}
                    >
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white", cat.color)}>
                        <IconComponent name={cat.icon} size={16} />
                      </div>
                      <span className="text-sm font-bold">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => handleDelete(showDeleteModal)}
                  disabled={isDeleting}
                  className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-rose-600/20 active:scale-95 transition-all"
                >
                  {isDeleting ? 'Eliminando...' : 'Eliminar'}
                </button>
                <button 
                  onClick={() => setShowDeleteModal(null)}
                  className="w-full py-4 bg-on-surface/5 text-on-surface font-black text-sm uppercase tracking-widest rounded-2xl"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-on-surface/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-surface-container-lowest rounded-[2.5rem] p-8 shadow-2xl max-w-sm w-full text-center border border-rose-100"
            >
              <div className="w-20 h-20 rounded-full bg-rose-500 text-white flex items-center justify-center mx-auto mb-6 shadow-lg shadow-rose-500/30">
                <AlertTriangle size={40} />
              </div>
              <h3 className="text-2xl font-black text-on-surface font-headline mb-3">¿Limpieza Profunda?</h3>
              <p className="text-on-surface-variant text-sm font-medium leading-relaxed mb-8">
                Esto eliminará **TODAS** tus transacciones y fusionará las categorías duplicadas. Esta acción es irreversible.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleFullReset}
                  disabled={isResetting}
                  className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-rose-600/20 active:scale-95 transition-all"
                >
                  {isResetting ? 'Limpiando...' : 'Sí, borrar todo'}
                </button>
                <button 
                  onClick={() => setShowResetConfirm(false)}
                  className="w-full py-4 bg-on-surface/5 text-on-surface font-black text-sm uppercase tracking-widest rounded-2xl"
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

const IndicatorCard = ({ title, value, subtitle, isStatus }: any) => (
  <div className="bg-slate-50 p-6 rounded-2xl relative overflow-hidden group">
    <h4 className="text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-widest mb-4">{title}</h4>
    <div className="flex items-center gap-2">
      {isStatus && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[0.6rem] font-bold uppercase">
          Estable
        </span>
      )}
      {!isStatus && <p className="text-2xl font-bold text-primary font-headline">{value}</p>}
    </div>
    <p className="mt-1 text-xs text-on-surface-variant">{subtitle}</p>
  </div>
);
