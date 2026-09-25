import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, X, Sparkles, Check, ArrowRight, Loader2, RefreshCw, AlertCircle, ShoppingBag, Utensils, Car, Play, Heart, Book, MoreHorizontal, Landmark, Tag, Gift, Briefcase, Home, Plane, Wallet, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { parseVoiceTextToTransaction, ParsedVoiceTransaction } from '../services/aiVoiceService';
import { addTransaction } from '../services/firestoreService';
import { formatCurrency, cn } from '@/src/lib/utils';
import { getLocalToday } from '../lib/dateUtils';

interface VoiceExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ICON_MAP: Record<string, any> = {
  ShoppingBag, Utensils, Car, Play, Heart, Book, MoreHorizontal, 
  Landmark, Tag, Gift, Briefcase, Home, Plane, Wallet
};

const IconComponent = ({ name, size = 20 }: { name: string, size?: number }) => {
  const Icon = ICON_MAP[name] || MoreHorizontal;
  return <Icon size={size} />;
};

export const VoiceExpenseModal: React.FC<VoiceExpenseModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { categories, projects, transactions } = useData();
  const { profile } = useAuth();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedTx, setParsedTx] = useState<ParsedVoiceTransaction | null>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize SpeechRecognition if supported
  useEffect(() => {
    if (isOpen) {
      setTranscript('');
      setParsedTx(null);
      setError(null);
      
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'es-ES';

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          if (event.error !== 'no-speech') {
            setError('No pudimos escuchar con claridad. Intenta de nuevo.');
            setIsListening(false);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        startListening();
      } else {
        setError('Tu navegador no soporta el reconocimiento de voz nativo.');
      }
    } else {
      stopListening();
    }

    return () => {
      stopListening();
    };
  }, [isOpen]);

  const startListening = () => {
    setError(null);
    setTranscript('');
    setParsedTx(null);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error('Error starting recognition:', e);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
    }
    setIsListening(false);
  };

  const handleAnalyze = async () => {
    if (!transcript.trim()) {
      setError('Por favor dicta o di la frase de tu gasto.');
      return;
    }
    stopListening();
    setIsAnalyzing(true);
    setError(null);

    try {
      const activeProjects = projects.filter(p => (p as any).status !== 'inactive');
      const result = await parseVoiceTextToTransaction(transcript, categories, activeProjects, transactions);
      setParsedTx(result);
    } catch (err: any) {
      console.error('Error analyzing voice text:', err);
      setError('Ocurrió un inconveniente al interpretar la voz con la IA. Intenta nuevamente.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmAndSave = async () => {
    if (!parsedTx) return;
    setIsSaving(true);
    setError(null);

    try {
      // Find matching category object
      const matchedCategory = categories.find(c => 
        c.name.toLowerCase() === parsedTx.categoryName.toLowerCase() && c.type === parsedTx.type
      ) || categories.find(c => c.type === parsedTx.type) || categories[0];

      // Find matching project object
      const activeProjects = projects.filter(p => (p as any).status !== 'inactive');
      const matchedProject = parsedTx.projectName 
        ? activeProjects.find(p => p.name.toLowerCase().includes(parsedTx.projectName!.toLowerCase()))
        : null;

      const transactionData = {
        amount: parsedTx.amount,
        type: parsedTx.type,
        description: parsedTx.description,
        date: getLocalToday(),
        paymentMethod: parsedTx.paymentMethod,
        classification: parsedTx.classification,
        categoryId: matchedCategory?.id || 'system_otros',
        categoryName: matchedCategory?.name || parsedTx.categoryName,
        categoryIcon: matchedCategory?.icon || 'MoreHorizontal',
        categoryColor: matchedCategory?.color || 'bg-slate-500',
        projectId: parsedTx.destinationType === 'shared' && matchedProject ? matchedProject.id : null
      };

      await addTransaction(transactionData);
      onClose();
    } catch (err) {
      console.error('Error saving transaction from voice:', err);
      setError('Error al guardar la transacción en Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-surface-container-lowest w-full max-w-lg rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative z-10 overflow-hidden border border-on-surface/10"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-on-surface font-headline">Asistente por Voz IA</h3>
                <p className="text-xs text-on-surface-variant/60 font-bold uppercase tracking-wider">Dicta tu gasto o ingreso</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2.5 text-on-surface-variant/40 hover:text-on-surface hover:bg-on-surface/5 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Body content depending on state */}
          {!parsedTx ? (
            <div className="flex flex-col items-center py-6 text-center space-y-6">
              {/* Animated Microphone */}
              <div className="relative flex items-center justify-center">
                {isListening && (
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute inset-0 bg-rose-500/20 rounded-full"
                  />
                )}
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isAnalyzing}
                  className={cn(
                    "w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-xl relative z-10 active:scale-95",
                    isListening ? "bg-rose-500 text-white shadow-rose-500/30" : "bg-primary text-white shadow-primary/30 hover:opacity-90"
                  )}
                >
                  {isAnalyzing ? (
                    <Loader2 size={40} className="animate-spin" />
                  ) : isListening ? (
                    <Mic size={40} className="animate-pulse" />
                  ) : (
                    <Mic size={40} />
                  )}
                </button>
              </div>

              {/* Status Message */}
              <div>
                <h4 className="text-lg font-bold text-on-surface font-headline">
                  {isAnalyzing ? 'Interpretando dictado con IA...' : isListening ? 'Escuchando tu voz...' : 'Toca el micrófono para dictar'}
                </h4>
                <p className="text-xs text-on-surface-variant mt-1.5 max-w-xs mx-auto">
                  Ejemplo: <span className="font-bold text-primary">"Gasté 4500 pesos en supermercado con tarjeta"</span>
                </p>
              </div>

              {/* Live Transcript Display */}
              {transcript && (
                <div className="w-full bg-surface-container-low p-4 rounded-2xl border border-on-surface/5 text-left">
                  <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest block mb-1">Transcripción en vivo</span>
                  <p className="text-sm font-semibold text-on-surface italic">"{transcript}"</p>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-500/10 text-rose-600 rounded-xl text-xs font-bold w-full">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 w-full pt-2">
                {isListening ? (
                  <button
                    onClick={stopListening}
                    className="flex-1 py-3.5 bg-on-surface/5 text-on-surface rounded-2xl font-bold text-sm hover:bg-on-surface/10 transition-colors"
                  >
                    Detener Grabación
                  </button>
                ) : (
                  <button
                    onClick={handleAnalyze}
                    disabled={!transcript.trim() || isAnalyzing}
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold text-base shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Analizando...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        <span>Procesar con IA</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Result Confirmation Screen */
            <div className="space-y-5">
              <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 text-center">
                <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Resultado Detectado por IA</span>
                <div className="text-3xl font-black font-headline text-on-surface mt-1">
                  {formatCurrency(parsedTx.amount, profile?.currency || 'ARS')}
                </div>
                <p className="text-xs font-bold text-on-surface-variant/70 mt-1">{parsedTx.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-surface-container-low p-3.5 rounded-2xl border border-on-surface/5">
                  <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest block mb-1">Tipo</span>
                  <span className={cn("font-bold uppercase tracking-wider", parsedTx.type === 'expense' ? "text-rose-600" : "text-emerald-600")}>
                    {parsedTx.type === 'expense' ? 'Gasto' : 'Ingreso'}
                  </span>
                </div>

                <div className="bg-surface-container-low p-3.5 rounded-2xl border border-on-surface/5">
                  <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest block mb-1">Categoría</span>
                  <span className="font-bold text-on-surface">{parsedTx.categoryName}</span>
                </div>

                <div className="bg-surface-container-low p-3.5 rounded-2xl border border-on-surface/5">
                  <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest block mb-1">Método de Pago</span>
                  <span className="font-bold text-on-surface">{parsedTx.paymentMethod}</span>
                </div>

                <div className="bg-surface-container-low p-3.5 rounded-2xl border border-on-surface/5">
                  <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest block mb-1">Destino</span>
                  <span className="font-bold text-on-surface">{parsedTx.destinationType === 'shared' ? (parsedTx.projectName || 'Compartido') : 'Personal'}</span>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-500/10 text-rose-600 rounded-xl text-xs font-bold">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Confirm & Save Actions */}
              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  onClick={handleConfirmAndSave}
                  disabled={isSaving}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-base shadow-xl shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      <span>Guardando en Firestore...</span>
                    </>
                  ) : (
                    <>
                      <Check size={20} strokeWidth={2.5} />
                      <span>Confirmar y Guardar Gasto</span>
                    </>
                  )}
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={startListening}
                    disabled={isSaving}
                    className="flex-1 py-3 bg-on-surface/5 hover:bg-on-surface/10 text-on-surface rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw size={14} />
                    <span>Volver a dictar</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
