import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, PlusCircle, Edit3, Trash2, X, ArrowLeft, Check, 
  Coffee, Car, Utensils, ShoppingBag, Home, Briefcase, 
  Heart, Plane, Landmark, Bus, Smartphone, Gift, Tag, 
  Wallet, Scissors, Film, Ticket, Wifi, CreditCard, Play,
  MoreHorizontal, Loader2, DollarSign
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn, formatCurrency } from '@/src/lib/utils';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { createShortcut, updateShortcut, deleteShortcut, Shortcut } from '../services/firestoreService';

export const SHORTCUT_ICONS: Record<string, any> = {
  Coffee,
  Car,
  Utensils,
  ShoppingBag,
  Zap,
  Home,
  Briefcase,
  Heart,
  Plane,
  Landmark,
  Bus,
  Smartphone,
  Gift,
  Tag,
  Wallet,
  Scissors,
  Film,
  Ticket,
  Wifi,
  CreditCard,
  Play,
  MoreHorizontal
};

export const ShortcutIconComponent = ({ name, size = 20, className }: { name: string, size?: number, className?: string }) => {
  const Icon = SHORTCUT_ICONS[name] || Zap;
  return <Icon size={size} className={className} />;
};

const PAYMENT_METHODS = [
  'Efectivo',
  'Tarjeta de Débito',
  'Tarjeta de Crédito',
  'Transferencia',
  'Mercado Pago'
];

