import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, Legend 
} from 'recharts';
import { 
  Calendar, TrendingUp, TrendingDown, Wallet, Layers, Loader2, ChevronLeft, ChevronRight,
  ArrowUpRight, ArrowDownRight, Activity, PieChart as PieChartIcon, 
  BarChart3, Info, Clock, CreditCard, Target, Zap, Globe, PiggyBank,
  AlertTriangle, AlertCircle, X
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { getTransactions, getBudgets } from '../services/firestoreService';
import { getLocalMonth } from '../lib/dateUtils';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getCategoryIcon } from '../lib/categoryIcons';

type TimeRange = 'today' | 'week' | 'month' | 'lastMonth' | 'year';
type StatsTab = 'overview' | 'categories' | 'stability' | 'members';

const COLOR_MAP: Record<string, string> = {
  // Slate / Gray
  'bg-slate-400': '#94a3b8', 'bg-slate-500': '#64748b', 'bg-slate-600': '#475569',
  'bg-gray-400': '#9ca3af', 'bg-gray-500': '#6b7280', 'bg-gray-600': '#4b5563',
  // Red / Rose
  'bg-red-400': '#f87171', 'bg-red-500': '#ef4444', 'bg-red-600': '#dc2626',
  'bg-rose-400': '#fb7185', 'bg-rose-500': '#f43f5e', 'bg-rose-600': '#e11d48',
  // Orange / Amber / Yellow
  'bg-orange-400': '#fb923c', 'bg-orange-500': '#f97316', 'bg-orange-600': '#ea580c',
  'bg-amber-400': '#fbbf24', 'bg-amber-500': '#f59e0b', 'bg-amber-600': '#d97706',
  'bg-yellow-400': '#facc15', 'bg-yellow-500': '#eab308', 'bg-yellow-600': '#ca8a04',
  // Green / Emerald / Lime
  'bg-lime-400': '#a3e635', 'bg-lime-500': '#84cc16', 'bg-lime-600': '#65a30d',
  'bg-green-400': '#4ade80', 'bg-green-500': '#22c55e', 'bg-green-600': '#16a34a',
  'bg-emerald-400': '#34d399', 'bg-emerald-500': '#10b981', 'bg-emerald-600': '#059669',
  // Blue / Cyan / Sky
  'bg-cyan-400': '#22d3ee', 'bg-cyan-500': '#06b6d4', 'bg-cyan-600': '#0891b2',
  'bg-sky-400': '#38bdf8', 'bg-sky-500': '#0ea5e9', 'bg-sky-600': '#0284c7',
  'bg-blue-400': '#60a5fa', 'bg-blue-500': '#3b82f6', 'bg-blue-600': '#2563eb',
  // Indigo / Violet / Purple / Fuchsia
  'bg-indigo-400': '#818cf8', 'bg-indigo-500': '#6366f1', 'bg-indigo-600': '#4f46e5',
  'bg-violet-400': '#a78bfa', 'bg-violet-500': '#8b5cf6', 'bg-violet-600': '#7c3aed',
  'bg-purple-400': '#c084fc', 'bg-purple-500': '#a855f7', 'bg-purple-600': '#9333ea',
  'bg-pink-400': '#f472b6', 'bg-pink-500': '#ec4899', 'bg-pink-600': '#db2777',
};

const getHexFromClass = (className: string) => {
  if (!className) return '#cbd5e1';
  // Try direct match
  if (COLOR_MAP[className]) return COLOR_MAP[className];
  
  // Try fuzzy matching if it's like "bg-rose-500" but we only have "rose-500"
  const clean = className.startsWith('bg-') ? className : `bg-${className}`;
  if (COLOR_MAP[clean]) return COLOR_MAP[clean];

  return '#cbd5e1';
};

const safeToDate = (raw: any): Date => {
  if (!raw) return new Date();
  if (raw instanceof Date) return raw;
  if (typeof raw.toDate === 'function') return raw.toDate();
  if (typeof raw === 'string') return new Date(raw);
  if (typeof raw === 'number') return new Date(raw);
  return new Date();
};

const CategoryIconBadge = ({ name, size = 14 }: { name?: string; size?: number }) => {
  const Icon = getCategoryIcon(name || 'Tag');
  return <Icon size={size} />;
};

