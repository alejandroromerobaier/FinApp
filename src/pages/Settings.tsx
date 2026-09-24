import React from 'react';
import { motion } from 'motion/react';
import { User as UserIcon, LayoutGrid, Tag, CreditCard, Calendar, LogOut, ChevronRight, Mail, BarChart3, Target, Globe } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/AuthContext';
import { updateUserProfile } from '../services/firestoreService';

const CURRENCIES = [
  { code: 'ARS', label: 'ARS (Pesos Argentinos)', symbol: '$' },
  { code: 'USD', label: 'USD (Dólares)', symbol: 'U$D' },
  { code: 'EUR', label: 'EUR (Euros)', symbol: '€' },
  { code: 'BRL', label: 'BRL (Reales)', symbol: 'R$' },
  { code: 'CLP', label: 'CLP (Pesos Chilenos)', symbol: 'CP$' },
  { code: 'UYU', label: 'UYU (Pesos Uruguayos)', symbol: '$U' },
];

export const Settings: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleCurrencyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (user) {
      await updateUserProfile(user.uid, { currency: e.target.value });
    }
  };

  const userInitials = user?.displayName 
    ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || '??';

  return (
    <div className="px-6 max-w-2xl mx-auto py-8 space-y-10">
      <section>
        <h1 className="text-3xl font-extrabold tracking-tight text-on-surface font-headline">Ajustes</h1>
        <p className="text-on-surface-variant mt-1">Configura tu experiencia y gestiona tu cuenta.</p>
      </section>

      {/* User Profile */}
      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">Perfil de Usuario</h2>
        <div className="bg-surface-container-lowest rounded-2xl p-5 flex items-center justify-between shadow-sm border border-on-surface/5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/5 flex items-center justify-center border border-primary/10">
              <span className="text-lg font-bold text-primary font-headline">{userInitials}</span>
            </div>
            <div>
              <h3 className="font-bold text-on-surface font-headline">{user?.displayName || 'Usuario'}</h3>
              <p className="text-sm text-on-surface-variant flex items-center gap-1">
                <Mail size={12} />
                {user?.email}
              </p>
            </div>
          </div>
          <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
            Cuenta Activa
          </div>
        </div>
      </section>

      {/* Management Section */}
      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">Gestión</h2>
        <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-on-surface/5">
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
            subtitle="ABM y códigos de color" 
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
            to="/reports" 
            icon={<BarChart3 size={20} />} 
            title="Reportes y Exportación" 
            subtitle="Email, CSV y copias" 
            iconColor="bg-indigo-50 text-indigo-700"
            isLast
          />
        </div>
      </section>

      {/* Preferences */}
      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">Preferencias</h2>
        <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-on-surface/5">
          <div className="flex items-center justify-between p-4 border-b border-on-surface/5 group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant group-hover:text-primary transition-colors">
                <Globe size={20} />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-on-surface leading-none mb-1">Moneda Base</span>
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-black">Registros Personales</span>
              </div>
            </div>
            <select 
              value={profile?.currency || 'ARS'}
              onChange={handleCurrencyChange}
              className="bg-primary/5 text-primary text-xs font-black py-2 px-4 rounded-xl border-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
            >
              {CURRENCIES.map(curr => (
                <option key={curr.code} value={curr.code}>{curr.code} ({curr.symbol})</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between p-4 border-b border-on-surface/5 group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant group-hover:text-amber-600 transition-colors">
                <CreditCard size={20} />
              </div>
              <span className="font-semibold text-on-surface">Método Predeterminado</span>
            </div>
            <span className="text-sm font-medium text-amber-700 bg-amber-50 px-3 py-1 rounded-lg">Efectivo</span>
          </div>
          <div className="flex items-center justify-between p-4 group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant group-hover:text-primary transition-colors">
                <Calendar size={20} />
              </div>
              <span className="font-semibold text-on-surface">Periodo de Análisis</span>
            </div>
            <span className="text-sm font-medium text-primary bg-primary/5 px-3 py-1 rounded-lg">Mensual</span>
          </div>
        </div>
      </section>

      {/* System */}
      <section className="pt-4">
        <button 
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 p-4 bg-error/5 text-error rounded-2xl font-bold hover:bg-error/10 transition-all active:scale-[0.98]"
        >
          <LogOut size={18} />
          Cerrar Sesión
        </button>
        <p className="text-center text-[10px] text-on-surface-variant/40 mt-6 uppercase tracking-widest font-bold">FinShare v2.5.0 • 2026</p>
      </section>
    </div>
  );
};

const SettingsLink = ({ to, icon, title, subtitle, iconColor, isLast }: any) => (
  <Link 
    to={to} 
    className={cn(
      "w-full flex items-center justify-between p-4 hover:bg-on-surface/5 transition-colors group",
      !isLast && "border-b border-on-surface/5"
    )}
  >
    <div className="flex items-center gap-4">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", iconColor)}>
        {icon}
      </div>
      <div className="text-left">
        <span className="block font-semibold text-on-surface">{title}</span>
        <span className="text-xs text-on-surface-variant">{subtitle}</span>
      </div>
    </div>
    <ChevronRight size={18} className="text-on-surface-variant/30 group-hover:translate-x-1 transition-transform" />
  </Link>
);
