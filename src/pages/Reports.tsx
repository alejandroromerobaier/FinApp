import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft,
  ArrowRight,
  Download, 
  Mail, 
  Copy, 
  Check, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  ExternalLink,
  FileText,
  TrendingUp,
  Tag,
  ShieldCheck,
  ShoppingBag, 
  Utensils, 
  Car, 
  Play, 
  Heart, 
  Book, 
  MoreHorizontal, 
  Landmark, 
  Gift, 
  Briefcase, 
  Home as HomeIcon, 
  Plane, 
  Coffee, 
  Zap, 
  Smartphone
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { formatCurrency, cn } from '@/src/lib/utils';
import logo from '../assets/logo.png';

const ICON_MAP: Record<string, any> = {
  ShoppingBag, Utensils, Car, Play, Heart, Book, MoreHorizontal, 
  Landmark, Tag, Gift, Briefcase, HomeIcon, Plane, Coffee, Zap, Smartphone, ShieldCheck
};

const IconComponent = ({ name, size = 20 }: { name: string, size?: number }) => {
  const Icon = ICON_MAP[name] || MoreHorizontal;
  return <Icon size={size} />;
};

import { generateProfessionalPDF } from '../services/pdfService';
import { generateProfessionalCSV, downloadCSV } from '../services/csvService';
import { getBudgetsOnce } from '../services/firestoreService';
import { getLocalMonth } from '../lib/dateUtils';

