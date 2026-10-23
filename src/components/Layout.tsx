import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, 
  BarChart3, 
  PlusCircle, 
  Settings, 
  Bell, 
  Check, 
  Trash2, 
  UserPlus,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import logo from '../assets/logo.png';
import { useData } from '../lib/DataContext';
import { useNavigate } from 'react-router-dom';

import { VoiceExpenseModal } from './VoiceExpenseModal';
import { Sparkles, Mic } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { notifications, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications } = useData();
  const [showNotifs, setShowNotifs] = React.useState(false);
  const [filterNotifs, setFilterNotifs] = React.useState<'all' | 'unread'>('all');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = React.useState(false);
  
  const isAuthPage = location.pathname === '/login';
  const isAddPage = location.pathname === '/add';

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const displayedNotifs = notifications.filter(n => filterNotifs === 'all' || !n.isRead);

  if (isAuthPage) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      {!isAddPage && (
        <header className="fixed top-0 w-full z-50 glass-header pt-safe-top">
          <div className="flex items-center justify-between px-4 sm:px-6 h-14 sm:h-16">
            <div className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group" onClick={() => navigate('/')}>
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-surface-container-lowest flex items-center justify-center p-1 sm:p-1.5 shadow-md shadow-blue-500/10 border border-blue-500/15 overflow-hidden transition-all duration-300 group-hover:scale-105 group-active:scale-95 group-hover:shadow-lg group-hover:shadow-blue-500/20">
                <img 
                  src={logo} 
                  alt="FinApp Logo" 
                  className="w-full h-full object-contain transition-transform group-hover:scale-110 duration-300"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xl sm:text-2xl font-black tracking-tight font-headline bg-gradient-to-r from-blue-700 via-blue-600 to-emerald-600 bg-clip-text text-transparent leading-none">
                  FinApp
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 relative">
              <button
                onClick={() => setIsVoiceModalOpen(true)}
                className="p-2 sm:px-3 sm:py-2 text-primary bg-primary/10 hover:bg-primary/20 transition-all rounded-full flex items-center gap-1.5 border border-primary/20 shadow-sm active:scale-95"
                title="Dictar gasto por voz con IA"
              >
                <Sparkles size={16} className="text-primary" />
                <span className="text-[11px] font-black uppercase tracking-wider hidden sm:inline">Voz IA</span>
              </button>
              <button 
                onClick={() => setShowNotifs(!showNotifs)}
                className={cn(
                  "p-2.5 text-on-surface-variant hover:bg-on-surface/5 transition-all rounded-full relative group",
                  showNotifs && "bg-primary/10 text-primary"
                )}
              >
                <Bell size={20} className={cn("transition-transform", unreadCount > 0 && "animate-bounce")} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4.5 h-4.5 bg-primary text-[10px] font-black text-white rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              <AnimatePresence>
                {showNotifs && (
                  <>
                    <div className="fixed inset-0 z-[-1]" onClick={() => setShowNotifs(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full right-0 mt-2 w-84 sm:w-96 bg-surface-container-lowest rounded-3xl shadow-2xl border border-on-surface/10 overflow-hidden z-[60]"
                    >
                      {/* Dropdown Header */}
                      <div className="p-4 sm:p-5 border-b border-on-surface/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h3 className="font-headline font-black text-on-surface text-sm uppercase tracking-widest">Notificaciones</h3>
                            {unreadCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black">
                                {unreadCount} nueva{unreadCount > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                              <button 
                                onClick={() => markAllAsRead()}
                                className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline flex items-center gap-1 cursor-pointer"
                                title="Marcar todas como leídas"
                              >
                                <Check size={12} strokeWidth={3} />
                                <span>Leer todo</span>
                              </button>
                            )}
                            {notifications.length > 0 && (
                              <button 
                                onClick={() => {
                                  if (window.confirm('¿Deseas vaciar todo el historial de notificaciones?')) {
                                    clearAllNotifications();
                                  }
                                }}
                                className="text-[10px] font-black text-on-surface-variant/50 hover:text-rose-500 uppercase tracking-widest transition-colors flex items-center gap-1 cursor-pointer ml-1"
                                title="Vaciar historial de notificaciones"
                              >
                                <Trash2 size={12} />
                                <span>Vaciar</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex gap-1.5 p-1 bg-surface-container-low rounded-xl">
                          <button
                            type="button"
                            onClick={() => setFilterNotifs('all')}
                            className={cn(
                              "flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer",
                              filterNotifs === 'all'
                                ? "bg-surface-container-lowest text-on-surface shadow-sm"
                                : "text-on-surface-variant/60 hover:text-on-surface"
                            )}
                          >
                            Todas ({notifications.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setFilterNotifs('unread')}
                            className={cn(
                              "flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer",
                              filterNotifs === 'unread'
                                ? "bg-surface-container-lowest text-on-surface shadow-sm"
                                : "text-on-surface-variant/60 hover:text-on-surface"
                            )}
                          >
                            No leídas ({unreadCount})
                          </button>
                        </div>
                      </div>

                      {/* Notifications List */}
                      <div className="max-h-[60vh] overflow-y-auto custom-scrollbar divide-y divide-on-surface/[0.04]">
                        {displayedNotifs.length === 0 ? (
                          <div className="p-10 text-center flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-on-surface/5 flex items-center justify-center text-on-surface-variant/20">
                              <Bell size={24} />
                            </div>
                            <p className="text-xs font-bold text-on-surface-variant/50 uppercase tracking-widest">
                              {filterNotifs === 'unread' ? 'Sin notificaciones pendientes' : 'Sin notificaciones'}
                            </p>
                          </div>
                        ) : (
                          displayedNotifs.map((n) => (
                            <motion.div 
                              key={n.id}
                              className={cn(
                                "p-4 flex gap-3 transition-colors hover:bg-on-surface/[0.03] cursor-pointer group relative",
                                !n.isRead && "bg-primary/[0.04]"
                              )}
                              onClick={() => {
                                if (!n.isRead) markAsRead(n.id);
                                if (n.type === 'project_shared') navigate('/projects');
                                if (n.type === 'expense_added') navigate('/history');
                                if (n.type === 'budget_alert') navigate('/budgets');
                                setShowNotifs(false);
                              }}
                            >
                              <div className={cn(
                                "w-10 h-10 shrink-0 rounded-xl flex items-center justify-center",
                                n.type === 'project_shared' ? "bg-indigo-500/10 text-indigo-600" :
                                n.type === 'expense_added' ? "bg-emerald-500/10 text-emerald-600" :
                                n.type === 'budget_alert' ? (n.data?.threshold === 100 ? "bg-rose-500/10 text-rose-600" : "bg-amber-500/10 text-amber-600") :
                                "bg-on-surface/5 text-on-surface-variant"
                              )}>
                                {n.type === 'project_shared' ? <UserPlus size={18} /> :
                                 n.type === 'expense_added' ? <PlusCircle size={18} /> :
                                 n.type === 'budget_alert' ? <AlertTriangle size={18} /> :
                                 <Bell size={18} />}
                              </div>
                              <div className="flex-1 space-y-1 min-w-0 pr-6">
                                <div className="flex items-center gap-1.5">
                                  <span className={cn(
                                    "text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded",
                                    n.type === 'project_shared' ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400" :
                                    n.type === 'expense_added' ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" :
                                    n.type === 'budget_alert' ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" :
                                    "bg-on-surface/5 text-on-surface-variant"
                                  )}>
                                    {n.type === 'project_shared' ? 'Proyecto' :
                                     n.type === 'expense_added' ? 'Gasto' :
                                     n.type === 'budget_alert' ? 'Presupuesto' : 'Aviso'}
                                  </span>
                                  {!n.isRead && <span className="w-1.5 h-1.5 bg-primary rounded-full shrink-0" />}
                                </div>
                                <p className="text-xs font-bold text-on-surface leading-snug break-words">
                                  {n.content}
                                </p>
                                <span className="text-[9px] font-bold text-on-surface-variant/50 uppercase tracking-widest block">
                                  {n.createdAt ? (
                                    typeof n.createdAt.toDate === 'function'
                                      ? n.createdAt.toDate().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                                      : new Date(n.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                                  ) : 'Ahora'}
                                </span>
                              </div>

                              {/* Individual Delete Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(n.id);
                                }}
                                className="absolute right-3 top-4 p-1.5 rounded-lg text-on-surface-variant/30 hover:text-rose-500 hover:bg-rose-500/10 transition-colors opacity-70 sm:opacity-0 group-hover:opacity-100"
                                title="Eliminar notificación"
                              >
                                <Trash2 size={14} />
                              </button>
                            </motion.div>
                          ))
                        )}
                      </div>

                      {/* Dropdown Footer: Auto-cleanup Notice */}
                      <div className="p-3 bg-surface-container-low border-t border-on-surface/5 text-center">
                        <p className="text-[10px] text-on-surface-variant/50 font-medium">
                          🕒 Limpieza automática activa: se conservan hasta 7 días.
                        </p>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>
      )}

      <main className={cn("flex-1 w-full max-w-screen-xl mx-auto", !isAddPage && "pt-[calc(3.75rem+env(safe-area-inset-top,0px))] sm:pt-16 pb-28")}>
        {children}
      </main>

      {/* Bottom Navigation */}
      {!isAddPage && (
        <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-3 py-1.5 pb-safe bg-surface-container-lowest/95 backdrop-blur-2xl shadow-[0_-10px_30px_rgba(0,0,0,0.08)] rounded-t-[2.5rem] border-t border-on-surface/10 sm:hidden select-none">
          <NavLink to="/" className={({ isActive }) => cn(
            "flex flex-col items-center justify-center py-2 px-3.5 min-w-[60px] min-h-[50px] rounded-2xl transition-all duration-200 active:scale-95 touch-manipulation",
            isActive ? "text-primary bg-primary/10 font-black" : "text-on-surface-variant font-medium"
          )}>
            <Home size={22} />
            <span className="text-[10px] font-bold uppercase tracking-wider mt-1 leading-none">Home</span>
          </NavLink>
          
          <NavLink to="/stats" className={({ isActive }) => cn(
            "flex flex-col items-center justify-center py-2 px-3.5 min-w-[60px] min-h-[50px] rounded-2xl transition-all duration-200 active:scale-95 touch-manipulation",
            isActive ? "text-primary bg-primary/10 font-black" : "text-on-surface-variant font-medium"
          )}>
            <BarChart3 size={22} />
            <span className="text-[10px] font-bold uppercase tracking-wider mt-1 leading-none">Stats</span>
          </NavLink>

          <NavLink to="/add" className="flex flex-col items-center justify-center relative translate-y-[-12px] active:scale-90 transition-transform touch-manipulation">
            <div className="p-4 bg-primary text-white rounded-2xl shadow-xl shadow-primary/30 border-4 border-surface flex items-center justify-center">
              <PlusCircle size={28} />
            </div>
          </NavLink>

          <NavLink to="/settings" className={({ isActive }) => cn(
            "flex flex-col items-center justify-center py-2 px-3.5 min-w-[60px] min-h-[50px] rounded-2xl transition-all duration-200 active:scale-95 touch-manipulation",
            isActive ? "text-primary bg-primary/10 font-black" : "text-on-surface-variant font-medium"
          )}>
            <Settings size={22} />
            <span className="text-[10px] font-bold uppercase tracking-wider mt-1 leading-none">Ajustes</span>
          </NavLink>
        </nav>
      )}

      {/* Side Desktop Sidebar (Optional, but let's make it responsive) */}
      {!isAddPage && (
        <aside className="hidden sm:flex fixed left-0 top-0 h-full w-20 flex-col items-center py-10 bg-surface-container-lowest border-r border-on-surface/10 z-50">
           <NavLink to="/" className={({ isActive }) => cn("p-4 rounded-2xl mb-4 transition-all", isActive ? "bg-primary text-white" : "text-on-surface-variant hover:bg-on-surface/5")}>
             <Home size={24} />
           </NavLink>
           <NavLink to="/stats" className={({ isActive }) => cn("p-4 rounded-2xl mb-4 transition-all", isActive ? "bg-primary text-white" : "text-on-surface-variant hover:bg-on-surface/5")}>
             <BarChart3 size={24} />
           </NavLink>
           <NavLink to="/add" className="p-4 rounded-2xl mb-4 text-primary bg-primary/10 hover:bg-primary/20 transition-all">
             <PlusCircle size={24} />
           </NavLink>
           <div className="flex-1" />
           <NavLink to="/settings" className={({ isActive }) => cn("p-4 rounded-2xl transition-all", isActive ? "bg-primary text-white" : "text-on-surface-variant hover:bg-on-surface/5")}>
             <Settings size={24} />
           </NavLink>
        </aside>
      )}

      {/* AI Voice Expense Modal */}
      <VoiceExpenseModal 
        isOpen={isVoiceModalOpen} 
        onClose={() => setIsVoiceModalOpen(false)} 
      />
    </div>
  );
};
