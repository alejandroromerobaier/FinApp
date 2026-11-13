import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User as UserIcon,
  LayoutGrid,
  Tag,
  CreditCard,
  LogOut,
  ChevronRight,
  Mail,
  BarChart3,
  Target,
  Globe,
  Zap,
  Edit3,
  Layers,
  ShieldCheck,
  KeyRound,
  Phone,
  Briefcase,
  FileText,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  Sun,
  Moon,
  Monitor,
  Search,
  Eye,
  EyeOff,
  FolderKanban,
  Copy,
  Check,
  Sparkles,
  Share2
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from '../lib/AuthContext';
import { useData } from '../lib/DataContext';
import { useTheme } from '../lib/ThemeContext';
import { useToast } from '../context/ToastContext';
import { updateUserProfile } from '../services/firestoreService';
import { updatePassword, updateProfile as updateFirebaseProfile, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getAppVersionInfo } from '../lib/version';
import { getLocalMonth } from '../lib/dateUtils';
import { haptic } from '../lib/haptics';
import { CustomSelect } from '../components/CustomSelect';

const CURRENCIES = [
  { code: 'ARS', label: 'ARS (Pesos Argentinos)', symbol: '$' },
  { code: 'USD', label: 'USD (Dólares)', symbol: 'U$D' },
  { code: 'EUR', label: 'EUR (Euros)', symbol: '€' },
  { code: 'BRL', label: 'BRL (Reales)', symbol: 'R$' },
  { code: 'CLP', label: 'CLP (Pesos Chilenos)', symbol: 'CP$' },
  { code: 'UYU', label: 'UYU (Pesos Uruguayos)', symbol: '$U' },
];