export const ManageShortcuts: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { shortcuts, categories, projects, loading } = useData();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Coffee');
  const [projectId, setProjectId] = useState('personal');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [defaultAmount, setDefaultAmount] = useState<string>('');

  const expenseCategories = categories.filter(c => c.type === 'expense');

  const handleOpenModal = (shortcut?: Shortcut) => {
    if (shortcut) {
      setEditingShortcut(shortcut);
      setName(shortcut.name);
      setIcon(shortcut.icon || 'Coffee');
      setProjectId(shortcut.projectId || 'personal');
      setCategoryId(shortcut.categoryId);
      setPaymentMethod(shortcut.paymentMethod || 'Efectivo');
      setDefaultAmount(shortcut.defaultAmount ? String(shortcut.defaultAmount) : '');
    } else {
      setEditingShortcut(null);
      setName('');
      setIcon('Coffee');
      setProjectId('personal');
      setCategoryId(expenseCategories[0]?.id || '');
      setPaymentMethod('Efectivo');
      setDefaultAmount('');
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !categoryId) return;

    setIsSaving(true);
    try {
      const parsedAmount = defaultAmount ? parseFloat(defaultAmount) : null;
      const data = {
        name: name.trim(),
        icon,
        projectId,
        categoryId,
        paymentMethod,
        defaultAmount: parsedAmount && !isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : null
      };

      if (editingShortcut) {
        await updateShortcut(editingShortcut.id, data);
      } else {
        await createShortcut(data);
      }

      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving shortcut:', error);
      alert('No se pudo guardar el atajo. Intenta nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este atajo?')) return;
    setIsDeleting(id);
    try {
      await deleteShortcut(id);
    } catch (error) {
      console.error('Error deleting shortcut:', error);
    } finally {
      setIsDeleting(null);
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
    <div className="px-4 sm:px-6 max-w-4xl mx-auto py-6 sm:py-8 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/settings')}
            className="p-2.5 bg-surface-container-low hover:bg-on-surface/5 rounded-2xl transition-all text-on-surface-variant shrink-0 border border-on-surface/5"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-on-surface font-headline flex items-center gap-2">
              <Zap className="text-amber-500 fill-amber-500/20" size={26} />
              Atajos de Gastos
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
              Crea accesos rápidos para registrar tus gastos frecuentes en 1 clic.
            </p>
          </div>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-primary hover:opacity-90 text-white px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl flex items-center gap-2 font-bold text-xs sm:text-sm transition-all active:scale-95 shadow-lg shadow-primary/20 shrink-0"
        >
          <PlusCircle size={18} />
          <span>Crear Atajo</span>
        </button>
      </div>

      {/* Shortcuts Grid */}
      {shortcuts.length === 0 ? (
        <div className="bg-surface-container-lowest border-2 border-dashed border-on-surface/10 rounded-[2.5rem] p-10 text-center space-y-4">
          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto text-amber-500">
            <Zap size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-on-surface font-headline">Aún no tienes atajos creados</h3>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto mt-1">
              Los atajos te permiten precargar la categoría, proyecto y método de pago para que al tocar un botón solo ingreses el monto.
            </p>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-primary text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-md hover:opacity-90 transition-all inline-flex items-center gap-2"
          >
            <PlusCircle size={18} />
            Crear mi primer atajo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {shortcuts.map((shortcut) => {
            const category = categories.find(c => c.id === shortcut.categoryId);
            const project = shortcut.projectId === 'personal' 
              ? { name: 'Personal' } 
              : projects.find(p => p.id === shortcut.projectId);

            return (
              <motion.div 
                key={shortcut.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-surface-container-lowest p-5 rounded-[2rem] border border-on-surface/5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0",
                      category?.color || 'bg-amber-500'
                    )}>
                      <ShortcutIconComponent name={shortcut.icon} size={28} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-extrabold text-on-surface text-lg font-headline truncate group-hover:text-primary transition-colors">
                        {shortcut.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-on-surface/5 text-on-surface-variant">
                          {category?.name || 'Categoría'}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-primary/10 text-primary">
                          {project?.name || 'Personal'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => handleOpenModal(shortcut)}
                      className="p-2 text-on-surface-variant/40 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                      title="Editar"
                    >
                      <Edit3 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(shortcut.id)}
                      disabled={isDeleting === shortcut.id}
                      className="p-2 text-on-surface-variant/40 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl transition-all disabled:opacity-50"
                      title="Eliminar"
                    >
                      {isDeleting === shortcut.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-on-surface/5 text-xs text-on-surface-variant">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span>{shortcut.paymentMethod}</span>
                  </div>
                  <div className="font-bold font-headline text-on-surface">
                    {shortcut.defaultAmount && shortcut.defaultAmount > 0 ? (
                      <span className="text-primary bg-primary/10 px-2.5 py-1 rounded-xl">
                        Default: {formatCurrency(shortcut.defaultAmount, profile?.currency)}
                      </span>
                    ) : (
                      <span className="text-on-surface-variant/60 italic">
                        Monto libre
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal Create / Edit Shortcut */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 flex flex-col max-h-[90vh] overflow-hidden border border-on-surface/10"
            >
              {/* Fixed Modal Header */}
              <div className="flex justify-between items-center px-6 py-5 border-b border-on-surface/5 shrink-0 bg-surface">
                <div className="min-w-0 flex-1 mr-3">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface font-headline truncate">
                    {editingShortcut ? 'Editar Atajo' : 'Nuevo Atajo de Gasto'}
                  </h2>
                  <p className="text-xs text-on-surface-variant/60 font-bold uppercase tracking-wider mt-0.5 truncate">
                    Configura la plantilla para registros rápidos
                  </p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="p-2 hover:bg-on-surface/5 rounded-full transition-colors text-on-surface-variant shrink-0"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <form id="shortcut-form" onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto flex-1">
                {/* Nombre */}
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 ml-1">
                    Nombre del Atajo
                  </label>
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Café diario, Subte, Combustible..."
                    className="w-full bg-surface-container-low border-none rounded-2xl p-4 text-base font-bold focus:ring-2 focus:ring-primary/20 transition-all text-on-surface"
                  />
                </div>

                {/* Selector de Icono */}
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 ml-1">
                    Icono
                  </label>
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-40 overflow-y-auto p-2 bg-surface-container-low rounded-2xl border border-on-surface/5">
                    {Object.keys(SHORTCUT_ICONS).map((iconName) => (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setIcon(iconName)}
                        className={cn(
                          "aspect-square rounded-xl flex items-center justify-center transition-all border",
                          icon === iconName 
                            ? "bg-primary text-white border-primary shadow-md shadow-primary/20 scale-105" 
                            : "bg-surface hover:bg-on-surface/5 text-on-surface-variant border-transparent"
                        )}
                      >
                        <ShortcutIconComponent name={iconName} size={20} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Categoría */}
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 ml-1">
                    Categoría de Gasto
                  </label>
                  <select 
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-surface-container-low border-none rounded-2xl p-4 text-base font-bold focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer text-on-surface"
                  >
                    {expenseCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Proyecto */}
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 ml-1">
                    Asignar a Proyecto
                  </label>
                  <select 
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full bg-surface-container-low border-none rounded-2xl p-4 text-base font-bold focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer text-on-surface"
                  >
                    <option value="personal">Personal (Billetera principal)</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.currency || 'ARS'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Método de Pago */}
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 ml-1">
                    Método de Pago
                  </label>
                  <select 
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-surface-container-low border-none rounded-2xl p-4 text-base font-bold focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer text-on-surface"
                  >
                    {PAYMENT_METHODS.map(pm => (
                      <option key={pm} value={pm}>{pm}</option>
                    ))}
                  </select>
                </div>

                {/* Monto Por Defecto (Opcional) */}
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1 ml-1">
                    Monto por Defecto (Opcional)
                  </label>
                  <p className="text-[11px] text-on-surface-variant/60 font-medium mb-2 ml-1">
                    Dejá en blanco si preferís ingresar el importe cada vez con el teclado numérico.
                  </p>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold text-lg">$</span>
                    <input 
                      type="number" 
                      step="any"
                      min="0"
                      value={defaultAmount}
                      onChange={(e) => setDefaultAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-surface-container-low border-none rounded-2xl p-4 pl-9 text-base font-bold focus:ring-2 focus:ring-primary/20 transition-all text-on-surface"
                    />
                  </div>
                </div>
              </form>

              {/* Fixed Modal Footer */}
              <div className="p-6 pt-4 border-t border-on-surface/5 bg-surface shrink-0">
                <button 
                  type="submit"
                  form="shortcut-form"
                  disabled={isSaving}
                  className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-base shadow-xl shadow-primary/20 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    editingShortcut ? 'Guardar Cambios' : 'Crear Atajo'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
