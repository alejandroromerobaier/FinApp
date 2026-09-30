import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider, signInWithPopup } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  sendPasswordResetEmail 
} from 'firebase/auth';
import { syncUserProfile } from '../services/firestoreService';
import { Mail, User as UserIcon, ArrowRight, AlertCircle, Loader2, Lock, KeyRound, CheckCircle2, X } from 'lucide-react';
import logo from '../assets/logo.png';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Password recovery modal state
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const validateEmail = (val: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(val);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    if (val && !validateEmail(val)) {
      setEmailError('Email inválido');
    } else {
      setEmailError(null);
    }
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      setEmailError('Email inválido');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        if (!name.trim()) {
          setError('El nombre completo es obligatorio');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres');
          setLoading(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        await syncUserProfile(userCredential.user, name);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/');
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.code === 'auth/user-not-found') {
        setIsSignUp(true);
        setError('Cuenta no encontrada. Por favor, regístrate a continuación.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Email o contraseña incorrectos. Verifica tus datos o restablece tu contraseña.');
      } else if (err.code === 'auth/email-already-in-use') {
        setIsSignUp(false);
        setError('Este correo ya tiene una cuenta registrada. Inicia sesión o recupera tu contraseña.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña es muy débil. Debe incluir al menos 6 caracteres.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('El acceso con correo y contraseña no está habilitado actualmente.');
      } else if (err.code === 'auth/invalid-email') {
        setError('El formato del correo no es válido.');
      } else {
        setError(err.message || 'Ocurrió un error al procesar tu solicitud.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      navigate('/');
    } catch (err: any) {
      console.error('Google Auth error:', err);
      setError('Error al iniciar sesión con Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = resetEmail.trim() || email.trim();
    if (!targetEmail || !validateEmail(targetEmail)) {
      setResetError('Por favor ingresa un correo electrónico válido');
      return;
    }

    setResetLoading(true);
    setResetError(null);
    setResetMessage(null);

    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setResetMessage(`Se ha enviado un correo a ${targetEmail} con instrucciones para restablecer tu contraseña. Revisa tu bandeja de entrada o spam.`);
    } catch (err: any) {
      console.error('Reset password error:', err);
      if (err.code === 'auth/user-not-found') {
        setResetError('No existe ninguna cuenta registrada con este correo electrónico.');
      } else if (err.code === 'auth/invalid-email') {
        setResetError('El formato del correo electrónico es inválido.');
      } else {
        setResetError('No se pudo enviar el correo de recuperación. Inténtalo de nuevo más tarde.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8 relative z-10"
      >
        <div className="flex flex-col items-center md:items-start gap-6">
          <div className="w-20 h-20 bg-white rounded-3xl shadow-2xl flex items-center justify-center p-4 border border-black/5">
            <img src={logo} alt="FinApp Logo" className="w-full h-full object-contain" />
          </div>
          <div className="space-y-3 text-center md:text-left">
            <h1 className="text-4xl font-extrabold tracking-tight text-on-surface font-headline">
              {isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
            </h1>
            <p className="text-on-surface-variant text-lg leading-relaxed">
              Tu aliado inteligente en finanzas personales y compartidas.
            </p>
          </div>
        </div>

        <form onSubmit={handleContinue} className="space-y-5">
          <div className="space-y-4">
            {/* Name Field (Conditional) */}
            <AnimatePresence>
              {isSignUp && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-primary transition-colors">
                      <UserIcon size={20} />
                    </div>
                    <input 
                      type="text"
                      placeholder="Nombre y apellido"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required={isSignUp}
                      className="w-full pl-12 pr-4 py-4 bg-surface-container-low border-none rounded-2xl text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/20 transition-all outline-none text-lg"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email Field */}
            <div className="space-y-2">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-primary transition-colors">
                  <Mail size={20} />
                </div>
                <input 
                  type="email"
                  placeholder="Correo electrónico"
                  value={email}
                  onChange={handleEmailChange}
                  required
                  className={`w-full pl-12 pr-4 py-4 bg-surface-container-low border-none rounded-2xl text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 transition-all outline-none text-lg ${emailError ? 'ring-2 ring-error/20' : 'focus:ring-primary/20'}`}
                />
              </div>
              {emailError && (
                <motion.p 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-error text-sm font-medium ml-2 flex items-center gap-1"
                >
                  <AlertCircle size={14} />
                  {emailError}
                </motion.p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-primary transition-colors">
                  <Lock size={20} />
                </div>
                <input 
                  type="password"
                  placeholder="Contraseña (mín. 6 caracteres)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-12 pr-4 py-4 bg-surface-container-low border-none rounded-2xl text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/20 transition-all outline-none text-lg"
                />
              </div>

              {/* Password Help Actions */}
              <div className="flex items-center justify-between px-1 pt-1 text-sm">
                {!isSignUp ? (
                  <>
                    <button 
                      type="button"
                      onClick={() => setIsSignUp(true)}
                      className="text-primary font-bold hover:underline text-xs sm:text-sm"
                    >
                      ¿No tienes cuenta? Regístrate
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setResetEmail(email);
                        setResetError(null);
                        setResetMessage(null);
                        setIsResetOpen(true);
                      }}
                      className="text-on-surface-variant/80 hover:text-primary font-semibold hover:underline text-xs sm:text-sm flex items-center gap-1"
                    >
                      <KeyRound size={14} />
                      ¿Olvidaste tu contraseña?
                    </button>
                  </>
                ) : (
                  <button 
                    type="button"
                    onClick={() => setIsSignUp(false)}
                    className="text-primary font-bold hover:underline text-xs sm:text-sm"
                  >
                    ¿Ya tienes cuenta? Inicia sesión
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-error-container text-error rounded-2xl flex items-center gap-3"
              >
                <AlertCircle size={20} className="shrink-0" />
                <p className="text-sm font-bold leading-tight">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Primary CTA */}
          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-xl shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:scale-100 h-[56px]"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              <>
                <span>{isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}</span>
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        {/* Separator */}
        <div className="relative flex items-center py-2">
          <div className="flex-grow h-px bg-on-surface/5"></div>
          <span className="flex-shrink mx-4 text-xs font-bold text-on-surface-variant/40 uppercase tracking-widest">o continuar con</span>
          <div className="flex-grow h-px bg-on-surface/5"></div>
        </div>

        {/* Google Sign-In */}
        <button 
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-4 bg-surface-container-lowest border border-on-surface/5 text-on-surface font-bold rounded-2xl shadow-sm hover:bg-on-surface/5 transition-all flex items-center justify-center gap-3 active:scale-[0.98] h-[56px]"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google" />
          <span>Iniciar sesión con Google</span>
        </button>

        <p className="text-center text-xs text-on-surface-variant/60 pt-2">
          Al continuar, aceptas nuestros <button className="underline">Términos de Servicio</button> y <button className="underline">Política de Privacidad</button>.
        </p>
      </motion.div>

      {/* Password Reset Modal */}
      <AnimatePresence>
        {isResetOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-surface-container-lowest w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-on-surface/5 relative space-y-6"
            >
              <button 
                onClick={() => setIsResetOpen(false)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-on-surface/5 text-on-surface-variant transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <KeyRound size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-headline text-on-surface">Recuperar contraseña</h3>
                  <p className="text-xs text-on-surface-variant">Te enviaremos un correo con las instrucciones.</p>
                </div>
              </div>

              {resetMessage ? (
                <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 size={20} />
                    <span>¡Correo enviado!</span>
                  </div>
                  <p className="text-xs leading-relaxed">{resetMessage}</p>
                  <button
                    onClick={() => setIsResetOpen(false)}
                    className="w-full mt-2 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider"
                  >
                    Entendido, Volver al Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">
                      Correo Electrónico
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                        <Mail size={18} />
                      </div>
                      <input 
                        type="email"
                        placeholder="tu-correo@ejemplo.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                        className="w-full pl-11 pr-4 py-3.5 bg-surface-container-low border-none rounded-2xl text-on-surface text-base outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  {resetError && (
                    <div className="p-3 bg-error-container text-error rounded-xl flex items-center gap-2 text-xs font-bold">
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{resetError}</span>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsResetOpen(false)}
                      className="flex-1 py-3.5 bg-surface-container-low text-on-surface font-bold rounded-2xl hover:bg-on-surface/5 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="flex-1 py-3.5 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {resetLoading ? <Loader2 className="animate-spin" size={20} /> : 'Enviar Correo'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