export const Reports: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { transactions, categories, projects, userEmails, budgets, userNames } = useData();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [periodBudgets, setPeriodBudgets] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'quarterly' | 'semiannual' | 'annual'>('monthly');
  const [copied, setCopied] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [targetEmails, setTargetEmails] = useState<string[]>([]);
  const [customEmail, setCustomEmail] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeCurrency, setActiveCurrency] = useState(profile?.currency || 'ARS');

  // Sync active currency when project changes
  useEffect(() => {
    if (selectedProjectId !== 'all') {
      const proj = projects.find(p => p.id === selectedProjectId);
      if (proj?.currency) {
        setActiveCurrency(proj.currency);
      }
    }
  }, [selectedProjectId, projects]);

  const projectMembers = useMemo(() => {
    const emails = new Set<string>();
    const involvedProjects = projects.filter(p => 
      transactions.some(t => t.projectId === p.id && 
        new Date(t.date).getMonth() === currentDate.getMonth() && 
        new Date(t.date).getFullYear() === currentDate.getFullYear())
    );
    
    involvedProjects.forEach(p => {
      p.memberIds?.forEach(mid => {
        if (userEmails[mid] && userEmails[mid] !== user?.email) {
          emails.add(userEmails[mid]);
        }
      });
    });
    
    return Array.from(emails);
  }, [projects, transactions, currentDate, userEmails, user]);
  
  // Fetch budgets for the entire selected period
  useEffect(() => {
    const fetchPeriodBudgets = async () => {
      const months: string[] = [];
      const d = new Date(currentDate);
      
      if (selectedPeriod === 'monthly') {
        months.push(getLocalMonth(d));
      } else if (selectedPeriod === 'quarterly') {
        const startMonth = Math.floor(d.getMonth() / 3) * 3;
        for (let i = 0; i < 3; i++) {
          const m = new Date(d.getFullYear(), startMonth + i, 1);
          months.push(getLocalMonth(m));
        }
      } else if (selectedPeriod === 'semiannual') {
        const startMonth = Math.floor(d.getMonth() / 6) * 6;
        for (let i = 0; i < 6; i++) {
          const m = new Date(d.getFullYear(), startMonth + i, 1);
          months.push(getLocalMonth(m));
        }
      } else if (selectedPeriod === 'annual') {
        for (let i = 0; i < 12; i++) {
          const m = new Date(d.getFullYear(), i, 1);
          months.push(getLocalMonth(m));
        }
      }

      try {
        const projectIds = projects.map(p => p.id);
        const allBudgets: any[] = [];
        
        // Fetch budgets for each month in the period
        // Optimization: In a real app we might batch this, but since monthly/quarterly is 1-12 calls, it's fine for now.
        for (const m of months) {
          const monthBudgets = await getBudgetsOnce(m, projectIds);
          allBudgets.push(...monthBudgets);
        }
        
        setPeriodBudgets(allBudgets);
      } catch (err) {
        console.error("Error fetching period budgets:", err);
      }
    };

    fetchPeriodBudgets();
  }, [currentDate, selectedPeriod, projects]);



  const activeProjects = useMemo(() => {
    return projects.filter(p => (p.status || 'active') !== 'inactive');
  }, [projects]);

  const isPersonalActive = (profile?.personalStatus || 'active') !== 'inactive';

  const filteredTransactions = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    let start = new Date(year, month, 1);
    let end = new Date(year, month + 1, 0, 23, 59, 59, 999);

    if (selectedPeriod === 'quarterly') {
      const q = Math.floor(month / 3);
      start = new Date(year, q * 3, 1);
      end = new Date(year, (q + 1) * 3, 0, 23, 59, 59, 999);
    } else if (selectedPeriod === 'semiannual') {
      const s = Math.floor(month / 6);
      start = new Date(year, s * 6, 1);
      end = new Date(year, (s + 1) * 6, 0, 23, 59, 59, 999);
    } else if (selectedPeriod === 'annual') {
      start = new Date(year, 0, 1);
      end = new Date(year, 12, 0, 23, 59, 59, 999);
    }

    return transactions.filter(t => {
      if (t.projectId) {
        const proj = projects.find(p => p.id === t.projectId);
        if (proj && proj.status === 'inactive') return false;
      } else {
        if (!isPersonalActive) return false;
      }

      const td = new Date(t.date);
      const matchesPeriod = td >= start && td <= end;
      const matchesProject = selectedProjectId === 'all' ? true : t.projectId === selectedProjectId;
      return matchesPeriod && matchesProject;
    });
  }, [transactions, currentDate, selectedProjectId, selectedPeriod, projects, isPersonalActive]);

  const stats = useMemo(() => {
    const currencyMap: Record<string, { income: number; expenses: number; fixed: number; variable: number; catMap: Record<string, number>; methods: Record<string, number>; projectSplit: { personal: number; shared: number } }> = {};

    filteredTransactions.forEach(t => {
      const project = projects.find(p => p.id === t.projectId);
      const currency = project?.currency || profile?.currency || 'ARS';
      const method = t.paymentMethod || 'Efectivo';

      if (!currencyMap[currency]) {
        currencyMap[currency] = { income: 0, expenses: 0, fixed: 0, variable: 0, catMap: {}, methods: {}, projectSplit: { personal: 0, shared: 0 } };
      }

      if (t.type === 'income') {
        currencyMap[currency].income += t.amount;
        if (t.projectId) currencyMap[currency].projectSplit.shared += t.amount;
        else currencyMap[currency].projectSplit.personal += t.amount;
      } else {
        currencyMap[currency].expenses += t.amount;
        
        // Track classification
        if (t.classification === 'fixed') {
          currencyMap[currency].fixed += t.amount;
        } else {
          currencyMap[currency].variable += t.amount;
        }

        if (t.projectId) currencyMap[currency].projectSplit.shared -= t.amount;
        else currencyMap[currency].projectSplit.personal -= t.amount;

        // Categories
        const cat = categories.find(c => c.id === t.categoryId);
        const name = cat?.name || t.categoryName || 'Varios';
        currencyMap[currency].catMap[name] = (currencyMap[currency].catMap[name] || 0) + t.amount;

        // Methods
        currencyMap[currency].methods[method] = (currencyMap[currency].methods[method] || 0) + t.amount;
      }
    });

    if (Object.keys(currencyMap).length === 0) {
      const defaultCurrency = profile?.currency || 'ARS';
      currencyMap[defaultCurrency] = { income: 0, expenses: 0, fixed: 0, variable: 0, catMap: {}, methods: {}, projectSplit: { personal: 0, shared: 0 } };
    }

    return currencyMap;
  }, [filteredTransactions, categories, projects, profile]);
  
  const currentStats = useMemo(() => {
    return stats[activeCurrency] || Object.values(stats)[0] || { income: 0, expenses: 0, fixed: 0, variable: 0, catMap: {}, methods: {}, projectSplit: { personal: 0, shared: 0 } };
  }, [stats, activeCurrency]);

  const budgetAnalysis = useMemo(() => {
    const analysis: Record<string, { budgeted: number; actual: number; category: any }> = {};
    
    // 1. Initialize with transactions
    Object.entries(currentStats.catMap).forEach(([name, actual]) => {
      const category = categories.find(c => c.name === name);
      analysis[name] = { 
        budgeted: 0, 
        actual, 
        category: category || { name, icon: 'MoreHorizontal', color: 'bg-slate-400' } 
      };
    });

    // 2. Add budgets
    periodBudgets.forEach(b => {
      const category = categories.find(c => c.id === b.categoryId);
      if (!category) return;
      
      // Filter by project if not 'all'
      if (selectedProjectId !== 'all' && b.projectId !== selectedProjectId) return;
      if (selectedProjectId === 'all' && b.projectId) {
         // Shared budgets in 'all' view? 
         // For 'all' view, we sum everything the user has access to.
      }

      const name = category.name;
      if (!analysis[name]) {
        analysis[name] = { budgeted: 0, actual: 0, category };
      }
      analysis[name].budgeted += b.amount;
    });

    return Object.entries(analysis)
      .sort((a, b) => b[1].actual - a[1].actual);
  }, [currentStats, periodBudgets, categories, selectedProjectId]);

  const sortedCategories = useMemo(() => {
    return Object.entries(currentStats.catMap).sort((a, b) => b[1] - a[1]);
  }, [currentStats]);

  const trendData = useMemo(() => {
    const data: { label: string; income: number; expenses: number }[] = [];
    const baseDate = new Date(currentDate);

    if (selectedPeriod === 'monthly') {
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
        const l = d.toLocaleString('es-ES', { month: 'short' });
        
        const mTransactions = transactions.filter(t => {
          const td = new Date(t.date);
          const project = projects.find(p => p.id === t.projectId);
          const tCurrency = project?.currency || profile?.currency || 'ARS';
          const matchesDate = td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
          const matchesProject = selectedProjectId === 'all' ? true : t.projectId === selectedProjectId;
          return matchesDate && matchesProject && tCurrency === activeCurrency;
        });

        const income = mTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expenses = mTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        data.push({ label: l, income, expenses });
      }
    } else {
      // Internal breakdown: 3 for quarterly, 6 for semi, 12 for annual
      let months = 12;
      let startMonth = 0;
      const year = baseDate.getFullYear();
      
      if (selectedPeriod === 'quarterly') {
        months = 3;
        startMonth = Math.floor(baseDate.getMonth() / 3) * 3;
      } else if (selectedPeriod === 'semiannual') {
        months = 6;
        startMonth = Math.floor(baseDate.getMonth() / 6) * 6;
      }

      for (let i = 0; i < months; i++) {
        const m = startMonth + i;
        const d = new Date(year, m, 1);
        const l = d.toLocaleString('es-ES', { month: 'short' });

        const mTransactions = transactions.filter(t => {
          const td = new Date(t.date);
          const project = projects.find(p => p.id === t.projectId);
          const tCurrency = project?.currency || profile?.currency || 'ARS';
          const matchesDate = td.getMonth() === m && td.getFullYear() === year;
          const matchesProject = selectedProjectId === 'all' ? true : t.projectId === selectedProjectId;
          return matchesDate && matchesProject && tCurrency === activeCurrency;
        });

        const income = mTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expenses = mTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        data.push({ label: l, income, expenses });
      }
    }

    return data;
  }, [transactions, currentDate, selectedPeriod, selectedProjectId, activeCurrency, profile, projects]);

  const periodLabel = useMemo(() => {
    const year = currentDate.getFullYear();
    if (selectedPeriod === 'monthly') return currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    if (selectedPeriod === 'quarterly') {
      const q = Math.floor(currentDate.getMonth() / 3) + 1;
      return `Trimestre ${q} - ${year}`;
    }
    if (selectedPeriod === 'semiannual') {
      const s = Math.floor(currentDate.getMonth() / 6) + 1;
      return `Semestre ${s} - ${year}`;
    }
    return `Año ${year}`;
  }, [currentDate, selectedPeriod]);

  const changeMonth = (offset: number) => {
    const next = new Date(currentDate);
    if (selectedPeriod === 'monthly') next.setMonth(next.getMonth() + offset);
    else if (selectedPeriod === 'quarterly') next.setMonth(next.getMonth() + (offset * 3));
    else if (selectedPeriod === 'semiannual') next.setMonth(next.getMonth() + (offset * 6));
    else if (selectedPeriod === 'annual') next.setFullYear(next.getFullYear() + offset);
    setCurrentDate(next);
  };

  const getLogoBase64 = async () => {
    try {
      const response = await fetch(logo);
      const blob = await response.blob();
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error('Error loading logo for PDF', e);
      return undefined;
    }
  };

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    try {
      const project = selectedProjectId !== 'all' ? projects.find(p => p.id === selectedProjectId) : null;
      const logoBase64 = await getLogoBase64();
      const doc = await generateProfessionalPDF({
        title: project ? `Reporte de Proyecto: ${project.name}` : 'Reporte Financiero de Estado',
        monthName: periodLabel,
        currency: activeCurrency,
        stats: currentStats,
        transactions: filteredTransactions,
        categories,
        projects,
        userName: user?.displayName || 'Usuario FinApp',
        userEmail: user?.email || 'user@example.com',
        profileCurrency: profile?.currency,
        logoBase64
      });
      doc.save(`reporte_${activeCurrency}_${periodLabel.replace(' ', '_')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error al generar el PDF. El sistema ha registrado el incidente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadCSV = () => {
    setIsGenerating(true);
    try {
      const project = selectedProjectId !== 'all' ? projects.find(p => p.id === selectedProjectId) : null;
      const content = generateProfessionalCSV({
        title: project ? `Exportación: ${project.name}` : `Exportación de Datos - ${activeCurrency}`,
        monthName: periodLabel,
        currency: activeCurrency,
        transactions: filteredTransactions.filter(t => {
          const p = projects.find(pr => pr.id === t.projectId);
          const tCurrency = p?.currency || profile?.currency || 'ARS';
          return tCurrency === activeCurrency;
        }),
        categories,
        projects,
        userName: user?.displayName || 'Usuario',
        userNames: userNames
      });
      downloadCSV(content, `FinApp_Data_${activeCurrency}_${periodLabel.replace(' ', '_')}`);
    } catch (err) {
      console.error("CSV export error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendReport = async () => {
    setIsGenerating(true);
    try {
      const project = selectedProjectId !== 'all' ? projects.find(p => p.id === selectedProjectId) : null;
      const logoBase64 = await getLogoBase64();
      const doc = await generateProfessionalPDF({
        title: project ? `Reporte: ${project.name}` : 'Reporte Financiero de Estado',
        monthName: periodLabel,
        currency: activeCurrency,
        stats: currentStats,
        transactions: filteredTransactions,
        categories,
        projects,
        userName: user?.displayName || 'Usuario FinApp',
        userEmail: user?.email || 'user@example.com',
        profileCurrency: profile?.currency,
        logoBase64
      });
      
      const fileName = `reporte_${activeCurrency}_${periodLabel.replace(' ', '_')}.pdf`;
      doc.save(fileName);
      
      const subject = encodeURIComponent(`FinApp: Reporte ${periodLabel} - ${activeCurrency}`);
      const body = encodeURIComponent(`Hola,\n\nAdjunto verán el reporte financiero detallado del periodo ${periodLabel} generado por FinApp.\n\nResumen Detallado:\n- Ingresos: ${formatCurrency(currentStats.income, activeCurrency)}\n- Gastos: ${formatCurrency(currentStats.expenses, activeCurrency)}\n- Balance Final: ${formatCurrency(currentStats.income - currentStats.expenses, activeCurrency)}\n\nReporte generado por: ${user?.displayName || user?.email}\n\n[IMPORTANTE: El archivo "${fileName}" se ha descargado automáticamente en su carpeta de Descargas. Por favor, adjúntelo a este correo antes de enviarlo.]`);
      
      const recipients = targetEmails.join(',');
      
      setTimeout(() => {
        window.location.href = `mailto:${recipients}?subject=${subject}&body=${body}`;
        setShowEmailModal(false);
        setTargetEmails([]);
      }, 500);
      
    } catch (error) {
      console.error('Error sending report:', error);
      alert('Ocurrió un error al preparar el reporte.');
    } finally {
      setIsGenerating(false);
    }
  };

  const addCustomEmail = () => {
    if (customEmail && /^\S+@\S+\.\S+$/.test(customEmail)) {
      setTargetEmails(prev => Array.from(new Set([...prev, customEmail])));
      setCustomEmail('');
    }
  };

  const removeEmail = (email: string) => {
    setTargetEmails(prev => prev.filter(e => e !== email));
  };

  return (
    <div className="min-h-screen bg-surface pb-32">
      {/* Header */}
      <header className="sticky top-0 w-full z-40 flex items-center justify-between px-6 h-20 glass-header">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-on-surface p-2.5 bg-on-surface/5 hover:bg-on-surface/10 rounded-2xl transition-all active:scale-90">
            <ArrowLeft size={22} />
          </button>
          <div className="flex flex-col">
            <span className="text-xs font-black text-primary uppercase tracking-[0.2em] opacity-60 leading-none mb-1">Análisis Pro</span>
            <span className="text-xl font-black tracking-tight text-on-surface font-headline">Reporte de Estado</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
             onClick={() => setShowEmailModal(true)}
             className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-2xl hover:bg-emerald-500/20 transition-all active:scale-95 flex items-center gap-2"
          >
            <Mail size={20} />
            <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Enviar</span>
          </button>
          <button 
             onClick={handleDownloadPDF}
             disabled={isGenerating}
             className="p-2.5 bg-primary/10 text-primary rounded-2xl hover:bg-primary/20 transition-all active:scale-95 flex items-center gap-2"
          >
            <FileText size={20} />
            <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">{isGenerating ? '...' : 'PDF'}</span>
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 pt-8 space-y-12">
        {/* Period & Currency Selectors */}
        <section className="space-y-6">
          <div className="flex bg-surface-container-low p-1.5 rounded-2xl border border-on-surface/5 gap-1">
            {[
              { id: 'monthly', label: 'Mensual' },
              { id: 'quarterly', label: 'Trimestral' },
              { id: 'semiannual', label: 'Semestral' },
              { id: 'annual', label: 'Anual' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPeriod(p.id as any)}
                className={cn(
                  "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  selectedPeriod === p.id 
                    ? "bg-slate-900 text-white shadow-lg" 
                    : "text-on-surface-variant/40 hover:bg-on-surface/5"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-black p-8 rounded-[2.5rem] border border-white/10 shadow-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[50px] rounded-full -mr-16 -mt-16" />
            <div className="relative z-10 flex items-center justify-between">
              <button onClick={() => changeMonth(-1)} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-all text-white active:scale-90 border border-white/5">
                <ChevronLeft size={24} />
              </button>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-primary/80 mb-2">
                  <Calendar size={14} className="animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">Ventana Temporal</span>
                </div>
                <h2 className="text-2xl font-black text-white capitalize font-headline tracking-tight">{periodLabel}</h2>
              </div>
              <button onClick={() => changeMonth(1)} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-all text-white active:scale-90 border border-white/5">
                <ChevronRight size={24} />
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none px-1">
             <button
                onClick={() => setSelectedProjectId('all')}
                className={cn(
                  "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2",
                  selectedProjectId === 'all' 
                    ? "bg-slate-900 border-slate-900 text-white shadow-lg" 
                    : "bg-surface-container-low border-on-surface/5 text-on-surface-variant hover:border-primary/20"
                )}
              >
                Todos los Proyectos
              </button>
              {activeProjects.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  className={cn(
                    "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2",
                    selectedProjectId === p.id 
                      ? "bg-primary border-primary text-white shadow-lg shadow-primary/20" 
                      : "bg-surface-container-low border-on-surface/5 text-on-surface-variant hover:border-primary/20"
                  )}
                >
                  {p.name}
                </button>
              ))}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none px-1">
             {Object.keys(stats).map(curr => (
                <button
                  key={curr}
                  onClick={() => setActiveCurrency(curr)}
                  className={cn(
                    "px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border-2",
                    activeCurrency === curr 
                      ? "bg-primary border-primary text-white shadow-lg shadow-primary/20" 
                      : "bg-surface-container-low border-on-surface/5 text-on-surface-variant hover:border-primary/20"
                  )}
                >
                  {curr}
                </button>
              ))}
          </div>
        </section>

        {/* Executive Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-surface-container-lowest p-8 rounded-[2.5rem] border border-on-surface/5 shadow-sm group transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shadow-inner">
                <BarChart3 size={20} />
              </div>
              <span className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em]">Ingresos Totales</span>
            </div>
            <p className="text-3xl font-black text-on-surface font-headline tracking-tighter mb-2">{formatCurrency(currentStats.income, activeCurrency)}</p>
            <div className="w-full h-2 bg-on-surface/5 rounded-full overflow-hidden shadow-inner">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                className="h-full bg-emerald-500 rounded-full"
              />
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-surface-container-lowest p-8 rounded-[2.5rem] border border-on-surface/5 shadow-sm group transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 shadow-inner">
                <TrendingUp size={20} />
              </div>
              <span className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em]">Gastos Totales</span>
            </div>
            <p className="text-3xl font-black text-on-surface font-headline tracking-tighter mb-2">{formatCurrency(currentStats.expenses, activeCurrency)}</p>
            <div className="w-full h-2 bg-on-surface/5 rounded-full overflow-hidden shadow-inner">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((currentStats.expenses / (currentStats.income || 1)) * 100, 100)}%` }}
                className="h-full bg-rose-500 rounded-full"
              />
            </div>
          </motion.div>
        </div>

        {/* Comparative Trend Analysis */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.3em] flex items-center gap-2">
              <TrendingUp size={14} className="text-primary" /> Visualización de Tendencias
            </h3>
            <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest">
              Análisis {selectedPeriod}
            </span>
          </div>

          <div className="bg-surface-container-lowest p-8 rounded-[2.5rem] border border-on-surface/5 shadow-sm relative overflow-hidden">
            <div className="flex items-end justify-between h-48 gap-3">
              {trendData.map((d, i) => {
                const max = Math.max(...trendData.map(x => Math.max(x.income, x.expenses)), 1);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-3 group relative h-full justify-end">
                    <div className="flex gap-1 w-full items-end justify-center h-full">
                      {/* Income Bar */}
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${(d.income / max) * 100}%` }}
                        className="w-1.5 min-w-[6px] bg-emerald-500 rounded-full group-hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
                      />
                      {/* Expense Bar */}
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${(d.expenses / max) * 100}%` }}
                        className="w-1.5 min-w-[6px] bg-rose-500 rounded-full group-hover:shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-all"
                      />
                    </div>
                    <span className="text-[9px] font-black text-on-surface-variant/40 uppercase group-hover:text-on-surface transition-colors">
                      {d.label}
                    </span>

                    {/* Hover Tooltip */}
                    <div className="absolute bottom-full mb-4 opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-20 scale-90 group-hover:scale-100">
                      <div className="bg-slate-900 border border-white/10 p-3 rounded-2xl shadow-2xl text-xs space-y-1.5 min-w-[120px]">
                        <p className="font-black text-white/40 uppercase text-[8px] tracking-widest">{d.label} Details</p>
                        <div className="flex justify-between items-center gap-4">
                          <span className="text-emerald-400 font-bold">Inc</span>
                          <span className="text-white font-black">{formatCurrency(d.income, activeCurrency)}</span>
                        </div>
                        <div className="flex justify-between items-center gap-4">
                          <span className="text-rose-400 font-bold">Exp</span>
                          <span className="text-white font-black">{formatCurrency(d.expenses, activeCurrency)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-8 pt-6 border-t border-on-surface/5 flex justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">Ingresos</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">Gastos</span>
              </div>
            </div>
          </div>
        </section>

        {/* Formal Document Preview */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.3em] flex items-center gap-2">
              <FileText size={14} className="text-primary" /> Certificado de Estado Financiero
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(`Reporte ${periodLabel}: Ingresos ${formatCurrency(currentStats.income, activeCurrency)}, Gastos ${formatCurrency(currentStats.expenses, activeCurrency)}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  copied ? "bg-emerald-500 text-white" : "bg-on-surface/5 text-on-surface hover:bg-on-surface/10"
                )}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copiado' : 'Copiar Resumen'}
              </button>
            </div>
          </div>
          
          <div className="bg-white rounded-[2.5rem] p-10 sm:p-16 shadow-2xl border border-on-surface/5 relative group">
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none select-none overflow-hidden" 
                 style={{ backgroundImage: 'radial-gradient(#000 1.5px, transparent 1.5px)', backgroundSize: '32px 32px' }} />
            
            <div className="relative z-10 space-y-10">
              <div className="flex items-start justify-between border-b-2 border-slate-100 pb-10">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center p-3 shadow-lg group-hover:scale-110 transition-transform duration-500">
                    <img src={logo} alt="FinApp Logo" className="w-full h-full object-contain invert" />
                  </div>
                  <div>
                    <h4 className="text-3xl font-black text-slate-900 font-headline tracking-tighter mb-0.5">FINAPP</h4>
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.5em]">Consolidated Intelligence</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">ID Documento</p>
                  <p className="text-[10px] font-bold text-slate-900 font-mono">#{currentDate.getTime().toString(16).toUpperCase()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-16 py-4">
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-l-3 border-primary pl-4 mb-4">Estado de Resultados</p>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Ingresos</span>
                        <span className="font-bold text-emerald-600">+{formatCurrency(currentStats.income, activeCurrency)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Gastos</span>
                        <span className="font-bold text-rose-600">-{formatCurrency(currentStats.expenses, activeCurrency)}</span>
                      </div>
                      <div className="pt-3 border-t border-slate-100 flex justify-between">
                        <span className="font-black text-slate-900 uppercase text-[11px] tracking-tight">Superávit/Déficit</span>
                        <span className={cn("text-lg font-black font-headline", currentStats.income - currentStats.expenses >= 0 ? "text-emerald-700" : "text-rose-700")}>
                          {formatCurrency(currentStats.income - currentStats.expenses, activeCurrency)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-l-3 border-indigo-500 pl-4 mb-4">Top Categorías</p>
                    <div className="space-y-3">
                      {sortedCategories.slice(0, 4).map(([name, amount]) => (
                        <div key={name} className="space-y-1">
                          <div className="flex justify-between text-[11px] items-center">
                            <span className="text-slate-500 truncate mr-4">{name}</span>
                            <span className="font-bold text-slate-900">{formatCurrency(amount, activeCurrency)}</span>
                          </div>
                          <div className="w-full h-1 bg-slate-50 rounded-full overflow-hidden">
                            <div className="h-full bg-slate-200 rounded-full" style={{ width: `${(amount / (currentStats.expenses || 1)) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-12 border-t border-slate-100 flex items-end justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg">
                    <ShieldCheck size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Cifrado de Seguridad</p>
                    <p className="text-[9px] font-bold text-slate-900 uppercase">AES-256 Verificado</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest italic tracking-tight">Reporte verificado para {user?.displayName}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Budget vs Actual Detail */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.3em] flex items-center gap-2">
              <TrendingUp size={14} className="text-primary" /> Ejecución Presupuestaria
            </h3>
            <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest">
              Gasto vs Meta
            </span>
          </div>

          <div className="space-y-4">
            {budgetAnalysis.filter(([, data]) => data.budgeted > 0 || data.actual > 0).map(([name, data], idx) => {
              const percent = data.budgeted > 0 ? (data.actual / data.budgeted) * 100 : 0;
              const isOver = percent > 100;
              
              return (
                <motion.div 
                  key={name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-surface-container-lowest p-6 rounded-[2rem] border border-on-surface/5 flex flex-col gap-4 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white", data.category.color)}>
                         <IconComponent name={data.category.icon} size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-on-surface text-sm uppercase tracking-tight">{name}</p>
                        <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-widest">
                          {data.budgeted > 0 ? `${percent.toFixed(0)}% ejecutado` : 'Sin presupuesto'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-on-surface tracking-tighter text-base">
                        {formatCurrency(data.actual, activeCurrency)}
                      </p>
                      {data.budgeted > 0 && (
                        <p className="text-[10px] font-bold text-on-surface-variant/40">
                          Meta: {formatCurrency(data.budgeted, activeCurrency)}
                        </p>
                      )}
                    </div>
                  </div>

                  {data.budgeted > 0 && (
                    <div className="space-y-2">
                      <div className="w-full h-2 bg-on-surface/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(percent, 100)}%` }}
                          className={cn(
                            "h-full rounded-full",
                            isOver ? "bg-rose-500" : percent > 85 ? "bg-amber-500" : "bg-emerald-500"
                          )}
                        />
                      </div>
                      <div className="flex justify-between items-center px-1">
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest",
                          isOver ? "text-rose-500" : "text-emerald-600"
                        )}>
                          {isOver ? 'Presupuesto excedido' : 'Dentro del presupuesto'}
                        </span>
                        <span className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest">
                          Restante: {formatCurrency(Math.max(0, data.budgeted - data.actual), activeCurrency)}
                        </span>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Floating Action Bar */}
      <div className="fixed bottom-8 sm:bottom-12 left-1/2 -translate-x-1/2 z-50 px-6 w-full max-w-sm sm:max-w-md">
        <div className="flex gap-3 items-center">
          <button 
            onClick={handleDownloadPDF}
            disabled={isGenerating}
            className="flex-1 h-18 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-[0.1em] text-[10px] flex items-center justify-center gap-3 shadow-2xl shadow-slate-900/30 hover:scale-[1.02] active:scale-95 transition-all border border-white/10 group group-hover:bg-slate-800"
          >
            <Download size={18} />
            <span>{isGenerating ? '...' : '.PDF de Estado'}</span>
          </button>
          
          <button 
            onClick={handleDownloadCSV}
            disabled={isGenerating}
            className="w-18 h-18 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-[10px] flex flex-col items-center justify-center gap-1 shadow-2xl shadow-indigo-600/30 hover:scale-[1.02] active:scale-95 transition-all border border-white/10 group"
            title="Descargar datos en CSV para Excel"
          >
            <ArrowRight size={18} className="translate-y-[-2px]" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Email Modal */}
      <AnimatePresence>
        {showEmailModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-container-lowest rounded-[2.5rem] p-8 shadow-2xl max-w-lg w-full"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Mail size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-on-surface font-headline tracking-tight">Enviar Reporte</h3>
                    <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">Compartir vía Email</p>
                  </div>
                </div>
                <button onClick={() => setShowEmailModal(false)} className="p-3 bg-on-surface/5 rounded-2xl hover:bg-on-surface/10 transition-colors">
                  <ArrowLeft size={20} className="rotate-90 sm:rotate-0" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 ml-1">Colaboradores</label>
                    {projectMembers.length > 0 && (
                      <button 
                        onClick={() => setTargetEmails(prev => Array.from(new Set([...prev, ...projectMembers])))}
                        className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                      >
                        Añadir Todos
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {projectMembers.map(email => (
                      <div key={email} className="p-4 bg-on-surface/5 rounded-2xl flex items-center justify-between group-hover:bg-on-surface/10 transition-colors">
                         <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 font-black text-[10px]">
                             {email.substring(0,2).toUpperCase()}
                           </div>
                           <span className="text-sm font-bold text-on-surface truncate max-w-[180px]">{email}</span>
                         </div>
                         <button 
                           onClick={() => setTargetEmails(prev => Array.from(new Set([...prev, email])))}
                           disabled={targetEmails.includes(email)}
                           className={cn(
                             "text-[10px] font-black uppercase tracking-widest transition-all",
                             targetEmails.includes(email) ? "text-on-surface-variant/20" : "text-primary hover:scale-105"
                           )}
                         >
                           {targetEmails.includes(email) ? 'Añadido' : 'Añadir'}
                         </button>
                      </div>
                    ))}
                    {projectMembers.length === 0 && (
                      <div className="py-8 text-center bg-on-surface/5 rounded-2xl border border-dashed border-on-surface/10">
                        <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest px-4">
                          No se detectaron miembros con email en este periodo
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 mb-3 ml-1">Añadir Email Personalizado</label>
                  <div className="flex gap-2">
                    <input 
                      type="email"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      placeholder="ejemplo@correo.com"
                      className="flex-1 bg-on-surface/5 border-none rounded-2xl p-4 text-sm font-bold text-on-surface focus:ring-2 focus:ring-primary/20"
                    />
                    <button 
                      onClick={addCustomEmail}
                      className="px-6 bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20"
                    >
                      Añadir
                    </button>
                  </div>
                </div>

                {targetEmails.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 mb-3 ml-1">Para:</label>
                    <div className="flex flex-wrap gap-2">
                      {targetEmails.map(email => (
                        <span key={email} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-bold">
                          {email}
                          <button onClick={() => removeEmail(email)} className="hover:text-rose-400">
                             <Copy size={12} className="rotate-45" /> 
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 flex flex-col gap-3">
                  <button 
                    onClick={handleSendReport}
                    disabled={targetEmails.length === 0 || isGenerating}
                    className="w-full py-5 bg-emerald-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-600/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                  >
                    {isGenerating ? 'Generando...' : 'Descargar y Preparar Mail'}
                    <ExternalLink size={16} />
                  </button>
                  <p className="text-[10px] text-on-surface-variant/40 font-bold text-center italic">
                    * El reporte se descargará y se abrirá tu gestor de correo listo para adjuntar.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