export const Stats: React.FC = () => {
  const navigate = useNavigate();
  const { categories, transactions, userNames, projects, loading: dataLoading } = useData();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<StatsTab>('overview');
  const [selectedCategoryModal, setSelectedCategoryModal] = useState<any | null>(null);
  const [filterProject, setFilterProject] = useState<string>('all');
  const [viewType, setViewType] = useState<'expense' | 'income'>('expense');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('');
  const [periodBudgets, setPeriodBudgets] = useState<any[]>([]);

  const activeMonthDate = useMemo(() => {
    return currentDate;
  }, [currentDate]);

  const targetMonthStr = useMemo(() => {
    return getLocalMonth(activeMonthDate);
  }, [activeMonthDate]);

  const changePeriod = (offset: number) => {
    const next = new Date(currentDate);
    if (timeRange === 'month' || timeRange === 'lastMonth') {
      next.setMonth(next.getMonth() + offset);
    } else if (timeRange === 'week') {
      next.setDate(next.getDate() + (offset * 7));
    } else if (timeRange === 'year') {
      next.setFullYear(next.getFullYear() + offset);
    } else if (timeRange === 'today') {
      next.setDate(next.getDate() + offset);
    }
    setCurrentDate(next);
  };

  const resetToToday = () => {
    setCurrentDate(new Date());
    if (timeRange === 'lastMonth') {
      setTimeRange('month');
    }
  };

  const isCurrentPeriod = useMemo(() => {
    const now = new Date();
    if (timeRange === 'month') {
      return currentDate.getMonth() === now.getMonth() && currentDate.getFullYear() === now.getFullYear();
    }
    if (timeRange === 'year') {
      return currentDate.getFullYear() === now.getFullYear();
    }
    if (timeRange === 'today') {
      return currentDate.toDateString() === now.toDateString();
    }
    if (timeRange === 'lastMonth') {
      return false;
    }
    if (timeRange === 'week') {
      const diffDays = Math.abs(currentDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
      return diffDays < 7;
    }
    return false;
  }, [currentDate, timeRange]);

  const periodDisplayLabel = useMemo(() => {
    if (timeRange === 'month' || timeRange === 'lastMonth') {
      return currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    }
    if (timeRange === 'year') {
      return currentDate.getFullYear().toString();
    }
    if (timeRange === 'today') {
      return currentDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    }
    if (timeRange === 'week') {
      const start = new Date(currentDate);
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(new Date(currentDate).setDate(diff));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return `${monday.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`;
    }
    return '';
  }, [currentDate, timeRange]);

  const projectIdsStr = useMemo(() => projects.map(p => p.id).sort().join(','), [projects]);

  useEffect(() => {
    if (!user) {
      setPeriodBudgets([]);
      return;
    }
    const projectIds = projects.map(p => p.id);
    const unsubscribe = getBudgets(targetMonthStr, projectIds, (data) => {
      setPeriodBudgets(data);
    });

    return () => {
      unsubscribe();
    };
  }, [user, targetMonthStr, projectIdsStr]);

  useEffect(() => {
    if (!dataLoading) {
      setLoading(false);
    }
  }, [dataLoading]);

  // Update selected currency when filter changes
  useEffect(() => {
    if (filterProject === 'personal') {
      setSelectedCurrency(profile?.currency || 'ARS');
    } else if (filterProject !== 'all') {
      const proj = projects.find(p => p.id === filterProject);
      if (proj?.currency) setSelectedCurrency(proj.currency);
    } else {
      // For 'all', we default to profile currency if not set
      if (!selectedCurrency && profile?.currency) setSelectedCurrency(profile.currency);
      else if (!selectedCurrency) setSelectedCurrency('ARS');
    }
  }, [filterProject, profile, projects, selectedCurrency]);

  const activeProjects = useMemo(() => {
    return projects.filter(p => (p.status || 'active') !== 'inactive');
  }, [projects]);

  const isPersonalActive = (profile?.personalStatus || 'active') !== 'inactive';

  const stats = useMemo(() => {
    try {
      const now = new Date();
      const selectedYear = currentDate.getFullYear();
      const selectedMonth = currentDate.getMonth();

      // First filter by active status, time, and project to get the "Universe" of transactions
      const universe = transactions.filter(t => {
        // Exclude transactions of inactive projects
        if (t.projectId) {
          const proj = projects.find(p => p.id === t.projectId);
          if (proj && proj.status === 'inactive') return false;
        } else {
          if (!isPersonalActive) return false;
        }

        const d = new Date(t.date);
        if (timeRange === 'today') return d.toDateString() === currentDate.toDateString();
        if (timeRange === 'week') {
          const start = new Date(currentDate);
          const day = start.getDay();
          const diff = start.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(new Date(currentDate).setDate(diff));
          monday.setHours(0, 0, 0, 0);
          const sunday = new Date(monday);
          sunday.setDate(monday.getDate() + 6);
          sunday.setHours(23, 59, 59, 999);
          return d >= monday && d <= sunday;
        }
        if (timeRange === 'month') return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        if (timeRange === 'lastMonth') {
          const lastMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
          const yearOfLastMonth = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
          return d.getMonth() === lastMonth && d.getFullYear() === yearOfLastMonth;
        }
        if (timeRange === 'year') return d.getFullYear() === selectedYear;
        return true;
      }).filter(t => {
        if (filterProject === 'all') return true;
        if (filterProject === 'personal') return !t.projectId;
        return t.projectId === filterProject;
      });

      // Find all currencies present in the universe
      const currenciesInUniverse = Array.from(new Set(universe.map(t => {
        if (t.projectId) {
          return projects.find(p => p.id === t.projectId)?.currency || 'ARS';
        }
        return profile?.currency || 'ARS';
      })));

      const activeCurrency = selectedCurrency || profile?.currency || 'ARS';

      // Now filter by active currency
      const filtered = universe.filter(t => {
        const tCurrency = t.projectId 
          ? projects.find(p => p.id === t.projectId)?.currency || 'ARS'
          : profile?.currency || 'ARS';
        return tCurrency === activeCurrency;
      });

      const expenses = filtered.filter(t => t.type === 'expense');
      const income = filtered.filter(t => t.type === 'income');
      
      const totalExpenses = expenses.reduce((acc, t) => acc + t.amount, 0);
      const totalIncome = income.reduce((acc, t) => acc + t.amount, 0);
      const netBalance = totalIncome - totalExpenses;
      const transactionCount = filtered.length;
      
      // Days in period for daily average & run-rate projection
      const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() && timeRange === 'month';
      const totalDaysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      let daysInPeriod = 1;

      if (timeRange === 'week') {
        daysInPeriod = 7;
      } else if (timeRange === 'month') {
        daysInPeriod = isCurrentMonth ? Math.max(1, now.getDate()) : totalDaysInMonth;
      } else if (timeRange === 'lastMonth') {
        const lastMonthDate = new Date(selectedYear, selectedMonth, 0);
        daysInPeriod = lastMonthDate.getDate();
      } else if (timeRange === 'year') {
        const isCurrentYear = selectedYear === now.getFullYear();
        if (isCurrentYear) {
          const startOfYear = new Date(now.getFullYear(), 0, 1);
          daysInPeriod = Math.max(1, Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)));
        } else {
          daysInPeriod = (selectedYear % 4 === 0 && (selectedYear % 100 !== 0 || selectedYear % 400 === 0)) ? 366 : 365;
        }
      }
      
      const dailyAverage = totalExpenses / (daysInPeriod || 1);
      const avgPerTransaction = expenses.length > 0 ? totalExpenses / expenses.length : 0;

      // Run-Rate projection to end of month
      const projectedExpenses = isCurrentMonth
        ? (totalExpenses / Math.max(1, now.getDate())) * totalDaysInMonth
        : null;
      const daysPassed = isCurrentMonth ? now.getDate() : totalDaysInMonth;
      const daysRemaining = isCurrentMonth ? Math.max(0, totalDaysInMonth - now.getDate()) : 0;

      // Expense Distribution
      const catMap: Record<string, number> = {};
      expenses.forEach(t => {
        catMap[t.categoryId] = (catMap[t.categoryId] || 0) + t.amount;
      });

      const distribution = Object.entries(catMap).map(([id, value]) => {
        const cat = categories.find(c => c.id === id);
        // Find a representative transaction for this category to get denormalized fields
        const sampleTx = expenses.find(t => t.categoryId === id);
        
        return {
          id,
          name: cat?.name || sampleTx?.categoryName || (id ? 'Cargando...' : 'Otros'),
          icon: cat?.icon || sampleTx?.categoryIcon || 'Tag',
          value: (value / (totalExpenses || 1)) * 100,
          amount: value,
          color: getHexFromClass(cat?.color || sampleTx?.categoryColor || '')
        };
      }).sort((a, b) => b.amount - a.amount);

      // Income Distribution
      const incomeCatMap: Record<string, number> = {};
      income.forEach(t => {
        incomeCatMap[t.categoryId] = (incomeCatMap[t.categoryId] || 0) + t.amount;
      });

      const incomeDistribution = Object.entries(incomeCatMap).map(([id, value]) => {
        const cat = categories.find(c => c.id === id);
        const sampleTx = income.find(t => t.categoryId === id);
        
        return {
          id,
          name: cat?.name || sampleTx?.categoryName || (id ? 'Cargando...' : 'Otros'),
          icon: cat?.icon || sampleTx?.categoryIcon || 'Tag',
          value: (value / (totalIncome || 1)) * 100,
          amount: value,
          color: getHexFromClass(cat?.color || sampleTx?.categoryColor || '')
        };
      }).sort((a, b) => b.amount - a.amount);

      const topExpenseCategory = distribution[0] || { name: 'N/A', value: 0 };
      const topIncomeCategory = incomeDistribution[0] || { name: 'N/A', value: 0 };

      // User contribution
      const userContributionMap: Record<string, { income: number; expense: number }> = {};
      filtered.forEach(t => {
        if (!userContributionMap[t.authorId]) {
          userContributionMap[t.authorId] = { income: 0, expense: 0 };
        }
        if (t.type === 'income') userContributionMap[t.authorId].income += t.amount;
        else userContributionMap[t.authorId].expense += t.amount;
      });

      const userContributions = Object.entries(userContributionMap).map(([uid, data]) => ({
        name: userNames[uid] || 'Usuario',
        id: uid,
        ...data
      })).sort((a, b) => b.expense - a.expense);

      // Evolution data
      const evolutionMap: Record<string, { expense: number; income: number }> = {};
      
      filtered.forEach(t => {
        const d = new Date(t.date);
        let key = '';
        if (timeRange === 'today') key = d.getHours().toString().padStart(2, '0') + ':00';
        else if (timeRange === 'week') key = d.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase();
        else if (timeRange === 'month' || timeRange === 'lastMonth') key = d.getDate().toString();
        else if (timeRange === 'year') key = d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase();
        
        if (!evolutionMap[key]) evolutionMap[key] = { expense: 0, income: 0 };
        if (t.type === 'income') evolutionMap[key].income += t.amount;
        else evolutionMap[key].expense += t.amount;
      });

      const evolution = Object.entries(evolutionMap).map(([name, data]) => ({ 
        name, 
        value: data.expense, 
        income: data.income 
      }));

      // Previous period calculation for MoM (Month over Month / Period over Period)
      const prevPeriodLabel = 
        timeRange === 'today' ? 'vs ayer' :
        timeRange === 'week' ? 'vs sem. ant.' :
        timeRange === 'year' ? 'vs año ant.' :
        timeRange === 'lastMonth' ? 'vs mes previo' : 'vs mes ant.';

      const prevUniverse = transactions.filter(t => {
        if (t.projectId) {
          const proj = projects.find(p => p.id === t.projectId);
          if (proj && proj.status === 'inactive') return false;
        } else {
          if (!isPersonalActive) return false;
        }

        const d = new Date(t.date);
        if (timeRange === 'today') {
          const yesterday = new Date(currentDate);
          yesterday.setDate(currentDate.getDate() - 1);
          return d.toDateString() === yesterday.toDateString();
        }
        if (timeRange === 'week') {
          const start = new Date(currentDate);
          const day = start.getDay();
          const diff = start.getDate() - day + (day === 0 ? -6 : 1);
          const prevMonday = new Date(new Date(currentDate).setDate(diff - 7));
          prevMonday.setHours(0, 0, 0, 0);
          const prevSunday = new Date(prevMonday);
          prevSunday.setDate(prevMonday.getDate() + 6);
          prevSunday.setHours(23, 59, 59, 999);
          return d >= prevMonday && d <= prevSunday;
        }
        if (timeRange === 'month') {
          const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
          const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
          return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
        }
        if (timeRange === 'lastMonth') {
          const twoMonthsAgoMonth = selectedMonth <= 1 ? (selectedMonth === 0 ? 10 : 11) : selectedMonth - 2;
          const twoMonthsAgoYear = selectedMonth <= 1 ? selectedYear - 1 : selectedYear;
          return d.getMonth() === twoMonthsAgoMonth && d.getFullYear() === twoMonthsAgoYear;
        }
        if (timeRange === 'year') {
          return d.getFullYear() === selectedYear - 1;
        }
        return false;
      }).filter(t => {
        if (filterProject === 'all') return true;
        if (filterProject === 'personal') return !t.projectId;
        return t.projectId === filterProject;
      }).filter(t => {
        const tCurrency = t.projectId 
          ? projects.find(p => p.id === t.projectId)?.currency || 'ARS'
          : profile?.currency || 'ARS';
        return tCurrency === activeCurrency;
      });

      const prevExpenses = prevUniverse.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
      const prevIncome = prevUniverse.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);

      // MoM Percentage Changes
      let expenseMoM: number | null = null;
      if (prevExpenses > 0) {
        expenseMoM = ((totalExpenses - prevExpenses) / prevExpenses) * 100;
      } else if (totalExpenses > 0 && prevExpenses === 0) {
        expenseMoM = 100;
      }

      let incomeMoM: number | null = null;
      if (prevIncome > 0) {
        incomeMoM = ((totalIncome - prevIncome) / prevIncome) * 100;
      } else if (totalIncome > 0 && prevIncome === 0) {
        incomeMoM = 100;
      }

      // Tasa de Ahorro (% Savings Rate): (Ingresos - Gastos) / Ingresos * 100
      let savingsRate: number | null = null;
      if (totalIncome > 0) {
        savingsRate = ((totalIncome - totalExpenses) / totalIncome) * 100;
      } else if (totalExpenses > 0) {
        savingsRate = -100;
      }

      // Peak day label according to viewType
      const targetEvolutionKey = viewType === 'expense' ? 'expense' : 'income';
      const peakDayEntry = Object.entries(evolutionMap)
        .filter(([_, d]) => d[targetEvolutionKey] > 0)
        .sort((a, b) => b[1][targetEvolutionKey] - a[1][targetEvolutionKey])[0];
        
      let peakDayLabel = 'N/A';
      if (peakDayEntry) {
        const peakAmount = formatCurrency(peakDayEntry[1][targetEvolutionKey], activeCurrency);
        if (timeRange === 'month' || timeRange === 'lastMonth') {
          peakDayLabel = `Día ${peakDayEntry[0]} (${peakAmount})`;
        } else if (timeRange === 'week' || timeRange === 'year') {
          peakDayLabel = `${peakDayEntry[0]} (${peakAmount})`;
        } else {
          peakDayLabel = `${peakDayEntry[0]} (${peakAmount})`;
        }
      }

      // Budget Comparison for the specific period's month
      const budgetComparison = periodBudgets.filter(b => {
        // Filter budgets by project and matching currency
        if (filterProject === 'all') {
          // If viewing all, show budgets that match the selected currency
          const bCurrency = b.projectId && b.projectId !== 'personal'
            ? projects.find(p => p.id === b.projectId)?.currency || 'ARS'
            : profile?.currency || 'ARS';
          return bCurrency === activeCurrency;
        }
        if (filterProject === 'personal') return !b.projectId || b.projectId === 'personal';
        return b.projectId === filterProject;
      }).map(b => {
        const cat = categories.find(c => c.id === b.categoryId);
        const actual = catMap[b.categoryId] || 0;
        const percent = b.amount > 0 ? (actual / b.amount) * 100 : 0;
        return {
          id: b.id,
          name: cat?.name || 'Cargando...',
          budget: b.amount,
          actual: actual,
          percent: Math.min(percent, 100),
          isOver: actual > b.amount,
          color: getHexFromClass(cat?.color || '')
        };
      }).sort((a, b) => b.actual - a.actual);

      // Classification breakdown
      const classMap = {
        fixed: 0,
        variable: 0,
        unclassified: 0
      };

      expenses.forEach(t => {
        if (t.classification === 'fixed') classMap.fixed += t.amount;
        else if (t.classification === 'variable') classMap.variable += t.amount;
        else classMap.unclassified += t.amount;
      });

      const classificationData = [
        { name: 'Fijos', value: classMap.fixed, color: '#6366f1' },
        { name: 'Variables', value: classMap.variable, color: '#f59e0b' },
        { name: 'Sin Clasif.', value: classMap.unclassified, color: '#94a3b8' }
      ].filter(d => d.value > 0);

      const fixedCoverage = totalIncome > 0 ? (classMap.fixed / totalIncome) * 100 : 0;
      const savingsPotential = totalIncome - classMap.fixed;
      const variableRatio = totalExpenses > 0 ? (classMap.variable / totalExpenses) * 100 : 0;

      // Category Income Impact
      const categoryIncomeImpact = Object.entries(catMap).map(([id, value]) => {
        const cat = categories.find(c => c.id === id);
        const sampleTx = expenses.find(t => t.categoryId === id);
        return {
          id,
          name: cat?.name || sampleTx?.categoryName || (id ? 'Cargando...' : 'Otros'),
          amount: value,
          percentage: totalIncome > 0 ? (value / totalIncome) * 100 : 0,
          color: getHexFromClass(cat?.color || sampleTx?.categoryColor || '')
        };
      }).sort((a, b) => b.amount - a.amount);

      // Insights
      interface InsightCardData {
        id: string;
        badge: string;
        badgeClass: string;
        title: string;
        description: string;
        advice?: string;
        iconName: string;
      }

      const insights: InsightCardData[] = [];
      const currentDist = viewType === 'expense' ? distribution : incomeDistribution;

      if (savingsRate !== null && totalIncome > 0) {
        if (savingsRate >= 20) {
          insights.push({
            id: 'savings-optimal',
            badge: 'LOGRO DE AHORRO',
            badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
            title: `Tasa de ahorro óptima (${savingsRate.toFixed(1)}%)`,
            description: `Retuviste el ${savingsRate.toFixed(1)}% de tus ingresos con un balance favorable de ${formatCurrency(netBalance, activeCurrency)}.`,
            advice: 'Supera la meta del 20%. ¡Excelente disciplina de retención!',
            iconName: 'PiggyBank'
          });
        } else if (savingsRate < 0) {
          insights.push({
            id: 'savings-deficit',
            badge: 'DÉFICIT FINANCIERO',
            badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
            title: 'Desembolsos por encima del ingreso',
            description: `Tuviste un déficit del ${Math.abs(savingsRate).toFixed(1)}% (${formatCurrency(Math.abs(netBalance), activeCurrency)} por encima de lo ingresado).`,
            advice: 'Revisa partidas prescindibles para recomponer tu liquidez.',
            iconName: 'AlertTriangle'
          });
        }
      }

      if (currentDist.length > 0) {
        insights.push({
          id: 'top-cat',
          badge: 'CONCENTRACIÓN',
          badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
          title: `Mayor ${viewType === 'expense' ? 'gasto' : 'ingreso'}: ${currentDist[0].name}`,
          description: `Representa el ${currentDist[0].value.toFixed(1)}% del total (${formatCurrency(currentDist[0].amount, activeCurrency)}).`,
          advice: viewType === 'expense' 
            ? 'Comprueba que este rubro refleje tus verdaderas prioridades.' 
            : 'Tu principal fuente de ingresos en este período.',
          iconName: 'PieChart'
        });
      }

      const overBudget = budgetComparison.filter(b => b.isOver);
      if (overBudget.length > 0) {
        insights.push({
          id: 'over-budget',
          badge: 'LÍMITE SUPERADO',
          badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
          title: `${overBudget.length} ${overBudget.length === 1 ? 'categoría en exceso' : 'categorías en exceso'}`,
          description: `${overBudget.map(b => b.name).slice(0, 2).join(', ')}${overBudget.length > 2 ? ` y ${overBudget.length - 2} más` : ''} excedieron su presupuesto.`,
          advice: 'Pausa consumos no esenciales en estas categorías este mes.',
          iconName: 'AlertCircle'
        });
      }

      if (dailyAverage > 0 && viewType === 'expense') {
        insights.push({
          id: 'daily-avg',
          badge: 'DESEMBOLSO DIARIO',
          badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
          title: 'Ritmo de gasto por día',
          description: `Tu desembolso diario promedio se ubica en ${formatCurrency(dailyAverage, activeCurrency)}.`,
          advice: 'Referencia clave para proyectar tu gasto a fin de mes.',
          iconName: 'Clock'
        });
      }

      if (expenseMoM !== null && prevExpenses > 0) {
        if (expenseMoM > 10) {
          insights.push({
            id: 'mom-up',
            badge: 'TENDENCIA AL ALZA',
            badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
            title: `Gastos en aumento (+${expenseMoM.toFixed(1)}%)`,
            description: `Gastaste un ${expenseMoM.toFixed(1)}% más ${prevPeriodLabel} (${formatCurrency(prevExpenses, activeCurrency)} vs ${formatCurrency(totalExpenses, activeCurrency)}).`,
            advice: 'Verifica si fue una compra extraordinaria puntual.',
            iconName: 'TrendingUp'
          });
        } else if (expenseMoM < -10) {
          insights.push({
            id: 'mom-down',
            badge: 'EFICIENCIA DE GASTO',
            badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
            title: `Reducción de gasto (-${Math.abs(expenseMoM).toFixed(1)}%)`,
            description: `Lograste reducir tus gastos un ${Math.abs(expenseMoM).toFixed(1)}% ${prevPeriodLabel}.`,
            advice: '¡Excelente control del presupuesto!',
            iconName: 'TrendingDown'
          });
        }
      }
      
      return {
        totalExpenses,
        totalIncome,
        netBalance,
        dailyAverage,
        avgPerTransaction,
        projectedExpenses,
        daysPassed,
        totalDaysInMonth,
        daysRemaining,
        isCurrentMonth,
        distribution,
        incomeDistribution,
        topExpenseCategory,
        topIncomeCategory,
        userContributions,
        evolution,
        transactionCount,
        peakDayLabel,
        budgetComparison,
        classificationData,
        fixedCoverage,
        savingsPotential,
        variableRatio,
        categoryIncomeImpact,
        insights,
        hasData: filtered.length > 0,
        currenciesInUniverse,
        activeCurrency,
        expenseMoM,
        incomeMoM,
        savingsRate,
        prevPeriodLabel,
        prevExpenses,
        prevIncome,
        filteredTransactions: filtered
      };
    } catch (e) {
      console.error("Error calculating stats:", e);
      return null;
    }
  }, [transactions, timeRange, categories, filterProject, viewType, userNames, projects, profile, selectedCurrency, periodBudgets, currentDate]);

  const modalTransactions = useMemo(() => {
    if (!selectedCategoryModal || !stats) return [];
    return stats.filteredTransactions.filter((t: any) => 
      t.categoryId === selectedCategoryModal.id && t.type === viewType
    ).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedCategoryModal, stats, viewType]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-on-surface-variant font-bold text-sm uppercase tracking-widest">Cargando análisis...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-6">
        <div className="bg-surface-container-lowest p-8 rounded-[2rem] border border-on-surface/10 shadow-sm text-center space-y-4 max-w-xs">
          <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 mx-auto">
            <Info size={32} />
          </div>
          <h3 className="text-lg font-bold text-on-surface">Algo salió mal</h3>
          <p className="text-on-surface-variant text-sm">No pudimos cargar tus estadísticas. Por favor, intenta de nuevo más tarde.</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 max-w-5xl mx-auto py-6 sm:py-8 pb-32 sm:pb-20 bg-surface">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="w-10 h-10 flex items-center justify-center bg-surface-container-low hover:bg-on-surface/5 rounded-2xl transition-all active:scale-90 border border-on-surface/5"
            aria-label="Volver"
          >
            <ChevronLeft size={20} className="text-on-surface" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <BarChart3 className="text-primary w-5 h-5 sm:w-6 sm:h-6" />
              <h2 className="text-xl sm:text-2xl font-black text-on-surface font-headline tracking-tight">Estadísticas</h2>
            </div>
            <p className="text-on-surface-variant text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] opacity-60">Análisis detallado de tus finanzas</p>
          </div>
        </div>
        
        {/* Dynamic Period Navigator */}
        <div className="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-2xl border border-on-surface/5 self-stretch sm:self-auto justify-between sm:justify-end shadow-xs">
          <button 
            onClick={() => changePeriod(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface-container-lowest text-on-surface-variant hover:text-on-surface transition-all active:scale-90"
            title="Período anterior"
            aria-label="Período anterior"
          >
            <ChevronLeft size={18} />
          </button>
          
          <div className="flex items-center gap-2 px-2 text-primary font-black uppercase text-xs tracking-wider min-w-[130px] justify-center">
            <Calendar size={14} className="shrink-0" />
            <span className="truncate">{periodDisplayLabel}</span>
          </div>

          <button 
            onClick={() => changePeriod(1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface-container-lowest text-on-surface-variant hover:text-on-surface transition-all active:scale-90"
            title="Período siguiente"
            aria-label="Período siguiente"
          >
            <ChevronRight size={18} />
          </button>

          {!isCurrentPeriod && (
            <button
              onClick={resetToToday}
              className="ml-1 px-2.5 py-1 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-all active:scale-95 shadow-xs"
              title="Volver al período actual"
            >
              Hoy
            </button>
          )}
        </div>
      </header>

      <div className="space-y-10 sm:space-y-12">
        {/* Filters */}
        <section className="space-y-4">
          <div className="flex bg-surface-container-low p-1 rounded-2xl border border-on-surface/5 overflow-x-auto no-scrollbar scroll-smooth">
            {(['month', 'week', 'year', 'lastMonth', 'today'] as const).map((range) => (
              <button 
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  "flex-1 min-w-[100px] sm:min-w-0 px-4 py-3 rounded-xl text-[11px] sm:text-xs font-black transition-all whitespace-nowrap uppercase tracking-widest",
                  timeRange === range ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant/70 hover:text-on-surface"
                )}
              >
                {range === 'month' ? 'Este Mes' : 
                 range === 'week' ? 'Semana' : 
                 range === 'year' ? 'Año' :
                 range === 'lastMonth' ? 'Mes Ant.' : 'Hoy'}
              </button>
            ))}
          </div>

          {/* View Toggle Expense/Income */}
          <div className="flex p-1 bg-surface-container-low rounded-2xl border border-on-surface/5">
            <button 
              onClick={() => setViewType('expense')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all uppercase tracking-widest",
                viewType === 'expense' ? "bg-rose-500 text-white shadow-lg" : "text-rose-500/70 hover:bg-rose-500/5"
              )}
            >
              <TrendingUp size={14} className="rotate-180" />
              Gastos
            </button>
            <button 
              onClick={() => setViewType('income')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all uppercase tracking-widest",
                viewType === 'income' ? "bg-emerald-500 text-white shadow-lg" : "text-emerald-500/70 hover:bg-emerald-500/5"
              )}
            >
              <TrendingUp size={14} />
              Ingresos
            </button>
          </div>

          <div className="overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
             <div className="flex gap-2 min-w-max">
               <button 
                 onClick={() => setFilterProject('all')}
                 className={cn(
                   "px-5 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest border",
                   filterProject === 'all' ? "bg-primary text-white border-primary shadow-md" : "bg-surface-container-low text-on-surface-variant border-on-surface/5"
                 )}
               >
                 Todo
               </button>
               {isPersonalActive && (
                 <button 
                   onClick={() => setFilterProject('personal')}
                   className={cn(
                     "px-5 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest border",
                     filterProject === 'personal' ? "bg-primary text-white border-primary shadow-md" : "bg-surface-container-low text-on-surface-variant border-on-surface/5"
                   )}
                 >
                   Personal
                 </button>
               )}
               {activeProjects.map(p => (
                 <button 
                   key={p.id}
                   onClick={() => setFilterProject(p.id)}
                   className={cn(
                     "px-5 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest border max-w-[120px] truncate",
                     filterProject === p.id ? "bg-primary text-white border-primary shadow-md" : "bg-surface-container-low text-on-surface-variant border-on-surface/5"
                   )}
                 >
                   {p.name}
                 </button>
               ))}
             </div>
          </div>

          {/* Currency Selector (only if viewing all and multiple currencies present) */}
          {filterProject === 'all' && stats.currenciesInUniverse.length > 1 && (
            <div className="flex items-center gap-3 bg-primary/5 p-4 rounded-2xl border border-primary/10">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Globe size={16} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Moneda de Análisis</p>
                <div className="flex gap-2">
                  {stats.currenciesInUniverse.map(curr => (
                    <button
                      key={curr}
                      onClick={() => setSelectedCurrency(curr)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-[10px] font-black transition-all",
                        stats.activeCurrency === curr 
                          ? "bg-primary text-white shadow-sm" 
                          : "bg-surface-container-lowest text-primary border border-primary/20 hover:bg-primary/5"
                      )}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tabs Selector */}
          <div className="flex bg-surface-container-low p-1 rounded-2xl border border-on-surface/5 overflow-x-auto no-scrollbar scroll-smooth">
            <button
              onClick={() => setActiveTab('overview')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 min-w-[95px] py-2.5 rounded-xl text-xs font-black transition-all uppercase tracking-wider",
                activeTab === 'overview'
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-on-surface-variant/70 hover:text-on-surface"
              )}
            >
              <Activity size={14} />
              <span>Resumen</span>
            </button>

            <button
              onClick={() => setActiveTab('categories')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 min-w-[105px] py-2.5 rounded-xl text-xs font-black transition-all uppercase tracking-wider",
                activeTab === 'categories'
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-on-surface-variant/70 hover:text-on-surface"
              )}
            >
              <PieChartIcon size={14} />
              <span>Categorías</span>
            </button>

            <button
              onClick={() => setActiveTab('stability')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 min-w-[100px] py-2.5 rounded-xl text-xs font-black transition-all uppercase tracking-wider",
                activeTab === 'stability'
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-on-surface-variant/70 hover:text-on-surface"
              )}
            >
              <Layers size={14} />
              <span>Estructura</span>
            </button>

            {filterProject !== 'personal' && (
              <button
                onClick={() => setActiveTab('members')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 min-w-[95px] py-2.5 rounded-xl text-xs font-black transition-all uppercase tracking-wider",
                  activeTab === 'members'
                    ? "bg-surface-container-lowest text-primary shadow-sm"
                    : "text-on-surface-variant/70 hover:text-on-surface"
                )}
              >
                <Target size={14} />
                <span>Miembros</span>
              </button>
            )}
          </div>
        </section>

        {!stats.hasData ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-on-surface/5 rounded-full flex items-center justify-center text-on-surface-variant/40">
              <Activity size={40} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-on-surface">Sin datos</h3>
              <p className="text-on-surface-variant text-sm">No hay transacciones para este período.</p>
            </div>
          </div>
        ) : (
          <>
            {/* TAB: RESUMEN (OVERVIEW) */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Main KPIs (4 Cards: Gastos, Ingresos, Balance, Tasa de Ahorro) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <MainKPICard 
                    title="Gastos" 
                    value={formatCurrency(stats.totalExpenses, stats.activeCurrency)} 
                    icon={<ArrowDownRight size={20} className="text-rose-500" />}
                    color="text-rose-500"
                    badge={
                      stats.expenseMoM !== null ? (
                        <span className={cn(
                          "inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider font-mono",
                          stats.expenseMoM > 0 
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" 
                            : stats.expenseMoM < 0 
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-on-surface/5 text-on-surface-variant border-on-surface/10"
                        )}>
                          {stats.expenseMoM > 0 ? <ArrowUpRight size={11} /> : stats.expenseMoM < 0 ? <ArrowDownRight size={11} /> : null}
                          {stats.expenseMoM > 0 ? `+${stats.expenseMoM.toFixed(1)}%` : `${stats.expenseMoM.toFixed(1)}%`} {stats.prevPeriodLabel}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest">
                          Sin datos prev.
                        </span>
                      )
                    }
                  />
                  <MainKPICard 
                    title="Ingresos" 
                    value={formatCurrency(stats.totalIncome, stats.activeCurrency)} 
                    icon={<ArrowUpRight size={20} className="text-emerald-500" />}
                    color="text-emerald-500"
                    badge={
                      stats.incomeMoM !== null ? (
                        <span className={cn(
                          "inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider font-mono",
                          stats.incomeMoM > 0 
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                            : stats.incomeMoM < 0 
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                            : "bg-on-surface/5 text-on-surface-variant border-on-surface/10"
                        )}>
                          {stats.incomeMoM > 0 ? <ArrowUpRight size={11} /> : stats.incomeMoM < 0 ? <ArrowDownRight size={11} /> : null}
                          {stats.incomeMoM > 0 ? `+${stats.incomeMoM.toFixed(1)}%` : `${stats.incomeMoM.toFixed(1)}%`} {stats.prevPeriodLabel}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest">
                          Sin datos prev.
                        </span>
                      )
                    }
                  />
                  <MainKPICard 
                    title="Balance" 
                    value={formatCurrency(stats.netBalance, stats.activeCurrency)} 
                    icon={<Wallet size={20} className={stats.netBalance >= 0 ? "text-primary" : "text-rose-500"} />}
                    color={stats.netBalance >= 0 ? "text-primary" : "text-rose-500"}
                    badge={
                      <span className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider",
                        stats.netBalance >= 0
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                      )}>
                        {stats.netBalance >= 0 ? "Superávit neto" : "Déficit neto"}
                      </span>
                    }
                  />
                  <MainKPICard 
                    title="Tasa de Ahorro" 
                    value={stats.savingsRate !== null ? `${stats.savingsRate.toFixed(1)}%` : "0.0%"} 
                    icon={<PiggyBank size={20} className={
                      stats.savingsRate !== null && stats.savingsRate >= 20 
                        ? "text-emerald-500" 
                        : stats.savingsRate !== null && stats.savingsRate > 0 
                        ? "text-amber-500" 
                        : "text-rose-500"
                    } />}
                    color={
                      stats.savingsRate !== null && stats.savingsRate >= 20 
                        ? "text-emerald-500" 
                        : stats.savingsRate !== null && stats.savingsRate > 0 
                        ? "text-amber-500" 
                        : "text-rose-500"
                    }
                    badge={
                      stats.savingsRate !== null ? (
                        <span className={cn(
                          "text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider",
                          stats.savingsRate >= 20 
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                            : stats.savingsRate > 0 
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        )}>
                          {stats.savingsRate >= 20 ? "Óptimo (>20%)" : stats.savingsRate > 0 ? "Moderado" : "Déficit"}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest">
                          Sin ingresos
                        </span>
                      )
                    }
                    subtitle="Ingresos netos retenidos"
                  />
                </div>

                {/* Monthly Run-rate Forecast Card */}
                {stats.projectedExpenses !== null && viewType === 'expense' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-primary/10 via-surface-container-lowest to-surface-container-lowest p-6 rounded-[2rem] border border-primary/20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/20">
                          Proyección Fin de Mes
                        </span>
                        <span className="text-[11px] font-bold text-on-surface-variant/70">
                          Día {stats.daysPassed} de {stats.totalDaysInMonth} ({stats.daysRemaining} {stats.daysRemaining === 1 ? 'día restante' : 'días restantes'})
                        </span>
                      </div>
                      <h3 className="text-2xl font-black text-on-surface font-headline tracking-tight">
                        {formatCurrency(stats.projectedExpenses, stats.activeCurrency)}
                      </h3>
                      <p className="text-xs text-on-surface-variant font-medium">
                        Al ritmo promedio de <span className="font-bold text-on-surface font-mono">{formatCurrency(stats.dailyAverage, stats.activeCurrency)}/día</span>, cerrarías el mes en este nivel de gasto.
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-3 bg-surface-container-low/70 px-4 py-3 rounded-2xl border border-on-surface/5">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <TrendingUp size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-on-surface-variant/70 uppercase tracking-widest">Ritmo Diario</p>
                        <p className="text-sm font-black text-on-surface font-mono">{formatCurrency(stats.dailyAverage, stats.activeCurrency)}</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Secondary KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <SecondaryKPICard title="Promedio Diario" value={formatCurrency(stats.dailyAverage, stats.activeCurrency)} icon={<Clock size={14} />} />
                  <SecondaryKPICard title="Transacciones" value={stats.transactionCount.toString()} icon={<CreditCard size={14} />} />
                  <SecondaryKPICard title={viewType === 'expense' ? "Pico de Gasto" : "Pico de Ingreso"} value={stats.peakDayLabel} icon={<Zap size={14} className={viewType === 'expense' ? "text-rose-500" : "text-emerald-500"} />} />
                  <SecondaryKPICard title="Prom. x Trans." value={formatCurrency(stats.avgPerTransaction, stats.activeCurrency)} icon={<Target size={14} />} />
                </div>

                {/* Evolution Chart */}
                <ChartCard title={`Evolución de ${viewType === 'expense' ? 'Gastos' : 'Ingresos'}`} icon={<TrendingUp size={18} />}>
                  <div className="h-64 w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.evolution}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={viewType === 'expense' ? '#f43f5e' : '#10b981'} stopOpacity={0.1}/>
                            <stop offset="95%" stopColor={viewType === 'expense' ? '#f43f5e' : '#10b981'} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 11, fontWeight: 600, fill: 'rgba(0,0,0,0.3)' }} 
                        />
                        <YAxis hide />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'var(--color-surface-container-lowest)', 
                            color: 'var(--color-on-surface)',
                            borderRadius: '16px', 
                            border: '1px solid var(--color-surface-container-low)', 
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)', 
                            fontWeight: 'bold',
                            fontSize: '12px'
                          }}
                          itemStyle={{ color: viewType === 'expense' ? '#f43f5e' : '#10b981' }}
                          formatter={(val: any) => [formatCurrency(Number(val), stats.activeCurrency), viewType === 'expense' ? 'Gasto' : 'Ingreso']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey={viewType === 'expense' ? 'value' : 'income'} 
                          stroke={viewType === 'expense' ? '#f43f5e' : '#10b981'} 
                          strokeWidth={3} 
                          fillOpacity={1} 
                          fill="url(#colorValue)" 
                          animationDuration={1500}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>

                {/* Financial Intelligence / Insights Row */}
                {stats.insights.length > 0 && (
                  <section className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Zap size={18} className="text-primary" />
                      <h3 className="text-base font-bold text-on-surface tracking-tight">Inteligencia Financiera</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {stats.insights.map((insight) => (
                        <motion.div 
                          key={insight.id} 
                          whileHover={{ y: -2 }}
                          className="p-5 bg-surface-container-lowest rounded-[1.5rem] border border-on-surface/10 shadow-sm flex flex-col justify-between space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border", insight.badgeClass)}>
                              {insight.badge}
                            </span>
                            <div className="w-7 h-7 rounded-lg bg-on-surface/5 flex items-center justify-center text-on-surface-variant">
                              {insight.iconName === 'PiggyBank' ? <PiggyBank size={14} className="text-emerald-500" /> :
                               insight.iconName === 'AlertTriangle' ? <AlertTriangle size={14} className="text-rose-500" /> :
                               insight.iconName === 'AlertCircle' ? <AlertCircle size={14} className="text-rose-500" /> :
                               insight.iconName === 'Clock' ? <Clock size={14} className="text-purple-500" /> :
                               insight.iconName === 'TrendingUp' ? <TrendingUp size={14} className="text-amber-500" /> :
                               insight.iconName === 'TrendingDown' ? <TrendingDown size={14} className="text-emerald-500" /> :
                               <PieChartIcon size={14} className="text-indigo-500" />}
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <h4 className="text-xs font-black text-on-surface tracking-tight leading-snug">{insight.title}</h4>
                            <p className="text-[11px] text-on-surface-variant leading-relaxed font-medium">{insight.description}</p>
                          </div>
                          {insight.advice && (
                            <div className="pt-2 border-t border-on-surface/5 flex items-start gap-1.5 text-[10px] text-on-surface-variant/70 leading-relaxed font-medium">
                              <span className="shrink-0 text-xs">💡</span>
                              <span>{insight.advice}</span>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* TAB: CATEGORÍAS */}
            {activeTab === 'categories' && (
              <div className="space-y-8">
                {/* Distribution Donut & Category List with Drill-Down */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Distribution Card */}
                  <ChartCard 
                    title={`Distribución de ${viewType === 'expense' ? 'Gastos' : 'Ingresos'}`} 
                    icon={<PieChartIcon size={18} />}
                  >
                    <div className="flex flex-col items-center py-4">
                      <div className="relative w-48 h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={viewType === 'expense' ? stats.distribution : stats.incomeDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={65}
                              outerRadius={85}
                              paddingAngle={4}
                              dataKey="value"
                              animationDuration={1500}
                            >
                              {(viewType === 'expense' ? stats.distribution : stats.incomeDistribution).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                          <span className="text-[9px] font-black text-on-surface-variant/50 uppercase tracking-widest">
                            {viewType === 'expense' ? 'Gasto Top' : 'Ingreso Top'}
                          </span>
                          <span className="text-xs font-black text-on-surface truncate w-full px-2">
                            {(viewType === 'expense' ? stats.topExpenseCategory : stats.topIncomeCategory).name}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-primary mt-0.5">
                            {((viewType === 'expense' ? stats.topExpenseCategory : stats.topIncomeCategory).value || 0).toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <div className="w-full mt-6 space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                        <div className="flex items-center justify-between px-2 mb-1">
                          <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider">
                            Categoría (Toca para ver detalle)
                          </span>
                          <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider">
                            % / Importe
                          </span>
                        </div>
                        {(viewType === 'expense' ? stats.distribution : stats.incomeDistribution).map((item) => (
                          <div 
                            key={item.id || item.name} 
                            onClick={() => setSelectedCategoryModal(item)}
                            className="relative overflow-hidden p-3 bg-surface-container-low/40 hover:bg-surface-container-low transition-all cursor-pointer rounded-2xl border border-on-surface/5 hover:border-primary/30 active:scale-[0.99] group"
                            title="Tocar para ver movimientos"
                          >
                            <div 
                              className="absolute left-0 top-0 bottom-0 bg-primary/[0.04] group-hover:bg-primary/[0.08] transition-colors -z-10 rounded-2xl"
                              style={{ width: `${Math.min(item.value, 100)}%` }}
                            />
                            <div className="flex justify-between items-center gap-2 relative z-10">
                              <div className="flex items-center gap-3 min-w-0">
                                <div 
                                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs group-hover:scale-105 transition-transform" 
                                  style={{ backgroundColor: item.color }}
                                >
                                  <CategoryIconBadge name={item.icon} size={15} />
                                </div>
                                <div className="truncate">
                                  <span className="text-xs font-bold text-on-surface block truncate group-hover:text-primary transition-colors">
                                    {item.name}
                                  </span>
                                  <span className="text-[10px] font-mono text-on-surface-variant/60 block">
                                    {formatCurrency(item.amount, stats.activeCurrency)}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right shrink-0 flex items-center gap-2">
                                <span className="text-xs font-mono font-black text-on-surface bg-surface-container-lowest px-2 py-0.5 rounded-md border border-on-surface/5">
                                  {item.value.toFixed(1)}%
                                </span>
                                <ChevronRight size={14} className="text-on-surface-variant/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </ChartCard>

                  {/* Category Ranking Bar Chart */}
                  <ChartCard 
                    title={`Top 10 ${viewType === 'expense' ? 'Gastos' : 'Ingresos'}`} 
                    icon={<BarChart3 size={18} />}
                  >
                    <div className="h-[420px] w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          layout="vertical" 
                          data={(viewType === 'expense' ? stats.distribution : stats.incomeDistribution).slice(0, 10)} 
                          margin={{ left: -20, right: 20 }}
                          onClick={(data: any) => {
                            if (data && data.activePayload && data.activePayload[0]) {
                              setSelectedCategoryModal(data.activePayload[0].payload);
                            }
                          }}
                        >
                          <XAxis type="number" hide />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--color-on-surface-variant)' }}
                            width={90}
                          />
                          <Tooltip 
                            cursor={{ fill: 'rgba(128,128,128,0.06)' }}
                            contentStyle={{ 
                              backgroundColor: 'var(--color-surface-container-lowest)', 
                              color: 'var(--color-on-surface)',
                              borderRadius: '12px', 
                              border: '1px solid var(--color-surface-container-low)', 
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)' 
                            }}
                            formatter={(val: any) => [formatCurrency(Number(val), stats.activeCurrency), 'Monto']}
                          />
                          <Bar 
                            dataKey="amount" 
                            radius={[0, 10, 10, 0]} 
                            barSize={14}
                            animationDuration={1500}
                            className="cursor-pointer"
                          >
                            {(viewType === 'expense' ? stats.distribution : stats.incomeDistribution).slice(0, 10).map((entry, index) => (
                              <Cell key={`cell-bar-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>
                </div>

                {/* Budget Compliance Chart */}
                {stats.budgetComparison.length > 0 && (
                  <ChartCard title="Cumplimiento de Presupuesto" icon={<Target size={18} />}>
                    <div className="space-y-6 mt-4">
                      {stats.budgetComparison.map((item) => (
                        <div key={item.id} className="space-y-2">
                          <div className="flex justify-between items-end">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                              <span className="text-xs font-bold text-on-surface uppercase tracking-tight">{item.name}</span>
                            </div>
                            <div className="text-right">
                              <span className={cn("text-xs font-black tracking-tight", item.isOver ? "text-rose-500" : "text-on-surface")}>
                                {formatCurrency(item.actual, stats.activeCurrency)}
                              </span>
                              <span className="text-[10px] font-bold text-on-surface-variant/40 ml-1 uppercase tracking-widest">
                                / {formatCurrency(item.budget, stats.activeCurrency)}
                              </span>
                            </div>
                          </div>
                          <div className="relative h-3 w-full bg-on-surface/[0.05] rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${item.percent}%` }}
                              transition={{ duration: 1.5, ease: "easeOut" }}
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                item.isOver ? "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]" : "bg-primary shadow-[0_0_12px_rgba(var(--primary-rgb),0.3)]"
                              )}
                            />
                            {item.isOver && (
                              <div className="absolute right-0 top-0 h-full flex items-center pr-2">
                                <Zap size={8} className="text-white animate-pulse" />
                              </div>
                            )}
                          </div>
                          <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-[0.2em] opacity-40">
                            <span>{item.percent.toFixed(0)}% Utilizado</span>
                            {item.isOver && <span className="text-rose-500 text-[8px] animate-pulse">Límite Superado</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                )}

                {/* Category Income Impact */}
                {viewType === 'expense' && stats.categoryIncomeImpact.length > 0 && (
                  <ChartCard title="Impacto en Ingresos por Categoría" icon={<TrendingDown size={18} />}>
                    <div className="space-y-6 mt-4">
                      {stats.categoryIncomeImpact.map((item) => (
                        <div key={item.name} className="space-y-2">
                          <div className="flex justify-between items-end">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                              <span className="text-xs font-bold text-on-surface uppercase tracking-tight">{item.name}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-black text-on-surface tracking-tight">
                                {formatCurrency(item.amount, stats.activeCurrency)}
                              </span>
                              <span className={cn(
                                "text-[10px] font-black ml-2 uppercase tracking-widest",
                                item.percentage > 15 ? "text-rose-500" : "text-on-surface-variant/40"
                              )}>
                                {item.percentage.toFixed(1)}% del Ingreso
                              </span>
                            </div>
                          </div>
                          <div className="relative h-2 w-full bg-on-surface/[0.05] rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(item.percentage, 100)}%` }}
                              transition={{ duration: 1.5, ease: "easeOut" }}
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                item.percentage > 15 ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]" : "bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.2)]"
                              )}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 mt-4">
                        <p className="text-[10px] text-on-surface-variant/70 leading-relaxed font-medium">
                          Este gráfico muestra qué porcentaje de tus <strong>ingresos totales</strong> consume cada categoría. 
                          Te ayuda a identificar dónde se va la mayor parte de tu dinero relativo a lo que generas.
                        </p>
                      </div>
                    </div>
                  </ChartCard>
                )}
              </div>
            )}

            {/* TAB: ESTRUCTURA (STABILITY / 50-30-20) */}
            {activeTab === 'stability' && (
              <div className="space-y-8">
                {viewType === 'income' ? (
                  <div className="p-8 text-center bg-surface-container-lowest rounded-[2rem] border border-on-surface/10 space-y-3">
                    <Layers size={32} className="mx-auto text-on-surface-variant/40" />
                    <h3 className="text-base font-bold text-on-surface">Análisis para Gastos</h3>
                    <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                      El análisis de estructura clasifica tus desembolsos entre fijos y variables. Cambia la vista superior a "Gastos" para explorarlo.
                    </p>
                  </div>
                ) : stats.classificationData.length === 0 ? (
                  <div className="p-8 text-center bg-surface-container-lowest rounded-[2rem] border border-on-surface/10 space-y-3">
                    <Layers size={32} className="mx-auto text-on-surface-variant/40" />
                    <h3 className="text-base font-bold text-on-surface">Sin clasificación</h3>
                    <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                      Clasifica tus gastos como "Fijos" o "Variables" al cargarlos para ver el desglose de estructura financiera y compromiso de ingresos.
                    </p>
                  </div>
                ) : (
                  <ChartCard title="Análisis de Estabilidad y Estructura" icon={<Layers size={18} />}>
                    <div className="flex flex-col items-center py-4">
                      <div className="relative w-52 h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stats.classificationData}
                              cx="50%"
                              cy="50%"
                              innerRadius={70}
                              outerRadius={95}
                              paddingAngle={6}
                              dataKey="value"
                              animationDuration={1500}
                            >
                              {stats.classificationData.map((entry, index) => (
                                <Cell key={`cell-class-${index}`} fill={entry.color} stroke="none" />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                          <span className="text-[10px] font-bold text-on-surface/40 uppercase tracking-widest">Total Gastos</span>
                          <span className="text-base font-black text-on-surface">{formatCurrency(stats.totalExpenses, stats.activeCurrency)}</span>
                        </div>
                      </div>
                      
                      <div className="w-full mt-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {stats.classificationData.map((item) => (
                            <div key={item.name} className="flex flex-col p-4 bg-on-surface/[0.02] rounded-2xl border border-on-surface/5">
                              <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                                <span className="text-[10px] font-black text-on-surface-variant/70 uppercase tracking-wider">{item.name}</span>
                              </div>
                              <span className="text-base font-black text-on-surface">{formatCurrency(item.value, stats.activeCurrency)}</span>
                              <span className="text-[10px] font-bold text-on-surface-variant/50 mt-0.5">
                                {((item.value / stats.totalExpenses) * 100).toFixed(1)}% del gasto
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Financial Health Indicators */}
                        <div className="bg-primary/5 rounded-2xl p-5 border border-primary/10 space-y-4">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-black text-primary uppercase tracking-widest">Salud Financiera & Estructura</h5>
                            <span className={cn(
                              "text-xs font-black px-2 py-0.5 rounded-md",
                              stats.fixedCoverage > 50 ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            )}>
                              {stats.fixedCoverage.toFixed(1)}% Compromiso Fijo
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs font-semibold text-on-surface/70">
                              <span>Compromiso de Ingresos en Gastos Fijos</span>
                              <span className="font-bold">{stats.fixedCoverage.toFixed(1)}% (Meta: &lt; 50%)</span>
                            </div>
                            <div className="w-full h-2 bg-on-surface/5 rounded-full overflow-hidden">
                              <div 
                                className={cn("h-full transition-all duration-1000", stats.fixedCoverage > 50 ? "bg-rose-500" : "bg-emerald-500")}
                                style={{ width: `${Math.min(stats.fixedCoverage, 100)}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-on-surface-variant/60 leading-relaxed">
                              Según la regla de finanzas personales 50/30/20, se recomienda que tus gastos fijos (necesidades básicas) no superen el 50% de tus ingresos netos.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </ChartCard>
                )}
              </div>
            )}

            {/* TAB: MIEMBROS */}
            {activeTab === 'members' && (
              <div className="space-y-8">
                <ChartCard title="Actividad por Miembro" icon={<Target size={18} />}>
                  {stats.userContributions.length === 0 ? (
                    <p className="text-center text-on-surface-variant text-sm py-8">
                      No hay transacciones registradas de miembros para este período.
                    </p>
                  ) : (
                    <div className="space-y-4 mt-4">
                      {stats.userContributions.map((user) => (
                        <div key={user.id} className="bg-on-surface/[0.02] p-5 rounded-2xl flex flex-col gap-3 border border-on-surface/5">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-on-surface">{user.name}</span>
                            <div className="flex gap-4">
                              <div className="text-right">
                                <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Gastos</p>
                                <p className="text-sm font-bold text-on-surface">{formatCurrency(user.expense, stats.activeCurrency)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Ingresos</p>
                                <p className="text-sm font-bold text-on-surface">{formatCurrency(user.income, stats.activeCurrency)}</p>
                              </div>
                            </div>
                          </div>
                          <div className="w-full h-2 bg-on-surface/[0.05] rounded-full overflow-hidden flex">
                            <div 
                              className="h-full bg-rose-500 transition-all duration-1000" 
                              style={{ width: `${(user.expense / (user.expense + user.income || 1)) * 100}%` }}
                            />
                            <div 
                              className="h-full bg-emerald-500 transition-all duration-1000" 
                              style={{ width: `${(user.income / (user.expense + user.income || 1)) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ChartCard>
              </div>
            )}
          </>
        )}
      </div>

      {/* Category Drill-Down Modal */}
      <AnimatePresence>
        {selectedCategoryModal && (
          <div 
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs"
            onClick={() => setSelectedCategoryModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-surface-container-lowest rounded-t-[2.5rem] sm:rounded-[2rem] border border-on-surface/10 shadow-2xl max-h-[85vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-on-surface/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs"
                    style={{ backgroundColor: selectedCategoryModal.color }}
                  >
                    <CategoryIconBadge name={selectedCategoryModal.icon} size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-on-surface tracking-tight">{selectedCategoryModal.name}</h3>
                      <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                        {(selectedCategoryModal.value || 0).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant font-medium">
                      {modalTransactions.length} {modalTransactions.length === 1 ? 'movimiento' : 'movimientos'} en este período
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCategoryModal(null)}
                  className="w-8 h-8 rounded-full bg-on-surface/5 hover:bg-on-surface/10 flex items-center justify-center text-on-surface-variant transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Subheader Summary */}
              <div className="px-6 py-3 bg-surface-container-low/50 flex items-center justify-between border-b border-on-surface/5">
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Total del rubro</span>
                <span className="text-base font-black font-headline text-on-surface">
                  {formatCurrency(selectedCategoryModal.amount, stats.activeCurrency)}
                </span>
              </div>

              {/* Modal Transactions List */}
              <div className="p-6 overflow-y-auto space-y-3 custom-scrollbar flex-1">
                {modalTransactions.length === 0 ? (
                  <p className="text-center text-on-surface-variant text-sm py-8">No se encontraron movimientos para este rubro en este período.</p>
                ) : (
                  modalTransactions.map((tx: any) => {
                    const txDate = safeToDate(tx.date);
                    return (
                      <div 
                        key={tx.id} 
                        className="p-3.5 bg-surface-container-low/60 rounded-2xl border border-on-surface/5 flex items-center justify-between gap-3 hover:bg-surface-container-low transition-colors"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-on-surface truncate">
                              {tx.description || selectedCategoryModal.name}
                            </span>
                            {tx.isInstallment && tx.installmentNumber && (
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                                Cuota {tx.installmentNumber}/{tx.totalInstallments || '?'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-on-surface-variant/70 font-medium">
                            <span>{txDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            {(tx.cardName || tx.paymentMethod) && (
                              <>
                                <span>•</span>
                                <span className="truncate">{tx.cardName || tx.paymentMethod}</span>
                              </>
                            )}
                            {tx.authorName && filterProject !== 'personal' && (
                              <>
                                <span>•</span>
                                <span className="truncate font-semibold">{tx.authorName}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={cn(
                            "text-xs font-black font-mono",
                            tx.type === 'expense' ? "text-rose-500" : "text-emerald-500"
                          )}>
                            {tx.type === 'expense' ? '-' : '+'}{formatCurrency(tx.amount, stats.activeCurrency)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-surface-container-low/40 border-t border-on-surface/5 text-center">
                <button
                  onClick={() => setSelectedCategoryModal(null)}
                  className="w-full py-2.5 bg-surface-container-lowest hover:bg-surface-container-low border border-on-surface/10 rounded-xl text-xs font-black text-on-surface uppercase tracking-wider transition-all"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface MainKPICardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color?: string;
  badge?: React.ReactNode;
  subtitle?: string;
}

const MainKPICard = ({ title, value, icon, color, badge, subtitle }: MainKPICardProps) => (
  <motion.div 
    whileHover={{ y: -2 }}
    className="bg-surface-container-lowest p-5 sm:p-6 rounded-[1.5rem] border border-on-surface/10 shadow-sm flex flex-col justify-between space-y-3"
  >
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">{title}</span>
      <div className="w-8 h-8 rounded-full bg-on-surface/5 flex items-center justify-center">
        {icon}
      </div>
    </div>
    <div>
      <h2 className={cn("text-xl sm:text-2xl font-bold tracking-tight font-headline", color)}>{value}</h2>
      {badge && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {badge}
        </div>
      )}
      {subtitle && (
        <p className="text-[10px] font-medium text-on-surface-variant/60 mt-1">{subtitle}</p>
      )}
    </div>
  </motion.div>
);

const SecondaryKPICard = ({ title, value, icon }: any) => (
  <div className="bg-surface-container-lowest p-5 rounded-2xl border border-on-surface/10 shadow-sm space-y-2">
    <div className="flex items-center gap-2 text-on-surface-variant/70">
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-widest">{title}</span>
    </div>
    <p className="text-lg font-bold text-on-surface tracking-tight">{value}</p>
  </div>
);

const ChartCard = ({ title, icon, children }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-surface-container-lowest p-6 rounded-[2rem] border border-on-surface/10 shadow-sm"
  >
    <div className="flex items-center gap-3 mb-2">
      <div className="w-8 h-8 rounded-xl bg-on-surface/5 flex items-center justify-center text-on-surface-variant">
        {icon}
      </div>
      <h3 className="text-base font-bold text-on-surface tracking-tight">{title}</h3>
    </div>
    {children}
  </motion.div>
);