const AVATAR_PRESETS = [
  { id: 'bot1', name: 'FinBot 3D', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=FinBot3D&backgroundColor=b6e3f4,c0aede,d1d4f9' },
  { id: 'shape1', name: 'Esferas Esmeralda', url: 'https://api.dicebear.com/7.x/shapes/svg?seed=EmeraldGlass&backgroundColor=059669,10b981,34d399' },
  { id: 'icon1', name: 'Crecimiento 3D', url: 'https://api.dicebear.com/7.x/icons/svg?seed=Finance3D&backgroundColor=2563eb,3b82f6' },
  { id: 'ident1', name: 'Matriz Cripto', url: 'https://api.dicebear.com/7.x/identicon/svg?seed=CryptoMatrix&backgroundColor=7c3aed,8b5cf6' },
  { id: 'bot2', name: 'Robot Dorado', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=GoldBot&backgroundColor=f59e0b,fbbf24' },
  { id: 'shape2', name: 'Geometría Neón', url: 'https://api.dicebear.com/7.x/shapes/svg?seed=NeonGrid&backgroundColor=0284c7,38bdf8' },
  { id: 'icon2', name: 'Bóveda de Seguridad', url: 'https://api.dicebear.com/7.x/icons/svg?seed=VaultShield&backgroundColor=0f172a,1e293b' },
  { id: 'bot3', name: 'Cyber Investor', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=CyberInvestor&backgroundColor=ec4899,f472b6' },
  { id: 'shape3', name: 'Formas Violeta', url: 'https://api.dicebear.com/7.x/shapes/svg?seed=RoyalGlass&backgroundColor=6d28d9,7c3aed' },
  { id: 'icon3', name: 'Cohete 3D', url: 'https://api.dicebear.com/7.x/icons/svg?seed=RocketGoal&backgroundColor=ea580c,f97316' },
  { id: 'ident2', name: 'Red Teal', url: 'https://api.dicebear.com/7.x/identicon/svg?seed=TealMatrix&backgroundColor=14b8a6,2dd4bf' },
  { id: 'bot4', name: 'Quantum AI', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=QuantumBot&backgroundColor=6366f1,818cf8' },
];

/** Computes remaining days from today until a recurring day of month (closing or due day). */
const getDaysUntilDayOfMonth = (targetDay: number): number => {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let candidate = new Date(now.getFullYear(), now.getMonth(), targetDay);
  if (candidate < todayMidnight) {
    candidate = new Date(now.getFullYear(), now.getMonth() + 1, targetDay);
  }
  return Math.round((candidate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
};

export const Settings: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const { cards, projects, categories, budgets, shortcuts, transactions, showBalances, toggleShowBalances } = useData();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();
  const versionInfo = getAppVersionInfo();

  const [searchQuery, setSearchQuery] = useState('');
  const [copiedVersion, setCopiedVersion] = useState(false);

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

  // Sign out confirmation modal state
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const isGoogleUser = user?.providerData.some(p => p.providerId === 'google.com');
  const activeCurrency = profile?.currency || 'ARS';

  const activeProjects = useMemo(
    () => projects.filter(p => p.status !== 'inactive'),
    [projects]
  );

  // Live financial insights for the Bento Grid
  const liveInsights = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentMonthKey = getLocalMonth(now);

    // 1. Cards next due/closing indicator
    let cardHealth = 'Sin tarjetas cargadas';
    if (cards.length > 0) {
      let nearestCardName = cards[0].name;
      let nearestDays = 99;
      let nearestLabel = 'vence';

      cards.forEach(c => {
        if (c.dueDay) {
          const daysToDue = getDaysUntilDayOfMonth(c.dueDay);
          if (daysToDue < nearestDays) {
            nearestDays = daysToDue;
            nearestCardName = c.name;
            nearestLabel = 'vence';
          }
        }
        if (c.closingDay) {
          const daysToClose = getDaysUntilDayOfMonth(c.closingDay);
          if (daysToClose < nearestDays) {
            nearestDays = daysToClose;
            nearestCardName = c.name;
            nearestLabel = 'cierra';
          }
        }
      });

      if (nearestDays === 0) cardHealth = `${nearestCardName} ${nearestLabel} hoy`;
      else if (nearestDays === 1) cardHealth = `${nearestCardName} ${nearestLabel} mañana`;
      else cardHealth = `${nearestCardName} ${nearestLabel} en ${nearestDays} d`;
    }

    // 2. Current month installment commitments
    const monthInstallments = transactions.filter(t => {
      if (t.type === 'income') return false;
      const isInst = Boolean(t.isInstallment || t.parentPlanId || t.installmentPlanId || (t.totalInstallments && t.totalInstallments > 1));
      if (!isInst) return false;
      const d = t.date instanceof Date ? t.date : new Date(t.date);
      return !isNaN(d.getTime()) && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const monthInstallmentsTotal = monthInstallments.reduce((acc, t) => acc + (t.amount || 0), 0);

    // 3. Monthly budgets status
    const activeBudgets = budgets.filter(b => (!b.month || b.month === currentMonthKey) && b.amount > 0);
    let warningBudgets = 0;
    let exceededBudgets = 0;
    activeBudgets.forEach(b => {
      const spent = transactions
        .filter(t => {
          if (t.type !== 'expense' || t.categoryId !== b.categoryId) return false;
          const d = t.date instanceof Date ? t.date : new Date(t.date);
          if (isNaN(d.getTime()) || d.getMonth() !== currentMonth || d.getFullYear() !== currentYear) return false;
          const isPersonalBudget = !b.projectId || b.projectId === 'personal' || b.projectId === null;
          return isPersonalBudget
            ? (!t.projectId || t.projectId === 'personal')
            : t.projectId === b.projectId;
        })
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const pct = (spent / b.amount) * 100;
      if (pct >= 100) exceededBudgets++;
      else if (pct >= 80) warningBudgets++;
    });

    let budgetHealth = 'Configurá límites mensuales';
    let budgetAlert = false;
    if (activeBudgets.length > 0) {
      if (exceededBudgets > 0) {
        budgetHealth = `${exceededBudgets} límite${exceededBudgets > 1 ? 's' : ''} superado${exceededBudgets > 1 ? 's' : ''}`;
        budgetAlert = true;
      } else if (warningBudgets > 0) {
        budgetHealth = `${warningBudgets} cerca del 80%`;
        budgetAlert = true;
      } else {
        budgetHealth = 'Todos bajo control';
      }
    }

    // 4. Current month transaction count for reports
    const monthTxCount = transactions.filter(t => {
      const d = t.date instanceof Date ? t.date : new Date(t.date);
      return !isNaN(d.getTime()) && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    return {
      cardHealth,
      monthInstallmentsCount: monthInstallments.length,
      monthInstallmentsTotal,
      activeBudgetsCount: activeBudgets.length,
      budgetHealth,
      budgetAlert,
      monthTxCount
    };
  }, [cards, transactions, budgets]);

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
    haptic.selection();
    setTheme(newTheme);
    if (user) {
      await updateUserProfile(user.uid, { themePreference: newTheme }).catch(() => {});
    }
    const labels = { light: 'Modo Claro', dark: 'Modo Oscuro', system: 'Tema Automático' };
    toast.success(`${labels[newTheme]} activado`);
  };

  const handleCurrencyChange = async (newCurrency: string) => {
    if (!user) return;
    haptic.selection();
    try {
      await updateUserProfile(user.uid, { currency: newCurrency });
      toast.success(`Moneda base actualizada a ${newCurrency}`);
    } catch {
      toast.error('No se pudo actualizar la moneda base');
    }
  };

  const handleDefaultProjectChange = async (defaultProjectId: string) => {
    if (!user) return;
    haptic.selection();
    try {
      await updateUserProfile(user.uid, { defaultProjectId });
      const projectName = defaultProjectId === 'personal'
        ? 'Gastos Personales'
        : activeProjects.find(p => p.id === defaultProjectId)?.name || 'Proyecto';
      toast.success(`Bóveda predeterminada: ${projectName}`);
    } catch {
      toast.error('No se pudo actualizar la bóveda predeterminada');
    }
  };

  const handleToggleBalances = () => {
    haptic.selection();
    toggleShowBalances();
    toast.info(showBalances ? 'Saldos ocultos por privacidad' : 'Saldos visibles nuevamente');
  };

  const handleShareWhatsApp = async () => {
    haptic.selection();
    const shareUrl = `${window.location.origin}/bienvenida`;
    const message = 
`👋 ¡Hola! Te comparto *FinApp* para llevar las cuentas y gastos juntos en tiempo real:

📲 *Ingresá acá:* ${shareUrl}

💡 *Para tenerla en la pantalla de inicio:*
Abrí el link en Safari o Chrome y tocá *"Agregar a pantalla de inicio"*. Se instala como app nativa al instante sin descargar nada del Store.`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'FinApp - Bóvedas Compartidas',
          text: message,
          url: shareUrl,
        });
        toast.success('¡Enlace de invitación compartido!');
      } catch {
        // Fallback to clipboard if user cancels or errors
        copyInviteFallback(message);
      }
    } else {
      copyInviteFallback(message);
    }
  };

  const copyInviteFallback = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('¡Mensaje copiado para enviar por WhatsApp! 📲');
    } catch {
      toast.info(`Copiá este enlace: ${window.location.origin}/bienvenida`);
    }
  };

  const handleCopyVersion = async () => {
    const text = `FinApp v${versionInfo.version} (${versionInfo.env}) • Build #${versionInfo.commit} • ${versionInfo.formattedDate}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedVersion(true);
      haptic.light();
      toast.success('Información de versión copiada');
      setTimeout(() => setCopiedVersion(false), 2000);
    } catch {
      toast.info(text);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/login');
    } finally {
      setSigningOut(false);
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
      await updateFirebaseProfile(user, {
        displayName: editName.trim(),
        photoURL: editPhotoURL.trim()
      });

      await updateUserProfile(user.uid, {
        name: editName.trim(),
        photoURL: editPhotoURL.trim(),
        phone: editPhone.trim(),
        bio: editBio.trim(),
        occupation: editOccupation.trim()
      });

      setProfileSuccess('¡Perfil actualizado con éxito!');
      toast.success('Perfil actualizado');
      setTimeout(() => {
        setIsEditProfileOpen(false);
      }, 900);
    } catch (err) {
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
      toast.success('Contraseña actualizada');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsSecurityOpen(false);
      }, 1200);
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
    } catch (err) {
      console.error('Reset email error:', err);
      setSecError('Error al enviar el correo de restablecimiento.');
    } finally {
      setSecSaving(false);
    }
  };

  const openSecurityModal = () => {
    setSecError(null);
    setSecSuccess(null);
    setNewPassword('');
    setConfirmPassword('');
    setResetEmailSent(false);
    setIsSecurityOpen(true);
  };

  const userInitials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || '??';

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchesQuery = (...keywords: string[]) =>
    !normalizedQuery || keywords.some(k => k.toLowerCase().includes(normalizedQuery));

  const financeCards = [
    {
      to: '/cards',
      icon: <CreditCard size={19} />,
      title: 'Tarjetas de Crédito',
      badge: cards.length > 0 ? `${cards.length} activa${cards.length > 1 ? 's' : ''}` : 'Sin cargar',
      health: liveInsights.cardHealth,
      healthTone: 'text-blue-600 dark:text-blue-400',
      iconColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      keywords: ['tarjetas', 'credito', 'plásticos', 'cierres', 'vencimientos', 'cards']
    },
    {
      to: '/credit-cards',
      icon: <Layers size={19} />,
      title: 'Compromisos & Cuotas',
      badge: liveInsights.monthInstallmentsCount > 0 ? `${liveInsights.monthInstallmentsCount} este mes` : 'Al día',
      health: liveInsights.monthInstallmentsCount > 0
        ? (showBalances ? `${formatCurrency(liveInsights.monthInstallmentsTotal, activeCurrency)} este mes` : '•••• este mes')
        : 'Sin cuotas este mes',
      healthTone: 'text-indigo-600 dark:text-indigo-400',
      iconColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
      keywords: ['cuotas', 'compromisos', 'planes', 'cronograma', 'financiación', '12 meses']
    },
    {
      to: '/budgets',
      icon: <Target size={19} />,
      title: 'Presupuestos',
      badge: liveInsights.activeBudgetsCount > 0 ? `${liveInsights.activeBudgetsCount} límite${liveInsights.activeBudgetsCount > 1 ? 's' : ''}` : 'Sin límites',
      health: liveInsights.budgetHealth,
      healthTone: liveInsights.budgetAlert ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400',
      iconColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      keywords: ['presupuestos', 'límites', 'topes', 'mensual', 'alertas']
    },
    {
      to: '/reports',
      icon: <BarChart3 size={19} />,
      title: 'Reportes & PDF',
      badge: 'PDF / CSV',
      health: `${liveInsights.monthTxCount} movimiento${liveInsights.monthTxCount === 1 ? '' : 's'} en el mes`,
      healthTone: 'text-emerald-600 dark:text-emerald-400',
      iconColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      keywords: ['reportes', 'exportar', 'pdf', 'csv', 'consultas', 'resumen']
    }
  ].filter(item => matchesQuery(item.title, item.badge, item.health, ...item.keywords));

  const spaceLinks = [
    {
      to: '/shared',
      icon: <LayoutGrid size={19} />,
      title: 'Proyectos & Bóvedas',
      subtitle: 'Espacios compartidos y visibilidad en Home',
      countBadge: `${activeProjects.length} activo${activeProjects.length === 1 ? '' : 's'}`,
      iconColor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
      keywords: ['proyectos', 'bovedas', 'compartidos', 'hogar', 'viajes']
    },
    {
      to: '/categories',
      icon: <Tag size={19} />,
      title: 'Gestión de Categorías',
      subtitle: 'Categorías personalizadas, íconos y colores',
      countBadge: `${categories.length}`,
      iconColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      keywords: ['categorías', 'etiquetas', 'colores', 'rubros']
    },
    {
      to: '/shortcuts',
      icon: <Zap size={19} />,
      title: 'Atajos de Gastos',
      subtitle: 'Accesos rápidos configurables en 1 toque',
      countBadge: `${shortcuts.length} atajo${shortcuts.length === 1 ? '' : 's'}`,
      iconColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      keywords: ['atajos', 'rápidos', 'shortcuts', 'gasto rápido']
    }
  ].filter(item => matchesQuery(item.title, item.subtitle, ...item.keywords));

  const showProfileSection = matchesQuery('perfil', 'usuario', 'nombre', 'avatar', 'cuenta', 'editar', user?.displayName || '', user?.email || '');
  const showThemePref = matchesQuery('tema', 'apariencia', 'claro', 'oscuro', 'dark', 'light', 'sistema');
  const showCurrencyPref = matchesQuery('moneda', 'divisa', 'ars', 'usd', 'eur', activeCurrency);
  const showDefaultProjectPref = matchesQuery('bóveda', 'proyecto predeterminado', 'nuevo gasto', 'defecto');
  const showPrivacyPref = matchesQuery('privacidad', 'saldos', 'ocultar', 'mostrar');
  const showAnyPreferences = showThemePref || showCurrencyPref || showDefaultProjectPref || showPrivacyPref;
  const showSecuritySection = matchesQuery('seguridad', 'clave', 'contraseña', 'password', 'google', 'sesión', 'cerrar');
  const hasAnyResults = showProfileSection || financeCards.length > 0 || spaceLinks.length > 0 || showAnyPreferences || showSecuritySection;

  // Reusable section blocks (shared cleanly between Mobile single-column and Desktop 2-column grid)
  const profileSection = showProfileSection && (
    <section className="space-y-3">
      <div className="bg-gradient-to-br from-primary/10 via-surface-container-lowest to-emerald-500/10 rounded-3xl p-5 sm:p-6 shadow-sm border border-on-surface/10 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-500 flex items-center justify-center text-white overflow-hidden shadow-md border-2 border-white/80 dark:border-white/20 shrink-0">
              {user?.photoURL || profile?.photoURL ? (
                <img
                  src={user?.photoURL || profile?.photoURL}
                  alt={user?.displayName || 'Usuario'}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-xl font-black font-headline tracking-widest">{userInitials}</span>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-on-surface font-headline leading-tight truncate">
                  {user?.displayName || profile?.name || 'Usuario FinApp'}
                </h2>
                {isGoogleUser ? (
                  <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-blue-500/20">
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-3 h-3" alt="Google" />
                    Google
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-500/20">
                    <Lock size={10} />
                    Clave
                  </span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-1 font-medium truncate">
                <Mail size={13} className="text-primary shrink-0" />
                <span className="truncate">{user?.email}</span>
              </p>
              {(profile?.occupation || profile?.phone) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-on-surface-variant/80">
                  {profile?.occupation && (
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Briefcase size={12} className="text-primary/80" />
                      {profile.occupation}
                    </span>
                  )}
                  {profile?.phone && (
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Phone size={12} className="text-emerald-600 dark:text-emerald-400" />
                      {profile.phone}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={openEditProfile}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-lowest/90 hover:bg-surface-container-lowest text-on-surface border border-on-surface/10 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
            title="Editar información personal"
          >
            <Edit3 size={14} className="text-primary" />
            <span>Editar</span>
          </button>
        </div>

        {profile?.bio && (
          <p className="text-xs text-on-surface-variant flex items-start gap-1.5 leading-relaxed pt-2 border-t border-on-surface/5">
            <FileText size={13} className="text-on-surface-variant/60 shrink-0 mt-0.5" />
            <span>{profile.bio}</span>
          </p>
        )}

        {/* Account Status Mini-KPIs */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-on-surface/10">
          <div className="rounded-2xl bg-surface-container-lowest/80 dark:bg-surface-container-low/80 px-3 py-2.5 border border-on-surface/5">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Moneda</span>
            <span className="block text-sm font-black text-on-surface mt-0.5">{activeCurrency}</span>
          </div>
          <Link
            to="/shared"
            className="rounded-2xl bg-surface-container-lowest/80 dark:bg-surface-container-low/80 px-3 py-2.5 border border-on-surface/5 hover:border-primary/30 transition-colors"
          >
            <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Bóvedas</span>
            <span className="block text-sm font-black text-on-surface mt-0.5">{activeProjects.length + 1} activas</span>
          </Link>
          <button
            type="button"
            onClick={openSecurityModal}
            className="text-left rounded-2xl bg-surface-container-lowest/80 dark:bg-surface-container-low/80 px-3 py-2.5 border border-on-surface/5 hover:border-emerald-500/30 transition-colors cursor-pointer"
          >
            <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Seguridad</span>
            <span className="block text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
              {isGoogleUser ? 'Google 2FA' : 'Activa'}
            </span>
          </button>
        </div>
      </div>
    </section>
  );

  const financeSection = financeCards.length > 0 && (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Finanzas & Medios</h2>
        <span className="text-[11px] font-semibold text-on-surface-variant/70">Indicadores en vivo</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {financeCards.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="bg-surface-container-lowest rounded-3xl p-4 sm:p-5 border border-on-surface/5 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group flex flex-col justify-between gap-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", card.iconColor)}>
                {card.icon}
              </div>
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-surface-container-low text-on-surface border border-on-surface/5">
                {card.badge}
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm sm:text-base text-on-surface leading-tight">{card.title}</span>
                <ChevronRight size={17} className="text-on-surface-variant/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
              <p className={cn("text-xs font-semibold mt-1 truncate", card.healthTone)}>
                {card.health}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );

  const spaceSection = spaceLinks.length > 0 && (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">Mi Espacio & Reglas</h2>
      <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-on-surface/5">
        {spaceLinks.map((item, idx) => (
          <SettingsLink
            key={item.to}
            to={item.to}
            icon={item.icon}
            title={item.title}
            subtitle={item.subtitle}
            countBadge={item.countBadge}
            iconColor={item.iconColor}
            isLast={idx === spaceLinks.length - 1}
          />
        ))}
      </div>
    </section>
  );

  const preferencesSection = showAnyPreferences && (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">Preferencias Operativas</h2>
      <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-on-surface/5 divide-y divide-on-surface/5">
        {/* Segmented Theme Control */}
        {showThemePref && (
          <div className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  {theme === 'dark' ? <Moon size={18} /> : theme === 'light' ? <Sun size={18} /> : <Monitor size={18} />}
                </div>
                <div>
                  <span className="block font-bold text-sm text-on-surface leading-tight">Apariencia</span>
                  <span className="text-xs text-on-surface-variant">
                    {theme === 'system' ? 'Automático según dispositivo' : theme === 'dark' ? 'Modo Oscuro activo' : 'Modo Claro activo'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1 p-1 bg-surface-container-low rounded-2xl border border-on-surface/5">
              {[
                { id: 'light' as const, label: 'Claro', icon: <Sun size={15} /> },
                { id: 'dark' as const, label: 'Oscuro', icon: <Moon size={15} /> },
                { id: 'system' as const, label: 'Sistema', icon: <Monitor size={15} /> },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleThemeChange(opt.id)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer",
                    theme === opt.id
                      ? "bg-primary text-white shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  )}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Base Currency */}
        {showCurrencyPref && (
          <div className="flex items-center justify-between gap-3 p-4 sm:p-4.5">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <Globe size={18} />
              </div>
              <div className="min-w-0">
                <span className="block font-bold text-sm text-on-surface leading-tight">Moneda Base</span>
                <span className="text-xs text-on-surface-variant">Registros personales</span>
              </div>
            </div>
            <div className="w-40 shrink-0">
              <CustomSelect
                ariaLabel="Moneda Base"
                value={activeCurrency}
                onChange={(val) => handleCurrencyChange(val as string)}
                options={CURRENCIES.map(curr => ({
                  value: curr.code,
                  label: `${curr.code} (${curr.symbol})`
                }))}
                size="sm"
                align="right"
              />
            </div>
          </div>
        )}

        {/* Default Project for + Expense */}
        {showDefaultProjectPref && (
          <div className="flex items-center justify-between gap-3 p-4 sm:p-4.5">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <FolderKanban size={18} />
              </div>
              <div className="min-w-0">
                <span className="block font-bold text-sm text-on-surface leading-tight">Bóveda al cargar gasto</span>
                <span className="text-xs text-on-surface-variant">Selección inicial en + Gasto</span>
              </div>
            </div>
            <div className="w-44 shrink-0">
              <CustomSelect
                ariaLabel="Bóveda predeterminada"
                value={profile?.defaultProjectId || 'personal'}
                onChange={(val) => handleDefaultProjectChange(val as string)}
                options={[
                  { value: 'personal', label: 'Gastos Personales' },
                  ...activeProjects.map(proj => ({
                    value: proj.id,
                    label: proj.name
                  }))
                ]}
                size="sm"
                align="right"
              />
            </div>
          </div>
        )}

        {/* Balance Privacy Toggle */}
        {showPrivacyPref && (
          <button
            type="button"
            onClick={handleToggleBalances}
            className="w-full flex items-center justify-between gap-3 p-4 sm:p-4.5 hover:bg-on-surface/[0.03] transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                {showBalances ? <Eye size={18} /> : <EyeOff size={18} />}
              </div>
              <div className="min-w-0">
                <span className="block font-bold text-sm text-on-surface leading-tight">Mostrar saldos y montos</span>
                <span className="text-xs text-on-surface-variant">
                  {showBalances ? 'Importes visibles en Home y tarjetas' : 'Modo discreto activado (••••)'}
                </span>
              </div>
            </div>
            <div
              className={cn(
                "w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 flex items-center",
                showBalances ? "bg-primary justify-end" : "bg-on-surface/20 justify-start"
              )}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-xs block" />
            </div>
          </button>
        )}
      </div>
    </section>
  );

  const systemSection = showSecuritySection && (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">Seguridad & Sesión</h2>

      <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-on-surface/5 divide-y divide-on-surface/5">
        <button
          type="button"
          onClick={openSecurityModal}
          className="w-full flex items-center justify-between p-4 sm:p-4.5 hover:bg-on-surface/[0.03] transition-colors cursor-pointer group text-left"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div>
              <span className="block font-bold text-sm text-on-surface leading-tight">Seguridad & Clave</span>
              <span className="text-xs text-on-surface-variant font-medium">
                {isGoogleUser ? 'Protegida con cuenta Google' : 'Cambiar contraseña o recuperar acceso'}
              </span>
            </div>
          </div>
          <ChevronRight size={17} className="text-on-surface-variant/40 group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => setIsSignOutConfirmOpen(true)}
          className="w-full flex items-center justify-between p-4 sm:p-4.5 hover:bg-rose-500/[0.05] transition-colors cursor-pointer group text-left"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <LogOut size={18} />
            </div>
            <div>
              <span className="block font-bold text-sm text-rose-600 dark:text-rose-400 leading-tight">Cerrar Sesión</span>
              <span className="text-xs text-on-surface-variant font-medium">Desconectar este dispositivo</span>
            </div>
          </div>
          <ChevronRight size={17} className="text-rose-500/40 group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>
      </div>

      {/* Direct WhatsApp Share / Invite Button */}
      <div className="bg-surface-container-lowest rounded-3xl p-4 sm:p-5 border border-on-surface/5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Share2 size={20} />
          </div>
          <div>
            <span className="block font-bold text-sm text-on-surface leading-tight font-headline">
              Invitar amigos o pareja
            </span>
            <span className="text-xs text-on-surface-variant">
              Copia el mensaje con el link de bienvenida y guía PWA
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleShareWhatsApp}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer shrink-0"
        >
          <Share2 size={14} />
          <span>Enviar por WhatsApp</span>
        </button>
      </div>

      {/* Dynamic Version Info Card */}
      <button
        type="button"
        onClick={handleCopyVersion}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-surface-container-low/70 hover:bg-surface-container-low border border-on-surface/5 rounded-2xl transition-colors cursor-pointer text-left"
        title="Copiar información de versión"
      >
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-tight text-on-surface">
              FinApp v{versionInfo.version}
            </span>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
              versionInfo.isQA
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                : versionInfo.isDev
                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            )}>
              {versionInfo.env}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-on-surface-variant/70">
            <span>Build <code className="font-mono text-on-surface-variant font-semibold">#{versionInfo.commit}</code></span>
            <span>•</span>
            <span>Deploy {versionInfo.formattedDate}</span>
          </div>
        </div>
        <div className="p-2 rounded-xl text-on-surface-variant/60 hover:text-on-surface">
          {copiedVersion ? <Check size={16} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={16} />}
        </div>
      </button>
    </section>
  );

  return (
    <div className="px-4 sm:px-6 max-w-5xl mx-auto py-6 sm:py-8 space-y-6 pb-28">
      {/* Top Header + Search Bar */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-on-surface/5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-on-surface font-headline">
              Ajustes & Cuenta
            </h1>
            {(versionInfo.isQA || versionInfo.isDev) && (
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                versionInfo.isQA
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
              )}>
                {versionInfo.env}
              </span>
            )}
          </div>
          <p className="text-on-surface-variant mt-1 text-sm">
            Centro de control de tus módulos financieros, preferencias y seguridad.
          </p>
        </div>

        {/* Instant Settings Filter */}
        <div className="relative w-full sm:w-72 shrink-0">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar tarjetas, moneda, clave..."
            className="w-full pl-10 pr-9 py-2.5 bg-surface-container-lowest border border-on-surface/10 rounded-2xl text-xs font-medium text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5 cursor-pointer"
              aria-label="Limpiar búsqueda"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </header>

      {!hasAnyResults ? (
        <div className="bg-surface-container-lowest rounded-3xl p-10 text-center border border-on-surface/5 space-y-3">
          <p className="text-sm font-bold text-on-surface">No encontramos ajustes para "{searchQuery}"</p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="px-4 py-2 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors cursor-pointer"
          >
            Mostrar todos los ajustes
          </button>
        </div>
      ) : (
        <>
          {/* Mobile Layout (< lg): natural vertical priority */}
          <div className="space-y-6 lg:hidden">
            {profileSection}
            {financeSection}
            {spaceSection}
            {preferencesSection}
            {systemSection}
          </div>

          {/* Desktop Layout (>= lg): balanced 2-column fintech command view */}
          <div className="hidden lg:grid lg:grid-cols-12 gap-6 items-start">
            <div className="col-span-5 space-y-6">
              {profileSection}
              {preferencesSection}
              {systemSection}
            </div>
            <div className="col-span-7 space-y-6">
              {financeSection}
              {spaceSection}
            </div>
          </div>
        </>
      )}

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
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-on-surface/5 text-on-surface-variant transition-colors cursor-pointer"
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
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-2xl flex items-center gap-2 text-xs font-bold">
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

                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Avatar Vectorial 3D
                    </label>
                    <span className="text-[10px] text-on-surface-variant/60 font-semibold">12 diseños modernos</span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                    {AVATAR_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setEditPhotoURL(preset.url)}
                        title={preset.name}
                        className={cn(
                          "w-12 h-12 rounded-2xl overflow-hidden border-2 transition-all p-1 flex items-center justify-center bg-surface-container-low group cursor-pointer",
                          editPhotoURL === preset.url
                            ? "border-primary scale-105 shadow-lg shadow-primary/20 ring-2 ring-primary/30"
                            : "border-on-surface/5 hover:border-primary/40 hover:scale-105"
                        )}
                      >
                        <img
                          src={preset.url}
                          alt={preset.name}
                          className="w-full h-full object-contain rounded-xl transition-transform group-hover:scale-110"
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-on-surface/5">
                  <button
                    type="button"
                    onClick={() => setIsEditProfileOpen(false)}
                    className="flex-1 py-3.5 bg-surface-container-low text-on-surface font-bold rounded-2xl hover:bg-on-surface/5 transition-colors text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="flex-1 py-3.5 bg-primary text-white font-extrabold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-70 cursor-pointer"
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
                type="button"
                onClick={() => setIsSecurityOpen(false)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-on-surface/5 text-on-surface-variant transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-headline text-on-surface">Seguridad de la Cuenta</h3>
                  <p className="text-xs text-on-surface-variant">Gestión de contraseña y autenticación.</p>
                </div>
              </div>

              {secSuccess && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-2xl flex items-center gap-2 text-xs font-bold">
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
                <div className="p-5 bg-blue-500/10 border border-blue-500/20 text-on-surface rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 font-bold text-sm text-blue-600 dark:text-blue-400">
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                    <span>Autenticación administrada por Google</span>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Iniciaste sesión con tu cuenta de Google (<strong className="text-on-surface">{user?.email}</strong>). La contraseña y las credenciales de acceso se gestionan de forma segura a través de los ajustes de tu cuenta Google.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
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
                      className="w-full py-3.5 bg-primary text-white font-extrabold rounded-2xl shadow-md shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
                    >
                      {secSaving ? <Loader2 className="animate-spin" size={18} /> : 'Actualizar Contraseña'}
                    </button>
                  </form>

                  <div className="pt-4 border-t border-on-surface/5 space-y-2 text-center sm:text-left">
                    <span className="text-xs text-on-surface-variant font-medium block">
                      ¿Prefieres cambiar la clave desde tu correo?
                    </span>
                    <button
                      type="button"
                      onClick={handleSendResetEmailFromProfile}
                      disabled={secSaving || resetEmailSent}
                      className="text-xs font-extrabold text-primary hover:underline flex items-center gap-1.5 justify-center sm:justify-start cursor-pointer"
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
                  className="w-full py-3.5 bg-surface-container-low text-on-surface font-bold rounded-2xl hover:bg-on-surface/5 transition-colors text-xs uppercase tracking-wider cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- SIGN OUT CONFIRMATION MODAL --- */}
      <AnimatePresence>
        {isSignOutConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-surface-container-lowest w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-on-surface/10 space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
                <LogOut size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-on-surface">¿Cerrar sesión?</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Deberás iniciar sesión nuevamente para acceder a tus bóvedas y registros desde este dispositivo.
                </p>
              </div>
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSignOutConfirmOpen(false)}
                  disabled={signingOut}
                  className="flex-1 py-2.5 rounded-xl border border-on-surface/10 text-xs font-bold text-on-surface hover:bg-on-surface/5 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-600/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {signingOut ? <Loader2 size={14} className="animate-spin" /> : 'Sí, salir'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface SettingsLinkProps {
  to: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  countBadge?: string;
  iconColor: string;
  isLast?: boolean;
}

const SettingsLink: React.FC<SettingsLinkProps> = ({
  to,
  icon,
  title,
  subtitle,
  countBadge,
  iconColor,
  isLast
}) => (
  <Link
    to={to}
    className={cn(
      "w-full flex items-center justify-between gap-3 p-4 sm:p-4.5 hover:bg-on-surface/[0.03] transition-colors group",
      !isLast && "border-b border-on-surface/5"
    )}
  >
    <div className="flex items-center gap-3.5 min-w-0">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", iconColor)}>
        {icon}
      </div>
      <div className="text-left min-w-0">
        <span className="block font-bold text-sm text-on-surface leading-tight mb-0.5 truncate">{title}</span>
        <span className="block text-xs text-on-surface-variant font-medium truncate">{subtitle}</span>
      </div>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      {countBadge && (
        <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-surface-container-low text-on-surface-variant border border-on-surface/5">
          {countBadge}
        </span>
      )}
      <ChevronRight size={17} className="text-on-surface-variant/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
    </div>
  </Link>
);
