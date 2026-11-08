import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  BarChart3, 
  PlusCircle, 
  Settings, 
  Bell, 
  UserPlus,
  Receipt,
  AlertTriangle, 
  Check, 
  Trash2,
  CheckCircle2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import logo from '../assets/logo.png';
import { useData } from '../lib/DataContext';
import { getAppVersionInfo } from '../lib/version';
import { haptic } from '../lib/haptics';

const formatRelativeTime = (rawDate: any): string => {
  if (!rawDate) return 'Ahora';
  let date: Date;
  if (typeof rawDate.toDate === 'function') {
    date = rawDate.toDate();
  } else if (rawDate instanceof Date) {
    date = rawDate;
  } else if (typeof rawDate === 'number' || typeof rawDate === 'string') {
    date = new Date(rawDate);
  } else {
    return 'Ahora';
  }

  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInSec = Math.max(0, Math.floor(diffInMs / 1000));

  if (diffInSec < 45) return 'Ahora';
  if (diffInSec < 90) return 'Hace 1 min';
  const diffInMin = Math.floor(diffInSec / 60);
  if (diffInMin < 60) return `Hace ${diffInMin} min`;
  
  const diffInHours = Math.floor(diffInMin / 60);
  if (diffInHours < 24) {
    return `Hace ${diffInHours} ${diffInHours === 1 ? 'hora' : 'horas'}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = 
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const hoursStr = String(date.getHours()).padStart(2, '0');
  const minStr = String(date.getMinutes()).padStart(2, '0');

  if (isYesterday) {
    return `Ayer a las ${hoursStr}:${minStr}`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `Hace ${diffInDays} d`;
  }

  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

interface NotificationItemProps {
  n: any;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClick: (n: any) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ n, onRead, onDelete, onClick }) => {
  const isDragging = useRef(false);
  const dragDistance = useRef(0);

  let typeLabel = 'Aviso';
  let pillClass = 'bg-on-surface/5 text-on-surface-variant border-on-surface/10';
  let iconContainerClass = 'bg-on-surface/5 text-on-surface-variant';
  let TypeIcon = Bell;

  if (n.type === 'project_shared') {
    typeLabel = 'Proyecto';
    pillClass = 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20';
    iconContainerClass = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400';
    TypeIcon = UserPlus;
  } else if (n.type === 'expense_added') {
    typeLabel = 'Gasto';
    pillClass = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
    iconContainerClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    TypeIcon = Receipt;
  } else if (n.type === 'budget_alert') {
    typeLabel = 'Presupuesto';
    const isOver = n.data?.threshold === 100;
    pillClass = isOver 
      ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
      : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
    iconContainerClass = isOver ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600';
    TypeIcon = AlertTriangle;
  }

  const actionWidth = n.isRead ? 72 : 144;

  return (
    <div className="relative overflow-hidden group select-none bg-surface-container-low border-b border-on-surface/5 last:border-b-0">
      {/* Background Actions Revealed on Mobile Swipe (sm:hidden) */}
      <div className="absolute inset-y-0 right-0 flex items-stretch z-0 sm:hidden">
        {!n.isRead && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              haptic.light();
              onRead(n.id);
            }}
            className="w-[72px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
            title="Marcar como leída"
          >
            <Check size={18} strokeWidth={2.5} />
            <span className="text-[9px] font-black uppercase tracking-wider">Leída</span>
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            haptic.medium();
            onDelete(n.id);
          }}
          className="w-[72px] bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
          title="Eliminar notificación"
        >
          <Trash2 size={18} />
          <span className="text-[9px] font-black uppercase tracking-wider">Borrar</span>
        </button>
      </div>

      {/* Foreground Card: 100% SOLID OPAQUE, NEVER TRANSLUCENT */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -actionWidth, right: 0 }}
        dragElastic={0.08}
        dragSnapToOrigin={false}
        style={{ touchAction: 'pan-y' }}
        onDragStart={() => {
          isDragging.current = true;
          dragDistance.current = 0;
        }}
        onDrag={(_, info) => {
          dragDistance.current = Math.abs(info.offset.x);
        }}
        onDragEnd={() => {
          setTimeout(() => {
            isDragging.current = false;
          }, 150);
        }}
        onClick={() => {
          if (dragDistance.current > 10 || isDragging.current) return;
          onClick(n);
        }}
        className={cn(
          "relative z-10 p-3.5 sm:p-4 flex gap-3 transition-colors cursor-pointer",
          // SOLID OPAQUE BACKGROUND - NEVER TRANSLUCENT
          "bg-surface-container-lowest hover:bg-on-surface/[0.02]",
          "border-l-4",
          !n.isRead 
            ? "border-primary text-on-surface" 
            : "border-transparent text-on-surface-variant/80"
        )}
      >
        <div className={cn("w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center shadow-xs", iconContainerClass)}>
          <TypeIcon size={18} />
        </div>

        <div className="flex-1 space-y-1.5 min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <span className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border", pillClass)}>
              {typeLabel}
            </span>
            {!n.isRead && (
              <span className="w-2 h-2 bg-primary rounded-full shrink-0 shadow-xs ring-2 ring-primary/20" />
            )}
            <span className="text-[10px] font-bold text-on-surface-variant/50 ml-auto whitespace-nowrap">
              {formatRelativeTime(n.createdAt)}
            </span>
          </div>

          <p className={cn(
            "text-xs leading-snug break-words",
            !n.isRead ? "font-bold text-on-surface" : "font-medium text-on-surface-variant/80"
          )}>
            {n.content}
          </p>
        </div>

        {/* Desktop Quick Actions (visible only on desktop >=sm, on hover) */}
        <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-center shrink-0">
          {!n.isRead && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                haptic.light();
                onRead(n.id);
              }}
              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10 active:scale-95 transition-all cursor-pointer"
              title="Marcar como leída"
            >
              <Check size={15} strokeWidth={2.5} />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              haptic.medium();
              onDelete(n.id);
            }}
            className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-rose-500 hover:bg-rose-500/10 active:scale-95 transition-all cursor-pointer"
            title="Eliminar notificación"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { notifications, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications } = useData();
  const [showNotifs, setShowNotifs] = useState(false);
  const [filterNotifs, setFilterNotifs] = useState<'all' | 'unread'>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const versionInfo = getAppVersionInfo();
  
  const isAuthPage = location.pathname === '/login';
  const isAddPage = location.pathname === '/add';

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const displayedNotifs = notifications.filter(n => filterNotifs === 'all' || !n.isRead);

  const handleNotificationClick = (n: any) => {
    if (!n.isRead) {
      markAsRead(n.id);
    }
    setShowNotifs(false);

    if (n.type === 'project_shared') {
      if (n.data?.projectId) {
        navigate(`/project/${n.data.projectId}`);
      } else {
        navigate('/shared');
      }
    } else if (n.type === 'expense_added') {
      if (n.data?.projectId) {
        navigate(`/project/${n.data.projectId}`);
      } else {
        navigate('/history');
      }
    } else if (n.type === 'budget_alert') {
      navigate('/budgets');
    } else {
      if (n.data?.projectId) {
        navigate(`/project/${n.data.projectId}`);
      }
    }
  };

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
            
            {/* Bell Button and Dropdown Menu */}
            <div className="flex items-center gap-2 relative">
              <button 
                onClick={() => {
                  haptic.light();
                  setShowNotifs(!showNotifs);
                }}
                className={cn(
                  "p-2.5 text-on-surface-variant hover:bg-on-surface/5 transition-all rounded-full relative group cursor-pointer",
                  showNotifs && "bg-primary/10 text-primary"
                )}
                title="Notificaciones"
              >
                <Bell size={20} className="transition-transform group-hover:scale-105" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-primary text-[10px] font-black text-white rounded-full ring-2 ring-surface flex items-center justify-center shadow-xs">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Popover Dropdown (Aligned below the bell icon on both mobile and web) */}
              <AnimatePresence>
                {showNotifs && (
                  <>
                    {/* Backdrop to close when clicking outside */}
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowNotifs(false)} 
                    />

                    <motion.div 
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute top-full right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-sm sm:w-96 bg-surface-container-lowest rounded-2xl sm:rounded-3xl shadow-2xl border border-on-surface/10 overflow-hidden z-50 flex flex-col max-h-[75vh]"
                    >
                      {/* Header */}
                      <div className="p-4 sm:p-5 border-b border-on-surface/10 space-y-3 shrink-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h3 className="font-headline font-black text-on-surface text-sm sm:text-base uppercase tracking-wider">
                              Notificaciones
                            </h3>
                            {unreadCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black">
                                {unreadCount} nueva{unreadCount > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            {unreadCount > 0 && (
                              <button 
                                onClick={() => {
                                  haptic.light();
                                  markAllAsRead();
                                }}
                                className="px-2 py-1 rounded-lg hover:bg-primary/10 text-[10px] font-black text-primary uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
                                title="Marcar todas como leídas"
                              >
                                <Check size={13} strokeWidth={3} />
                                <span>Leer todo</span>
                              </button>
                            )}
                            {notifications.length > 0 && (
                              <button 
                                onClick={() => {
                                  haptic.light();
                                  setShowClearConfirm(true);
                                }}
                                className="px-2 py-1 rounded-lg hover:bg-rose-500/10 text-[10px] font-black text-on-surface-variant/60 hover:text-rose-500 uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
                                title="Vaciar historial de notificaciones"
                              >
                                <Trash2 size={13} />
                                <span>Vaciar</span>
                              </button>
                            )}
                            {/* Close Button */}
                            <button
                              type="button"
                              onClick={() => setShowNotifs(false)}
                              className="p-1.5 rounded-full text-on-surface-variant/60 hover:text-on-surface hover:bg-on-surface/5 cursor-pointer ml-1 sm:hidden"
                              title="Cerrar"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex gap-1.5 p-1 bg-surface-container-low rounded-xl">
                          <button
                            type="button"
                            onClick={() => {
                              haptic.selection();
                              setFilterNotifs('all');
                            }}
                            className={cn(
                              "flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer",
                              filterNotifs === 'all'
                                ? "bg-surface-container-lowest text-on-surface shadow-xs"
                                : "text-on-surface-variant/60 hover:text-on-surface"
                            )}
                          >
                            Todas ({notifications.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              haptic.selection();
                              setFilterNotifs('unread');
                            }}
                            className={cn(
                              "flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer",
                              filterNotifs === 'unread'
                                ? "bg-surface-container-lowest text-on-surface shadow-xs"
                                : "text-on-surface-variant/60 hover:text-on-surface"
                            )}
                          >
                            No leídas ({unreadCount})
                          </button>
                        </div>
                      </div>

                      {/* Notifications List */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-on-surface/[0.04]">
                        {displayedNotifs.length === 0 ? (
                          <div className="py-12 px-6 text-center flex flex-col items-center justify-center gap-3">
                            <div className="w-14 h-14 rounded-3xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shadow-inner">
                              <CheckCircle2 size={28} strokeWidth={2.5} />
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-black text-on-surface">
                                {filterNotifs === 'unread' ? '¡Estás al día!' : 'Bandeja limpia'}
                              </p>
                              <p className="text-xs text-on-surface-variant/60 max-w-[220px]">
                                {filterNotifs === 'unread'
                                  ? 'No tienes notificaciones pendientes de lectura.'
                                  : 'No hay notificaciones en tu historial.'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          displayedNotifs.map((n) => (
                            <NotificationItem
                              key={n.id}
                              n={n}
                              onRead={markAsRead}
                              onDelete={deleteNotification}
                              onClick={handleNotificationClick}
                            />
                          ))
                        )}
                      </div>

                      {/* Mobile Swipe Hint in Footer */}
                      {displayedNotifs.length > 0 && (
                        <div className="p-2.5 bg-surface-container-low/40 border-t border-on-surface/5 text-center sm:hidden shrink-0">
                          <p className="text-[10px] text-on-surface-variant/50 font-medium">
                            💡 Desliza hacia la izquierda para leer o borrar
                          </p>
                        </div>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>
      )}

      {/* Confirmation Modal for Clear All */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showClearConfirm && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowClearConfirm(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 10 }}
                className="relative z-10 bg-surface-container-lowest rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-on-surface/10 space-y-4 text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 mx-auto flex items-center justify-center">
                  <Trash2 size={24} />
                </div>
                <div>
                  <h4 className="text-base font-black text-on-surface">¿Vaciar notificaciones?</h4>
                  <p className="text-xs text-on-surface-variant/70 mt-1 leading-relaxed">
                    Se eliminarán todas las notificaciones de tu historial de forma permanente.
                  </p>
                </div>
                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl border border-on-surface/10 text-xs font-bold text-on-surface hover:bg-on-surface/5 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      haptic.medium();
                      await clearAllNotifications();
                      setShowClearConfirm(false);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-black shadow-md shadow-rose-600/20 transition-all cursor-pointer"
                  >
                    Sí, vaciar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
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

      {/* Side Desktop Sidebar */}
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
           <span 
             className="mt-2 text-[9px] font-mono font-bold text-on-surface-variant/40 tracking-tight select-none cursor-default" 
             title={`FinApp v${versionInfo.version} (${versionInfo.commit}) • ${versionInfo.env}`}
           >
             v{versionInfo.version}
           </span>
        </aside>
      )}
    </div>
  );
};
