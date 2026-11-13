import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';
import { 
  Smartphone, 
  Share2, 
  CheckCircle2, 
  ArrowRight, 
  Copy, 
  Moon, 
  Sun, 
  Zap, 
  Users, 
  CreditCard, 
  ShieldCheck, 
  Sparkles,
  ChevronDown
} from 'lucide-react';
import logo from '../assets/logo.png';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const WelcomeOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  // PWA install prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    // Check if already installed as standalone PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    // Detect platform
    const ua = navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera || '';
    const iosCheck = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const androidCheck = /android/i.test(ua);
    setIsIos(iosCheck);
    setIsAndroid(androidCheck);

    // Listen for Chrome/Android install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosGuide(prev => !prev);
    } else {
      setShowIosGuide(prev => !prev);
    }
  };

  const handleShareWhatsApp = () => {
    const shareUrl = `${window.location.origin}/bienvenida`;
    const message = 
`👋 ¡Hola! Te comparto *FinApp* para llevar las cuentas y gastos juntos en tiempo real:

📲 *Ingresá acá:* ${shareUrl}

💡 *Para tenerla en la pantalla de inicio:*
Abrí el link en Safari o Chrome y tocá *"Agregar a pantalla de inicio"*. Se instala como app nativa al instante sin descargar nada del Store.`;

    if (navigator.share) {
      navigator.share({
        title: 'FinApp - Bóvedas Compartidas',
        text: message,
        url: shareUrl,
      }).catch(() => {
        copyFallback(message);
      });
    } else {
      copyFallback(message);
    }
  };

  const copyFallback = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    });
  };

  const toggleTheme = () => {
    if (theme === 'dark') {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface antialiased flex flex-col items-center justify-start sm:p-4 selection:bg-primary selection:text-white">
      {/* Mobile Shell Frame */}
      <main className="w-full max-w-md bg-surface-container-lowest min-h-screen sm:min-h-[860px] sm:rounded-[2.5rem] sm:border sm:border-on-surface/10 shadow-2xl flex flex-col justify-between overflow-hidden relative">
        
        {/* Top Header */}
        <header className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-on-surface/5 sticky top-0 bg-surface-container-lowest/80 backdrop-blur-md z-30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-lg shadow-md shadow-primary/20 overflow-hidden">
              <img src={logo} alt="FinApp" className="w-6 h-6 object-contain brightness-0 invert" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <span className="font-headline font-black text-white text-base">F</span>
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-on-surface block leading-tight font-headline">
                FinApp
              </span>
              <span className="text-[11px] font-semibold text-primary">
                Bóvedas & Finanzas
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={toggleTheme} 
              aria-label="Cambiar tema" 
              className="p-2 rounded-xl bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:scale-105 transition-all text-xs font-bold cursor-pointer"
            >
              {theme === 'dark' ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-slate-700" />}
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">

          {/* Hero Welcome */}
          <section className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
              <Sparkles size={14} className="text-primary" />
              <span>Te invitaron a usar FinApp</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-on-surface leading-[1.2] font-headline">
              Olvidate de calcular a mano quién le debe a quién.
            </h1>

            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed max-w-sm mx-auto">
              Llevá tus gastos personales y compartí <strong className="text-on-surface">bóvedas colaborativas</strong> (viajes, asados o gastos del hogar) con saldo en vivo.
            </p>
          </section>

          {/* Mini Interactive Demo Card */}
          <section className="bg-surface-container-low/70 rounded-3xl p-4 sm:p-5 border border-on-surface/5 shadow-xs relative">
            <div className="flex items-center justify-between pb-3 border-b border-on-surface/5 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-bold text-on-surface">Bóveda: Vacaciones 🏖️</span>
              </div>
              <span className="text-[10px] bg-surface-container-lowest text-on-surface-variant px-2 py-0.5 rounded-full font-bold border border-on-surface/5">
                En vivo
              </span>
            </div>

            {/* Simulated expense items */}
            <div className="py-3 space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-lowest border border-on-surface/5">
                <div className="flex items-center gap-2.5">
                  <span className="text-base">🛒</span>
                  <div>
                    <div className="font-bold text-on-surface">Supermercado</div>
                    <div className="text-[10px] text-on-surface-variant">Pagó: Vos</div>
                  </div>
                </div>
                <span className="font-bold text-on-surface">$ 46.000</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-lowest border border-on-surface/5">
                <div className="flex items-center gap-2.5">
                  <span className="text-base">⛽</span>
                  <div>
                    <div className="font-bold text-on-surface">Combustible</div>
                    <div className="text-[10px] text-on-surface-variant">Pagó: Juan</div>
                  </div>
                </div>
                <span className="font-bold text-on-surface">$ 24.000</span>
              </div>
            </div>

            {/* Live Resolution Pill */}
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <span className="text-[10px] uppercase tracking-wider text-emerald-800 dark:text-emerald-300 font-bold block mb-0.5">
                Saldo automático calculado
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                Juan te transfiere $ 11.000 y quedan a mano ✨
              </span>
            </div>
          </section>

          {/* Smart PWA Install Hero Box */}
          <section className="rounded-3xl p-5 bg-gradient-to-br from-[#000666] via-[#1a237e] to-[#2563eb] text-white shadow-xl shadow-blue-950/20 relative overflow-hidden">
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-xs">
                  ⚡ Sin tiendas de descarga
                </span>
                <span className="text-[11px] font-semibold text-blue-200">
                  {isIos ? 'iPhone (Safari)' : isAndroid ? 'Android (Chrome)' : 'Navegador Web'}
                </span>
              </div>

              <h3 className="text-lg font-black leading-snug font-headline">
                {isInstalled ? '¡FinApp ya está instalada!' : 'Instalá FinApp en tu celular'}
              </h3>

              <p className="text-xs text-blue-100/90 leading-relaxed">
                {isInstalled 
                  ? 'Estás ejecutando la aplicación en modo nativo con soporte offline completo.'
                  : 'Funciona igual que una app descargada del App Store o Google Play: pantalla completa, súper rápida y sin ocupar memoria.'}
              </p>

              {!isInstalled && (
                <button 
                  type="button"
                  onClick={handleInstallClick} 
                  className="w-full py-3.5 px-4 rounded-2xl bg-white text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg hover:bg-blue-50 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Smartphone size={18} className="text-primary" />
                  <span>
                    {deferredPrompt 
                      ? 'Instalar App Ahora' 
                      : isIos 
                        ? 'Cómo agregar en iPhone (Safari)' 
                        : 'Cómo agregar a la pantalla de inicio'}
                  </span>
                </button>
              )}
            </div>

            {/* Collapsible Step-by-Step Instructions */}
            {showIosGuide && !isInstalled && (
              <div className="mt-4 pt-4 border-t border-white/15 text-xs text-blue-100 space-y-2">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <span>Paso a paso en tu pantalla:</span>
                </div>
                {isIos ? (
                  <>
                    <div className="flex items-start gap-2 bg-white/10 p-2.5 rounded-xl backdrop-blur-xs">
                      <span className="font-bold text-white bg-blue-600 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px]">1</span>
                      <span>En Safari, tocá el botón <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba abajo en la pantalla).</span>
                    </div>
                    <div className="flex items-start gap-2 bg-white/10 p-2.5 rounded-xl backdrop-blur-xs">
                      <span className="font-bold text-white bg-blue-600 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px]">2</span>
                      <span>Deslizá hacia abajo y elegí <strong>"Agregar a la pantalla de inicio"</strong>.</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-2 bg-white/10 p-2.5 rounded-xl backdrop-blur-xs">
                      <span className="font-bold text-white bg-blue-600 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px]">1</span>
                      <span>Tocá los <strong>tres puntos verticales (⋮)</strong> arriba a la derecha en Chrome.</span>
                    </div>
                    <div className="flex items-start gap-2 bg-white/10 p-2.5 rounded-xl backdrop-blur-xs">
                      <span className="font-bold text-white bg-blue-600 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px]">2</span>
                      <span>Seleccioná <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          {/* 3 Key Benefits */}
          <section className="space-y-3">
            <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider px-1">
              Lo que te vas a encontrar
            </h4>

            <div className="grid grid-cols-1 gap-2.5">
              <div className="p-3.5 rounded-2xl bg-surface-container-low/70 border border-on-surface/5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-primary flex items-center justify-center shrink-0">
                  <Zap size={18} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-on-surface">Carga en 2 segundos</h5>
                  <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">
                    Sin pantallas infinitas. Abrís, ponés el monto y confirmás en la zona del pulgar.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-container-low/70 border border-on-surface/5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Users size={18} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-on-surface">Bóvedas 100% Compartidas</h5>
                  <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">
                    Cada uno ve los movimientos en tiempo real. Tus gastos privados quedan guardados solo para vos.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-container-low/70 border border-on-surface/5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-on-surface">Control de Tarjetas y Cuotas</h5>
                  <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">
                    Cargás una compra en 6 o 12 cuotas y la app proyecta tu gasto mes a mes según la fecha de cierre.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Privacy & Free Badge */}
          <section className="text-center p-3 rounded-2xl bg-surface-container-low/50 border border-on-surface/5 text-[11px] text-on-surface-variant flex items-center justify-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Sin suscripciones ni publicidad. 100% Gratuito y Privado.</span>
          </section>

        </div>

        {/* Bottom Action Dock (Sticky Thumb Zone) */}
        <footer className="p-4 bg-surface-container-lowest/95 border-t border-on-surface/5 sticky bottom-0 z-30 space-y-2 backdrop-blur-md pb-safe-bottom">
          <button
            type="button"
            onClick={() => navigate(user ? '/' : '/login')}
            className="w-full py-3.5 rounded-2xl bg-primary hover:opacity-95 text-on-primary font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/25 active:scale-[0.98] transition-all cursor-pointer font-headline"
          >
            <span>{user ? 'Volver a mi Cuenta' : 'Entrar a FinApp'}</span>
            <ArrowRight size={18} />
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="w-full py-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            {copiedShare ? (
              <>
                <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">¡Mensaje copiado para WhatsApp!</span>
              </>
            ) : (
              <>
                <Share2 size={15} />
                <span>Compartir invitación por WhatsApp</span>
              </>
            )}
          </button>

          <p className="text-center text-[10px] text-on-surface-variant/60 pt-0.5">
            FinApp v2.20.1 • Bóvedas Compartidas
          </p>
        </footer>

      </main>
    </div>
  );
};
