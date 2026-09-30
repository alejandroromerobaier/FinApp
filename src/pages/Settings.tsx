import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User as UserIcon, 
  LayoutGrid, 
  Tag, 
  CreditCard, 
  Calendar, 
  LogOut, 
  ChevronRight, 
  Mail, 
  BarChart3, 
  Target, 
  Globe, 
  Zap, 
  Edit3, 
  ShieldCheck, 
  KeyRound, 
  Phone, 
  Briefcase, 
  FileText, 
  X, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Lock
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/AuthContext';
import { updateUserProfile, syncUserProfile } from '../services/firestoreService';
import { updatePassword, updateProfile as updateFirebaseProfile, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';

const CURRENCIES = [
  { code: 'ARS', label: 'ARS (Pesos Argentinos)', symbol: '$' },
  { code: 'USD', label: 'USD (Dólares)', symbol: 'U$D' },
  { code: 'EUR', label: 'EUR (Euros)', symbol: '€' },
  { code: 'BRL', label: 'BRL (Reales)', symbol: 'R$' },
  { code: 'CLP', label: 'CLP (Pesos Chilenos)', symbol: 'CP$' },
  { code: 'UYU', label: 'UYU (Pesos Uruguayos)', symbol: '$U' },
];

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
];

export const Settings: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  // Profile Edit Modal state
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editOccupation, setEditOccupation] = useState('');
  const [editPhotoURL, setEditPhotoURL] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Security / Password Modal state
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secSaving, setSecSaving] = useState(false);
  const [secSuccess, setSecSuccess] = useState<string | null>(null);
  const [secError, setSecError] = useState<string | null>(null);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const isGoogleUser = user?.providerData.some(p => p.providerId === 'google.com');

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleCurrencyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (user) {
      await updateUserProfile(user.uid, { currency: e.target.value });
    }
  };

  const openEditProfile = () => {
    setEditName(user?.displayName || profile?.name || '');
    setEditPhone(profile?.phone || '');
    setEditBio(profile?.bio || '');
    setEditOccupation(profile?.occupation || '');
    setEditPhotoURL(user?.photoURL || profile?.photoURL || '');
    setProfileSuccess(null);
    setProfileError(null);
    setIsEditProfileOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!editName.trim()) {
      setProfileError('El nombre completo no puede estar vacío');
      return;
    }

    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      // 1. Update Firebase Auth Profile
      await updateFirebaseProfile(user, {
        displayName: editName.trim(),
        photoURL: editPhotoURL.trim()
      });

      // 2. Update Firestore User document
      await updateUserProfile(user.uid, {
        name: editName.trim(),
        photoURL: editPhotoURL.trim(),
        phone: editPhone.trim(),
        bio: editBio.trim(),
        occupation: editOccupation.trim()
      });

      setProfileSuccess('¡Perfil actualizado con éxito!');
      setTimeout(() => {
        setIsEditProfileOpen(false);
      }, 1200);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setProfileError('Ocurrió un error al guardar los cambios del perfil.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (newPassword.length < 6) {
      setSecError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecError('Las contraseñas ingresadas no coinciden');
      return;
    }

    setSecSaving(true);
    setSecError(null);
    setSecSuccess(null);

    try {
      await updatePassword(user, newPassword);
      setSecSuccess('¡Contraseña actualizada correctamente!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsSecurityOpen(false);
      }, 1500);
    } catch (err: any) {
      console.error('Password change error:', err);
      if (err.code === 'auth/requires-recent-login') {
        setSecError('Por seguridad, debes haber iniciado sesión recientemente. Cierra sesión e ingresa nuevamente para cambiar tu contraseña.');
      } else {
        setSecError(err.message || 'Error al actualizar contraseña.');
      }
    } finally {
      setSecSaving(false);
    }
  };

  const handleSendResetEmailFromProfile = async () => {
    if (!user?.email) return;
    setSecSaving(true);
    setSecError(null);
    setSecSuccess(null);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setResetEmailSent(true);
      setSecSuccess(`Se envió un enlace para restablecer contraseña a ${user.email}`);
    } catch (err: any) {
      console.error('Reset email error:', err);
      setSecError('Error al enviar el correo de restablecimiento.');
    } finally {
      setSecSaving(false);
    }
  };

  const userInitials = user?.displayName 
    ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || '??';

  return (
    <div className="px-4 sm:px-6 max-w-2xl mx-auto py-6 sm:py-8 space-y-8 pb-28">
      {/* Header */}
      <section>
        <h1 className="text-3xl font-black tracking-tight text-on-surface font-headline">Ajustes & Perfil</h1>
        <p className="text-on-surface-variant mt-1 text-sm">Gestiona tu información personal, seguridad y preferencias.</p>
      </section>

      {/* User Profile Main Card */}
      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">Perfil de Usuario</h2>
        <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-on-surface/5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-500 flex items-center justify-center text-white overflow-hidden shadow-md border-2 border-white">
                  {user?.photoURL || profile?.photoURL ? (
                    <img 
                      src={user?.photoURL || profile?.photoURL} 
                      alt={user?.displayName || 'User'} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    <span className="text-xl font-black font-headline tracking-widest">{userInitials}</span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xl font-black text-on-surface font-headline leading-tight">
                  {user?.displayName || profile?.name || 'Usuario FinApp'}
                </h3>
                <p className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5 font-medium">
                  <Mail size={13} className="text-primary" />
                  {user?.email}
                </p>
                {profile?.phone && (
                  <p className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5 font-medium">
                    <Phone size={13} className="text-emerald-600" />
                    {profile.phone}
                  </p>
                )}
              </div>
            </div>

            {/* Provider Pill */}
            <div className="flex sm:flex-col items-end gap-2 shrink-0">
              {isGoogleUser ? (
                <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-blue-100">
                  <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-3.5 h-3.5" alt="Google" />
                  <span>Google Account</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-100">
                  <Lock size={12} />
                  <span>Email / Password</span>
                </div>
              )}
            </div>
          </div>

          {/* Additional info tags if present */}
          {(profile?.occupation || profile?.bio) && (
            <div className="pt-2 border-t border-on-surface/5 space-y-1">
              {profile?.occupation && (
                <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <Briefcase size={14} className="text-blue-600" />
                  <span>{profile.occupation}</span>
                </p>
              )}
              {profile?.bio && (
                <p className="text-xs text-on-surface-variant flex items-start gap-1.5 leading-relaxed">
                  <FileText size={14} className="text-on-surface-variant/60 shrink-0 mt-0.5" />
                  <span>{profile.bio}</span>
                </p>
              )}
            </div>
          )}

          {/* Quick Action Buttons */}
          <div className="pt-3 border-t border-on-surface/5 flex flex-wrap gap-2">
            <button
              onClick={openEditProfile}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all active:scale-95"
            >
              <Edit3 size={15} />
              <span>Editar Información</span>
            </button>

            <button
              onClick={() => {
                setSecError(null);
                setSecSuccess(null);
                setNewPassword('');
                setConfirmPassword('');
                setResetEmailSent(false);
                setIsSecurityOpen(true);
              }}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 bg-surface-container-low text-on-surface hover:bg-on-surface/5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all border border-on-surface/5 active:scale-95"
            >
              <ShieldCheck size={15} className="text-emerald-600" />
              <span>Seguridad & Clave</span>
            </button>
          </div>
        </div>
      </section>

      {/* Management Section */}
      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">Gestión</h2>
        <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-on-surface/5">
          <SettingsLink 
            to="/shared" 
            icon={<LayoutGrid size={20} />} 
            title="Gestión de Proyectos" 
            subtitle="Proyectos compartidos y creación" 
            iconColor="bg-primary/5 text-primary"
          />
          <SettingsLink 
            to="/categories" 
            icon={<Tag size={20} />} 
            title="Gestión de Categorías" 
            subtitle="Categorías personalizadas y colores" 
            iconColor="bg-emerald-50 text-emerald-700"
          />
          <SettingsLink 
            to="/budgets" 
            icon={<Target size={20} />} 
            title="Gestión de Presupuestos" 
            subtitle="Límites mensuales por categoría" 
            iconColor="bg-amber-50 text-amber-700"
          />
          <SettingsLink 
            to="/shortcuts" 
            icon={<Zap size={20} />} 
            title="Atajos de Gastos" 
            subtitle="Accesos rápidos configurables" 
            iconColor="bg-amber-500/10 text-amber-600"
          />
          <SettingsLink 
            to="/reports" 
            icon={<BarChart3 size={20} />} 
            title="Reportes y Exportación" 
            subtitle="Generación de PDF y consultas" 
            iconColor="bg-indigo-50 text-indigo-700"
            isLast
          />
        </div>
      </section>

      {/* Preferences Section */}
      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">Preferencias</h2>
        <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-on-surface/5">
          <div className="flex items-center justify-between p-4.5 border-b border-on-surface/5 group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant group-hover:text-primary transition-colors">
                <Globe size={20} />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-on-surface leading-none mb-1">Moneda Base</span>
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-black">Registros Personales</span>
              </div>
            </div>
            <select 
              value={profile?.currency || 'ARS'}
              onChange={handleCurrencyChange}
              className="bg-primary/5 text-primary text-xs font-black py-2.5 px-4 rounded-xl border-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
            >
              {CURRENCIES.map(curr => (
                <option key={curr.code} value={curr.code}>{curr.code} ({curr.symbol})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between p-4.5 border-b border-on-surface/5 group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant group-hover:text-amber-600 transition-colors">
                <CreditCard size={20} />
              </div>
              <span className="font-bold text-on-surface">Método Predeterminado</span>
            </div>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">Efectivo</span>
          </div>

          <div className="flex items-center justify-between p-4.5 group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant group-hover:text-primary transition-colors">
                <Calendar size={20} />
              </div>
              <span className="font-bold text-on-surface">Periodo de Análisis</span>
            </div>
            <span className="text-xs font-bold text-primary bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10">Mensual</span>
          </div>
        </div>
      </section>

      {/* System Actions */}
      <section className="pt-2">
        <button 
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 p-4 bg-error/5 text-error rounded-2xl font-black uppercase tracking-wider text-xs hover:bg-error/10 transition-all active:scale-[0.98] border border-error/10"
        >
          <LogOut size={18} />
          Cerrar Sesión
        </button>
        <p className="text-center text-[10px] text-on-surface-variant/40 mt-6 uppercase tracking-widest font-bold">FinApp v2.6.0 • 2026</p>
      </section>

      {/* --- EDIT PROFILE MODAL --- */}
      <AnimatePresence>
        {isEditProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-surface-container-lowest w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-on-surface/5 relative space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button 
                onClick={() => setIsEditProfileOpen(false)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-on-surface/5 text-on-surface-variant transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <Edit3 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-headline text-on-surface">Información Personal</h3>
                  <p className="text-xs text-on-surface-variant">Actualiza los datos de tu perfil.</p>
                </div>
              </div>

              {profileSuccess && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 rounded-2xl flex items-center gap-2 text-xs font-bold">
                  <CheckCircle2 size={18} />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {profileError && (
                <div className="p-4 bg-error-container text-error rounded-2xl flex items-center gap-2 text-xs font-bold">
                  <AlertCircle size={18} />
                  <span>{profileError}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">
                    Nombre Completo *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
                      <UserIcon size={18} />
                    </div>
                    <input 
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      placeholder="Tu nombre completo"
                      className="w-full pl-10 pr-4 py-3 bg-surface-container-low border-none rounded-2xl text-on-surface text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">
                    Teléfono de Contacto
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
                      <Phone size={18} />
                    </div>
                    <input 
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="+54 9 11 1234-5678"
                      className="w-full pl-10 pr-4 py-3 bg-surface-container-low border-none rounded-2xl text-on-surface text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {/* Occupation */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">
                    Ocupación / Profesión
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
                      <Briefcase size={18} />
                    </div>
                    <input 
                      type="text"
                      value={editOccupation}
                      onChange={(e) => setEditOccupation(e.target.value)}
                      placeholder="Ej. Arquitecto, Emprendedor, Contador..."
                      className="w-full pl-10 pr-4 py-3 bg-surface-container-low border-none rounded-2xl text-on-surface text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {/* Bio */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">
                    Nota Personal / Biografía
                  </label>
                  <textarea 
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    rows={2}
                    placeholder="Breve nota o meta financiera personal..."
                    className="w-full p-3.5 bg-surface-container-low border-none rounded-2xl text-on-surface text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>

                {/* Avatar Presets Selection */}
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">
                    Seleccionar Foto / Avatar
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {AVATAR_PRESETS.map((url, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setEditPhotoURL(url)}
                        className={cn(
                          "w-11 h-11 rounded-2xl overflow-hidden border-2 transition-all p-0.5",
                          editPhotoURL === url ? "border-primary scale-105 shadow-md" : "border-transparent opacity-70 hover:opacity-100"
                        )}
                      >
                        <img src={url} alt={`Avatar ${index}`} className="w-full h-full object-cover rounded-xl" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-on-surface/5">
                  <button
                    type="button"
                    onClick={() => setIsEditProfileOpen(false)}
                    className="flex-1 py-3.5 bg-surface-container-low text-on-surface font-bold rounded-2xl hover:bg-on-surface/5 transition-colors text-xs uppercase tracking-wider"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="flex-1 py-3.5 bg-primary text-white font-extrabold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-70"
                  >
                    {profileSaving ? <Loader2 className="animate-spin" size={18} /> : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- SECURITY / PASSWORD MODAL --- */}
      <AnimatePresence>
        {isSecurityOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-surface-container-lowest w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-on-surface/5 relative space-y-6"
            >
              <button 
                onClick={() => setIsSecurityOpen(false)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-on-surface/5 text-on-surface-variant transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-headline text-on-surface">Seguridad de la Cuenta</h3>
                  <p className="text-xs text-on-surface-variant">Gestión de contraseña y autenticación.</p>
                </div>
              </div>

              {secSuccess && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 rounded-2xl flex items-center gap-2 text-xs font-bold">
                  <CheckCircle2 size={18} />
                  <span>{secSuccess}</span>
                </div>
              )}

              {secError && (
                <div className="p-4 bg-error-container text-error rounded-2xl flex items-center gap-2 text-xs font-bold leading-tight">
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{secError}</span>
                </div>
              )}

              {isGoogleUser ? (
                <div className="p-5 bg-blue-500/10 border border-blue-500/20 text-blue-900 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 font-bold text-sm text-blue-700">
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                    <span>Autenticación administrada por Google</span>
                  </div>
                  <p className="text-xs text-blue-800 leading-relaxed">
                    Iniciaste sesión con tu cuenta de Google (<strong>{user?.email}</strong>). La contraseña y las credenciales de acceso se gestionan de forma segura a través de los ajustes de tu cuenta Google.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Change Password Form */}
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1 flex items-center gap-1.5">
                      <KeyRound size={14} className="text-primary" />
                      <span>Cambiar Contraseña Directamente</span>
                    </h4>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Nueva Contraseña</label>
                        <input 
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          minLength={6}
                          required
                          className="w-full px-4 py-3 bg-surface-container-low border-none rounded-2xl text-on-surface text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Confirmar Nueva Contraseña</label>
                        <input 
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repite la contraseña"
                          minLength={6}
                          required
                          className="w-full px-4 py-3 bg-surface-container-low border-none rounded-2xl text-on-surface text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={secSaving}
                      className="w-full py-3.5 bg-primary text-white font-extrabold rounded-2xl shadow-md shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {secSaving ? <Loader2 className="animate-spin" size={18} /> : 'Actualizar Contraseña'}
                    </button>
                  </form>

                  {/* Alternative: Send Password Reset Email */}
                  <div className="pt-4 border-t border-on-surface/5 space-y-2 text-center sm:text-left">
                    <span className="text-xs text-on-surface-variant font-medium block">
                      ¿Prefieres cambiar la clave desde tu correo?
                    </span>
                    <button
                      type="button"
                      onClick={handleSendResetEmailFromProfile}
                      disabled={secSaving || resetEmailSent}
                      className="text-xs font-extrabold text-primary hover:underline flex items-center gap-1.5 justify-center sm:justify-start"
                    >
                      <Mail size={14} />
                      <span>{resetEmailSent ? '¡Correo de recuperación enviado!' : `Enviar correo de cambio de clave a ${user?.email}`}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsSecurityOpen(false)}
                  className="w-full py-3.5 bg-surface-container-low text-on-surface font-bold rounded-2xl hover:bg-on-surface/5 transition-colors text-xs uppercase tracking-wider"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SettingsLink = ({ to, icon, title, subtitle, iconColor, isLast }: any) => (
  <Link 
    to={to} 
    className={cn(
      "w-full flex items-center justify-between p-4.5 hover:bg-on-surface/5 transition-colors group",
      !isLast && "border-b border-on-surface/5"
    )}
  >
    <div className="flex items-center gap-4">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", iconColor)}>
        {icon}
      </div>
      <div className="text-left">
        <span className="block font-bold text-on-surface leading-tight mb-0.5">{title}</span>
        <span className="text-xs text-on-surface-variant font-medium">{subtitle}</span>
      </div>
    </div>
    <ChevronRight size={18} className="text-on-surface-variant/30 group-hover:translate-x-1 transition-transform" />
  </Link>
);
