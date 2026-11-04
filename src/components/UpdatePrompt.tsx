import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { APP_VERSION, COMMIT_HASH } from '../lib/version';

interface RemoteVersionData {
  version: string;
  commit: string;
  buildDate: string;
  env: string;
}

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const DISMISS_DURATION_MS = 30 * 60 * 1000; // 30 minutos al descartar

export const UpdatePrompt: React.FC = () => {
  const [newVersionData, setNewVersionData] = useState<RemoteVersionData | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const checkForUpdate = useCallback(async () => {
    // Verificar si el usuario lo descartó recientemente
    const dismissedUntil = sessionStorage.getItem('finapp_update_dismissed_until');
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) {
      return;
    }

    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (!res.ok) return;

      const data: RemoteVersionData = await res.json();

      // Comparar commit o versión
      const isNewCommit =
        data.commit &&
        data.commit !== 'unknown' &&
        COMMIT_HASH !== 'unknown' &&
        data.commit !== COMMIT_HASH;

      const isNewVersion = data.version && data.version !== APP_VERSION;

      if (isNewCommit || isNewVersion) {
        setNewVersionData(data);
        setIsDismissed(false);
      }
    } catch {
      // Error silencioso en caso de estar offline o error de red
    }
  }, []);

  useEffect(() => {
    // Primer chequeo suave a los 3 segundos del inicio
    const initialTimer = setTimeout(() => {
      checkForUpdate();
    }, 3000);

    // Chequeo periódico cada 5 minutos
    const intervalTimer = setInterval(() => {
      checkForUpdate();
    }, CHECK_INTERVAL_MS);

    // Chequeo reactivo al volver a la pestaña o app
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [checkForUpdate]);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem(
      'finapp_update_dismissed_until',
      String(Date.now() + DISMISS_DURATION_MS)
    );
  };

  const handleApplyUpdate = async () => {
    setIsUpdating(true);
    try {
      // Limpiar caché de service workers / caches API si existe
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
    } catch {
      // Continuar con la recarga
    }

    // Forzar recarga limpia desde el servidor
    window.location.reload();
  };

  if (!newVersionData || isDismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="fixed z-[9999] bottom-24 sm:bottom-6 sm:right-6 inset-x-4 sm:inset-x-auto max-w-sm sm:max-w-md mx-auto pointer-events-auto"
      >
        <div className="bg-surface-container-lowest/95 dark:bg-surface-container-lowest/95 backdrop-blur-2xl p-4 sm:p-5 rounded-3xl shadow-2xl border border-primary/20 ring-1 ring-black/5 dark:ring-white/10 flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Sparkles size={18} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-on-surface">
                    Nueva Versión Disponible
                  </h4>
                  <span className="px-1.5 py-0.2 rounded-md bg-primary/10 text-primary text-[10px] font-black">
                    v{newVersionData.version}
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant font-medium leading-tight mt-0.5">
                  Hay mejoras y actualizaciones listas para aplicar.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="p-1.5 rounded-xl text-on-surface-variant/40 hover:text-on-surface hover:bg-on-surface/5 transition-colors"
              title="Más tarde"
            >
              <X size={16} />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-1 py-2.5 px-3 rounded-xl bg-surface-container-low hover:bg-on-surface/5 text-on-surface-variant font-bold text-xs uppercase tracking-wider transition-colors text-center"
            >
              Más tarde
            </button>
            <button
              type="button"
              disabled={isUpdating}
              onClick={handleApplyUpdate}
              className="flex-[2] py-2.5 px-4 rounded-xl bg-primary text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-primary/25 hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              <RefreshCw size={14} className={isUpdating ? 'animate-spin' : ''} />
              <span>{isUpdating ? 'Actualizando...' : 'Actualizar Ahora'}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
