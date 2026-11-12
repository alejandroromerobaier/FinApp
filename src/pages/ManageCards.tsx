import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CreditCard as CreditCardIcon, Plus, Edit2, Trash2, ArrowLeft, 
  Calendar, Check, X, AlertTriangle, ShieldCheck, Sparkles, Building2, Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { 
  CreditCard, 
  createCard, 
  updateCard, 
  deleteCard 
} from '../services/firestoreService';
import { PROJECT_COLOR_OPTIONS } from '../lib/constants';
import { PageHeader } from '../components/PageHeader';
import { CustomSelect } from '../components/CustomSelect';

export const ManageCards: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cards } = useData();

  const [showModal, setShowModal] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [cardToDelete, setCardToDelete] = useState<CreditCard | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [bank, setBank] = useState('');
  const [last4Digits, setLast4Digits] = useState('');
  const [currency, setCurrency] = useState('ARS');
  const [closingDay, setClosingDay] = useState<string>('25');
  const [dueDay, setDueDay] = useState<string>('5');
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLOR_OPTIONS[0].gradient);

  const openAddModal = () => {
    setEditingCard(null);
    setName('');
    setBank('');
    setLast4Digits('');
    setCurrency('ARS');
    setClosingDay('25');
    setDueDay('5');
    setSelectedColor(PROJECT_COLOR_OPTIONS[0].gradient);
    setError(null);
    setShowModal(true);
  };

  const openEditModal = (card: CreditCard) => {
    setEditingCard(card);
    setName(card.name);
    setBank(card.bank || '');
    setLast4Digits(card.last4Digits || '');
    setCurrency(card.currency || 'ARS');
    setClosingDay(card.closingDay ? String(card.closingDay) : '25');
    setDueDay(card.dueDay ? String(card.dueDay) : '5');
    setSelectedColor(card.color || PROJECT_COLOR_OPTIONS[0].gradient);
    setError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Ingresá un nombre para la tarjeta.');
      return;
    }
    const parsedClosing = parseInt(closingDay, 10);
    const parsedDue = parseInt(dueDay, 10);

    if (isNaN(parsedClosing) || parsedClosing < 1 || parsedClosing > 31) {
      setError('El día de cierre debe estar entre 1 y 31.');
      return;
    }
    if (isNaN(parsedDue) || parsedDue < 1 || parsedDue > 31) {
      setError('El día de vencimiento debe estar entre 1 y 31.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const cardData = {
        name: name.trim(),
        bank: bank.trim() || undefined,
        last4Digits: last4Digits.replace(/\D/g, '').slice(-4) || undefined,
        currency,
        closingDay: parsedClosing,
        dueDay: parsedDue,
        color: selectedColor
      };

      if (editingCard) {
        await updateCard(editingCard.id, cardData);
      } else {
        await createCard(cardData);
      }

      setShowModal(false);
    } catch (err: any) {
      console.error('Error saving credit card:', err);
      setError('Hubo un error al guardar la tarjeta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!cardToDelete) return;
    setIsDeleting(true);
    try {
      await deleteCard(cardToDelete.id);
      setCardToDelete(null);
    } catch (err) {
      console.error('Error deleting card:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <PageHeader
        backTo="/settings"
        categoryTag="Medios de Pago"
        title="Tarjetas de Crédito"
        subtitle="Administrá tus tarjetas, cierres y vencimientos para proyectar tus cuotas."
        rightAction={
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => navigate('/credit-cards')}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-container rounded-xl text-on-surface font-bold text-xs border border-on-surface/10 hover:bg-surface-container-high transition-all cursor-pointer whitespace-nowrap"
            >
              <Layers size={14} className="text-primary dark:text-blue-400" />
              <span>Ver Cuotas</span>
            </button>
            <button
              onClick={openAddModal}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-primary text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus size={16} />
              <span>Nueva Tarjeta</span>
            </button>
          </div>
        }
      />

      {/* Cards Grid */}
      {cards.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-3xl p-10 text-center border border-on-surface/5 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-primary/10 text-primary flex items-center justify-center">
            <CreditCardIcon size={32} />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-lg font-bold text-on-surface">No tenés tarjetas registradas</h3>
            <p className="text-sm text-on-surface-variant">
              Agregá tus tarjetas con sus fechas de cierre y vencimiento para que al registrar compras en cuotas se calculen automáticamente los resúmenes y fechas de pago.
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-bold text-sm rounded-2xl shadow-md hover:bg-primary/90 transition-all"
          >
            <Plus size={18} />
            <span>Agregar mi primera tarjeta</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cards.map((card) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="group relative"
            >
              {/* Visual Card representation */}
              <div 
                className={`relative w-full aspect-[1.586/1] rounded-3xl p-6 text-white flex flex-col justify-between overflow-hidden shadow-xl transition-all duration-3xl group-hover:scale-[1.02] group-hover:shadow-2xl ${card.color || PROJECT_COLOR_OPTIONS[0].gradient}`}
              >
                {/* Background decorative circles */}
                <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/10 blur-xl pointer-events-none" />
                <div className="absolute -bottom-16 -left-16 w-52 h-52 rounded-full bg-black/20 blur-2xl pointer-events-none" />

                {/* Top: Bank & Chip */}
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <span className="text-xs uppercase tracking-widest font-semibold opacity-80 block">
                      {card.bank || 'Tarjeta de Crédito'}
                    </span>
                    <span className="text-lg font-black tracking-wide drop-shadow-sm">
                      {card.name}
                    </span>
                  </div>
                  {/* EMV Chip & Contactless icon */}
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-7 rounded-md bg-amber-300/80 border border-amber-200/50 shadow-inner flex flex-col justify-between p-1">
                      <div className="h-0.5 w-full bg-amber-600/30 rounded" />
                      <div className="h-0.5 w-full bg-amber-600/30 rounded" />
                    </div>
                  </div>
                </div>

                {/* Middle: Masked Number */}
                <div className="relative z-10 my-auto">
                  <div className="font-mono text-base tracking-[0.25em] opacity-90 drop-shadow-sm flex items-center gap-2">
                    <span>••••</span>
                    <span>••••</span>
                    <span>••••</span>
                    <span>{card.last4Digits || '••••'}</span>
                  </div>
                </div>

                {/* Bottom: Dates & Currency */}
                <div className="relative z-10 flex items-end justify-between text-xs">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 block">
                        Cierre
                      </span>
                      <span className="font-extrabold text-sm drop-shadow-sm">
                        Día {card.closingDay}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 block">
                        Vence
                      </span>
                      <span className="font-extrabold text-sm drop-shadow-sm">
                        Día {card.dueDay}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 block">
                      Moneda
                    </span>
                    <span className="font-black text-sm px-2 py-0.5 rounded-lg bg-white/15 backdrop-blur-sm">
                      {card.currency || 'ARS'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons below card */}
              <div className="mt-3 flex items-center justify-end gap-2 px-1">
                <button
                  onClick={() => openEditModal(card)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  <Edit2 size={14} />
                  <span>Editar</span>
                </button>
                <button
                  onClick={() => setCardToDelete(card)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-error/80 hover:text-error hover:bg-error/10 transition-colors"
                >
                  <Trash2 size={14} />
                  <span>Eliminar</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-container-lowest rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-on-surface/10 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-on-surface">
                  {editingCard ? 'Editar Tarjeta' : 'Nueva Tarjeta'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-xl hover:bg-surface-container transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Live Preview of the card being configured */}
              <div className="mb-5">
                <div 
                  className={`w-full aspect-[2/1] rounded-2xl p-5 text-white flex flex-col justify-between shadow-lg ${selectedColor}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] uppercase font-bold opacity-75">{bank || 'Banco / Emisor'}</p>
                      <p className="text-base font-black">{name || 'Nombre de la tarjeta'}</p>
                    </div>
                    <div className="w-7 h-5 rounded bg-amber-300/80 border border-amber-200/50" />
                  </div>
                  <div className="font-mono text-xs tracking-widest opacity-90">
                    •••• •••• •••• {last4Digits || '••••'}
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>Cierre: Día {closingDay || '--'}</span>
                    <span>Vence: Día {dueDay || '--'}</span>
                    <span className="font-bold">{currency}</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-2xl bg-error/10 text-error text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                    Nombre o Apodo de la Tarjeta *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Visa Signature, Mastercard Gold, Amex..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-surface-container-low border border-on-surface/10 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                      Banco / Emisor
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Santander, BBVA..."
                      value={bank}
                      onChange={(e) => setBank(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-surface-container-low border border-on-surface/10 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                      Últimos 4 Dígitos
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="Ej: 4321"
                      value={last4Digits}
                      onChange={(e) => setLast4Digits(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="w-full px-4 py-2.5 rounded-2xl bg-surface-container-low border border-on-surface/10 text-on-surface text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                      Día Cierre
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={2}
                      placeholder="25"
                      required
                      value={closingDay}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        if (raw === '') {
                          setClosingDay('');
                          return;
                        }
                        const num = parseInt(raw, 10);
                        if (num > 31) {
                          setClosingDay('31');
                        } else {
                          setClosingDay(String(num));
                        }
                      }}
                      onBlur={() => {
                        if (!closingDay || Number(closingDay) < 1) {
                          setClosingDay('25');
                        }
                      }}
                      className="w-full px-3 py-2.5 rounded-2xl bg-surface-container-low border border-on-surface/10 text-on-surface text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                      Día Vence
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={2}
                      placeholder="5"
                      required
                      value={dueDay}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        if (raw === '') {
                          setDueDay('');
                          return;
                        }
                        const num = parseInt(raw, 10);
                        if (num > 31) {
                          setDueDay('31');
                        } else {
                          setDueDay(String(num));
                        }
                      }}
                      onBlur={() => {
                        if (!dueDay || Number(dueDay) < 1) {
                          setDueDay('5');
                        }
                      }}
                      className="w-full px-3 py-2.5 rounded-2xl bg-surface-container-low border border-on-surface/10 text-on-surface text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div>
                    <CustomSelect
                      label="Moneda"
                      value={currency}
                      onChange={(val) => setCurrency(val as string)}
                      options={[
                        { value: 'ARS', label: 'ARS ($)' },
                        { value: 'USD', label: 'USD (U$S)' }
                      ]}
                      size="sm"
                    />
                  </div>
                </div>

                {/* Color Selector */}
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                    Estilo / Color
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {PROJECT_COLOR_OPTIONS.map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => setSelectedColor(col.gradient)}
                        className={`p-2 rounded-2xl flex items-center justify-center border-2 transition-all ${
                          selectedColor === col.gradient ? 'border-primary ring-2 ring-primary/20 scale-105' : 'border-transparent hover:border-on-surface/20'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl ${col.previewClass} shadow-sm flex items-center justify-center text-white`}>
                          {selectedColor === col.gradient && <Check size={16} strokeWidth={3} />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 px-4 rounded-2xl border border-on-surface/10 font-bold text-sm text-on-surface hover:bg-surface-container transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 px-4 rounded-2xl bg-primary text-on-primary font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Guardando...' : (editingCard ? 'Actualizar' : 'Guardar')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {cardToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-container-lowest rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-on-surface/10 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-error/10 text-error flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-lg font-black text-on-surface">¿Eliminar tarjeta?</h3>
                <p className="text-xs text-on-surface-variant">
                  Vas a eliminar <strong className="text-on-surface">{cardToDelete.name}</strong>. Los gastos ya registrados con esta tarjeta no se borrarán, pero la tarjeta dejará de estar disponible para nuevos registros.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCardToDelete(null)}
                  className="flex-1 py-2.5 rounded-xl border border-on-surface/10 font-bold text-xs text-on-surface hover:bg-surface-container transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDelete}
                  className="flex-1 py-2.5 rounded-xl bg-error text-white font-bold text-xs hover:bg-error/90 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
