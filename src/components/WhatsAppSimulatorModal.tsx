import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  Mic, 
  Sparkles, 
  RotateCcw, 
  CheckCheck, 
  Bot,
  User,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/AuthContext';
import { useData } from '../lib/DataContext';
import { processWhatsAppMessage } from '../services/whatsappBotService';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
  actionTaken?: string;
}

interface WhatsAppSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsAppSimulatorModal: React.FC<WhatsAppSimulatorModalProps> = ({
  isOpen,
  onClose
}) => {
  const { user, profile } = useAuth();
  const { categories, projects, transactions, budgets } = useData();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize initial greeting once
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setMessages([
        {
          id: 'welcome',
          sender: 'bot',
          text: `👋 *¡Hola ${profile?.name || user?.displayName || 'Usuario'}!*\n\n` +
            `Este es el *Simulador de WhatsApp de FinApp* (Beta QA).\n` +
            `Todo lo que registres acá impacta en tu base de datos real de Firestore exactamente igual a como funcionará en WhatsApp oficial.\n\n` +
            `Probá escribir o dictar por voz:\n` +
            `• _"Gasté 15.000 en el súper con débito"_\n` +
            `• _"¿Cuánto gasté este mes?"_\n` +
            `• _"¿Cómo vengo con los presupuestos?"_`,
          time: timeStr
        }
      ]);
    }
  }, [isOpen, profile, user, messages.length]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  // Speech recognition setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'es-AR';

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsListening(false);
      };

      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Tu navegador no soporta reconocimiento por voz nativo.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isProcessing) return;

    const now = new Date();
    const userTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      time: userTime
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsProcessing(true);

    try {
      // Build budget dictionary
      const budgetMap: Record<string, number> = {};
      if (budgets && Array.isArray(budgets)) {
        budgets.forEach((b: any) => {
          if (b.categoryName && b.amount) {
            budgetMap[b.categoryName] = b.amount;
          }
        });
      }

      const botContext = {
        userId: user?.uid || '',
        userName: profile?.name || user?.displayName || 'Usuario',
        currency: profile?.currency || 'ARS',
        categories: categories || [],
        projects: projects || [],
        transactions: transactions || [],
        budgets: budgetMap
      };

      const result = await processWhatsAppMessage(text, botContext);

      const botNow = new Date();
      const botTime = `${String(botNow.getHours()).padStart(2, '0')}:${String(botNow.getMinutes()).padStart(2, '0')}`;

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: result.replyText,
        time: botTime,
        actionTaken: result.actionTaken
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error('Error handling simulated message:', err);
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: `⚠️ Hubo un error de conexión al procesar el mensaje. Intentá nuevamente.`,
        time: userTime
      };
      setMessages(prev => [...prev, botMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    handleSend(prompt);
  };

  const clearChat = () => {
    setMessages([]);
  };

  // Helper to format WhatsApp markdown (*bold*, _italic_) into React elements
  const formatWhatsAppText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, lIdx) => {
      // Replace bold *text* with <strong>
      const parts = line.split(/(\*[^*]+\*|_[^_]+_)/g);
      return (
        <span key={lIdx} className="block leading-relaxed">
          {parts.map((part, pIdx) => {
            if (part.startsWith('*') && part.endsWith('*')) {
              return <strong key={pIdx} className="font-extrabold">{part.slice(1, -1)}</strong>;
            }
            if (part.startsWith('_') && part.endsWith('_')) {
              return <em key={pIdx} className="italic text-on-surface/80">{part.slice(1, -1)}</em>;
            }
            return part;
          })}
        </span>
      );
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-lg bg-surface-container rounded-3xl shadow-2xl border border-on-surface/10 flex flex-col overflow-hidden h-[90vh] max-h-[720px]"
        >
          {/* Header WhatsApp style */}
          <div className="bg-[#075e54] text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-white border border-white/20">
                  <Bot size={22} className="text-emerald-300" />
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#075e54]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm tracking-wide">FinApp Bot</h3>
                  <span className="text-[10px] bg-emerald-500/30 text-emerald-200 px-2 py-0.5 rounded-full font-semibold border border-emerald-400/20">
                    QA Tester
                  </span>
                </div>
                <p className="text-[11px] text-emerald-100/80">en línea • Firestore conectado</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                title="Reiniciar chat"
              >
                <RotateCcw size={18} />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                title="Cerrar simulador"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Quick Notice */}
          <div className="bg-emerald-500/10 px-4 py-2 border-b border-emerald-500/15 flex items-center justify-between gap-2 text-[11px] text-emerald-700 dark:text-emerald-300">
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkles size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              Simulador con IA activa (Gemini). Guarda registros reales en tu cuenta.
            </span>
          </div>

          {/* Messages list (WhatsApp wallpaper style) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5]/30 dark:bg-[#0b141a]/40">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm text-xs relative ${
                    msg.sender === 'user'
                      ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-tr-none'
                      : 'bg-surface-container-highest text-on-surface rounded-tl-none border border-on-surface/5'
                  }`}
                >
                  <div className="text-[12.5px]">
                    {formatWhatsAppText(msg.text)}
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-60">
                    <span>{msg.time}</span>
                    {msg.sender === 'user' && (
                      <CheckCheck size={14} className="text-blue-500" />
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-surface-container-highest text-on-surface rounded-2xl rounded-tl-none px-4 py-3 shadow-sm border border-on-surface/5 flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-emerald-500" />
                  <span className="text-xs text-on-surface-variant font-medium">FinApp Bot está escribiendo...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Carousel */}
          <div className="px-3 py-2 bg-surface-container border-t border-on-surface/5 overflow-x-auto flex gap-1.5 no-scrollbar shrink-0">
            {[
              "Gasté 15.000 en el súper con débito",
              "Cargué 40 lucas de nafta en efectivo",
              "¿Cuánto gasté este mes?",
              "¿Cómo vengo con los presupuestos?",
              "Deshacer"
            ].map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickPrompt(prompt)}
                disabled={isProcessing}
                className="shrink-0 text-[11px] font-medium bg-surface hover:bg-surface-container-high px-3 py-1.5 rounded-full border border-on-surface/10 text-on-surface transition-all active:scale-95 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-surface-container-lowest border-t border-on-surface/10 flex items-center gap-2 shrink-0">
            <button
              onClick={toggleListening}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
              }`}
              title={isListening ? 'Detener dictado' : 'Dictar nota de voz'}
            >
              <Mic size={18} />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              placeholder={isListening ? 'Escuchando tu voz...' : 'Escribe un mensaje de WhatsApp...'}
              disabled={isProcessing}
              className="flex-1 bg-surface-container px-4 py-2.5 rounded-2xl text-xs sm:text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />

            <button
              onClick={() => handleSend()}
              disabled={!inputText.trim() || isProcessing}
              className="w-10 h-10 rounded-full bg-[#075e54] hover:bg-[#128c7e] text-white flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
              title="Enviar mensaje"
            >
              <Send size={16} />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
