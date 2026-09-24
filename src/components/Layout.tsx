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

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { notifications, markAsRead } = useData();
  const [showNotifs, setShowNotifs] = React.useState(false);
  
  const isAuthPage = location.pathname === '/login';
  const isAddPage = location.pathname === '/add';

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (isAuthPage) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      {!isAddPage && (
        <header className="fixed top-0 w-full z-50 flex items-center justify-between px-4 sm:px-6 h-14 sm:h-16 glass-header">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white flex items-center justify-center p-1.5 sm:p-2 shadow-sm border border-black/5 cursor-pointer" onClick={() => navigate('/')}>
              <img 
                src={logo} 
                alt="FinApp Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-lg sm:text-xl font-extrabold tracking-tight text-on-surface font-headline cursor-pointer" onClick={() => navigate('/')}>FinApp</span>
          </div>
          <div className="flex items-center gap-2 relative">
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
                    className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-surface-container-lowest rounded-3xl shadow-2xl border border-on-surface/5 overflow-hidden z-[60]"
                  >
                    <div className="p-5 border-b border-on-surface/5 flex items-center justify-between">
                      <h3 className="font-headline font-black text-on-surface text-sm uppercase tracking-widest">Notificaciones</h3>
                      {unreadCount > 0 && (
                        <button 
                          onClick={() => {
                            notifications.filter(n => !n.isRead).forEach(n => markAsRead(n.id));
                          }}
                          className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                        >
                          Leer todo
                        </button>
                      )}
                    </div>
                    <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="p-10 text-center flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-on-surface/5 flex items-center justify-center text-on-surface-variant/20">
                            <Bell size={24} />
                          </div>
                          <p className="text-xs font-bold text-on-surface-variant/40 uppercase tracking-widest">Sin novedades</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-on-surface/[0.03]">
                          {notifications.map((n) => (
                            <motion.div 
                              key={n.id}
                              className={cn(
                                "p-4 flex gap-4 transition-colors hover:bg-on-surface/[0.02] cursor-pointer",
                                !n.isRead && "bg-primary/[0.03]"
                              )}
                              onClick={() => {
                                if(!n.isRead) markAsRead(n.id);
                                if(n.type === 'project_shared') navigate('/settings');
                                if(n.type === 'expense_added') navigate('/history');
                                if(n.type === 'budget_alert') navigate('/budgets');
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
                              <div className="flex-1 space-y-1">
                                <p className="text-xs font-bold text-on-surface leading-snug">
                                  {n.content}
                                </p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black text-on-surface-variant/30 uppercase tracking-widest">
                                    {n.createdAt ? (
                                      typeof n.createdAt.toDate === 'function'
                                        ? n.createdAt.toDate().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                                        : new Date(n.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                                    ) : 'Ahora'}
                                  </span>
                                  {!n.isRead && <span className="w-1.5 h-1.5 bg-primary rounded-full" />}
                                </div>
                              </div>
                              <ArrowRight size={14} className="text-on-surface-variant/20 self-center" />
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </header>
      )}

      <main className={cn("flex-1 w-full max-w-screen-xl mx-auto", !isAddPage && "pt-14 sm:pt-16 pb-24 sm:pb-28")}>
        {children}
      </main>

      {/* Bottom Navigation */}
      {!isAddPage && (
        <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-2 pb-safe bg-white/90 backdrop-blur-2xl shadow-[0_-10px_30px_rgba(0,0,0,0.08)] rounded-t-[2.5rem] border-t border-black/5 sm:hidden">
          <NavLink to="/" className={({ isActive }) => cn(
            "flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300",
            isActive ? "text-primary bg-primary/5 scale-110" : "text-slate-400 opacity-60"
          )}>
            <Home size={22} />
            <span className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-80">Home</span>
          </NavLink>
          
          <NavLink to="/stats" className={({ isActive }) => cn(
            "flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300",
            isActive ? "text-primary bg-primary/5 scale-110" : "text-slate-400 opacity-60"
          )}>
            <BarChart3 size={22} />
            <span className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-80">Stats</span>
          </NavLink>

          <NavLink to="/add" className="flex flex-col items-center justify-center relative translate-y-[-10px]">
            <div className="p-4 bg-primary text-white rounded-2xl shadow-xl shadow-primary/30 active:scale-95 transition-transform border-4 border-surface">
              <PlusCircle size={28} />
            </div>
          </NavLink>

          <NavLink to="/settings" className={({ isActive }) => cn(
            "flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300",
            isActive ? "text-primary bg-primary/5 scale-110" : "text-slate-400 opacity-60"
          )}>
            <Settings size={22} />
            <span className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-80">Settings</span>
          </NavLink>
        </nav>
      )}

      {/* Side Desktop Sidebar (Optional, but let's make it responsive) */}
      {!isAddPage && (
        <aside className="hidden sm:flex fixed left-0 top-0 h-full w-20 flex-col items-center py-10 bg-white border-r border-on-surface/5 z-50">
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
    </div>
  );
};
