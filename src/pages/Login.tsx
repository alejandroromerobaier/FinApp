import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider, signInWithPopup } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  fetchSignInMethodsForEmail 
} from 'firebase/auth';
import { syncUserProfile } from '../services/firestoreService';
import { Mail, User as UserIcon, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import logo from '../assets/logo.png';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState(''); // Adding password for real auth
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
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
          setError('El nombre es obligatorio');
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
        // Manually sync profile to ensure the name is set correctly on first creation
        await syncUserProfile(userCredential.user, name);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/');
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.code === 'auth/user-not-found') {
        setIsSignUp(true);
        setError('Cuenta no encontrada. Por favor, regístrate.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Credenciales inválidas. Intenta de nuevo.');
      } else if (err.code === 'auth/email-already-in-use') {
        setIsSignUp(false);
        setError('El email ya está en uso. Inicia sesión.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña es muy débil. Usa al menos 6 caracteres.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('El registro con email/contraseña no está habilitado. Contacta al administrador.');
      } else if (err.code === 'auth/invalid-email') {
        setError('El formato del email no es válido.');
      } else {
        setError(err.message || 'Ocurrió un error. Intenta de nuevo.');
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
                  className="space-y-2"
                >
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-primary transition-colors">
                      <UserIcon size={20} />
                    </div>
                    <input 
                      type="text"
                      placeholder="Tu nombre completo"
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
              <input 
                type="password"
                placeholder="Contraseña (mín. 6 caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-4 bg-surface-container-low border-none rounded-2xl text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/20 transition-all outline-none text-lg"
              />
              {!isSignUp && (
                <button 
                  type="button"
                  onClick={() => setIsSignUp(true)}
                  className="text-primary text-sm font-bold ml-2 hover:underline"
                >
                  ¿No tienes cuenta? Regístrate
                </button>
              )}
              {isSignUp && (
                <button 
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className="text-primary text-sm font-bold ml-2 hover:underline"
                >
                  ¿Ya tienes cuenta? Inicia sesión
                </button>
              )}
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
                <AlertCircle size={20} />
                <p className="text-sm font-bold">{error}</p>
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
                <span>Continuar</span>
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        {/* Separator */}
        <div className="relative flex items-center py-4">
          <div className="flex-grow h-px bg-on-surface/5"></div>
          <span className="flex-shrink mx-4 text-sm font-bold text-on-surface-variant/40 uppercase tracking-widest">o continuar con</span>
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

        <p className="text-center text-xs text-on-surface-variant/60 pt-4">
          Al continuar, aceptas nuestros <button className="underline">Términos de Servicio</button> y <button className="underline">Política de Privacidad</button>.
        </p>
      </motion.div>
    </div>
  );
};
