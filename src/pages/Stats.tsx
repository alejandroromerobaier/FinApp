import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, Legend 
} from 'recharts';
import { 
  Calendar, TrendingUp, TrendingDown, Wallet, Layers, Loader2, ChevronLeft, 
  ArrowUpRight, ArrowDownRight, Activity, PieChart as PieChartIcon, 
  BarChart3, Info, Clock, CreditCard, Target, Zap, Globe, PiggyBank,
  AlertTriangle, AlertCircle
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { getTransactions, getBudgets } from '../services/firestoreService';
import { getLocalMonth } from '../lib/dateUtils';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getCategoryIcon } from '../lib/categoryIcons';

type TimeRange = 'today' | 'week' | 'month' | 'lastMonth' | 'year';

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
  const [filterProject, setFilterProject] = useState<string>('all');
  const [viewType, setViewType] = useState<'expense' | 'income'>('expense');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('');
  const [periodBudgets, setPeriodBudgets] = useState<any[]>([]);

  const activeMonthDate = useMemo(() => {
    const now = new Date();
    if (timeRange === 'lastMonth') {
      return new Date(now.getFullYear(), now.getMonth() - 1, 1);
    }
    return now;
  }, [timeRange]);

  const targetMonthStr = useMemo(() => {
    return getLocalMonth(activeMonthDate);
  }, [activeMonthDate]);

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
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

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
        if (timeRange === 'today') return d.toDateString() === now.toDateString();
        if (timeRange === 'week') {
          const weekAgo = new Date();
          weekAgo.setDate(now.getDate() - 7);
          return d >= weekAgo;
        }
        if (timeRange === 'month') return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        if (timeRange === 'lastMonth') {
          const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          const yearOfLastMonth = currentMonth === 0 ? currentYear - 1 : currentYear;
          return d.getMonth() === lastMonth && d.getFullYear() === yearOfLastMonth;
        }
        if (timeRange === 'year') return d.getFullYear() === currentYear;
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
      
      // Days in period for daily average
      let daysInPeriod = 1;
      if (timeRange === 'week') daysInPeriod = 7;
      else if (timeRange === 'month') daysInPeriod = now.getDate(); 
      else if (timeRange === 'lastMonth') {
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth(), 0);
        daysInPeriod = lastMonthDate.getDate();
      } else if (timeRange === 'year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        daysInPeriod = Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
      }
      
      const dailyAverage = totalExpenses / (daysInPeriod || 1);
      const avgPerTransaction = expenses.length > 0 ? totalExpenses / expenses.length : 0;

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
          const yesterday = new Date(now);
          yesterday.setDate(now.getDate() - 1);
          return d.toDateString() === yesterday.toDateString();
        }
        if (timeRange === 'week') {
          const twoWeeksAgo = new Date(now);
          twoWeeksAgo.setDate(now.getDate() - 14);
          const oneWeekAgo = new Date(now);
          oneWeekAgo.setDate(now.getDate() - 7);
          return d >= twoWeeksAgo && d < oneWeekAgo;
        }
        if (timeRange === 'month') {
          const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
          return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
        }
        if (timeRange === 'lastMonth') {
          const twoMonthsAgoMonth = currentMonth <= 1 ? (currentMonth === 0 ? 10 : 11) : currentMonth - 2;
          const twoMonthsAgoYear = currentMonth <= 1 ? currentYear - 1 : currentYear;
          return d.getMonth() === twoMonthsAgoMonth && d.getFullYear() === twoMonthsAgoYear;
        }
        if (timeRange === 'year') {
          return d.getFullYear() === currentYear - 1;
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
        prevIncome
      };
    } catch (e) {
      console.error("Error calculating stats:", e);
      return null;
    }
  }, [transactions, timeRange, categories, filterProject, viewType, userNames, projects, profile, selectedCurrency, periodBudgets]);

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
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 sm:mb-12">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="w-10 h-10 flex items-center justify-center bg-surface-container-low hover:bg-on-surface/5 rounded-2xl transition-all active:scale-90 border border-on-surface/5"
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
        
        <div className="hidden sm:flex items-center gap-2 text-primary bg-primary/5 px-4 py-2 rounded-2xl border border-primary/10">
          <Calendar size={16} />
          <span className="text-xs font-black uppercase tracking-widest">{activeMonthDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
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

            {/* Budget Comparison Chart */}
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

            {/* Impact Category Share of Income */}
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
                    <p className="text-[10px] text-on-surface-variant/60 leading-tight">
                      Este gráfico muestra qué porcentaje de tus **ingresos totales** consume cada categoría. 
                      Te ayuda a identificar dónde se va la mayor parte de tu dinero relativo a lo que generas.
                    </p>
                  </div>
                </div>
              </ChartCard>
            )}

            {/* Distribution & Category Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ChartCard title="Distribución" icon={<PieChartIcon size={18} />}>
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
                  <div className="w-full mt-6 space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {(viewType === 'expense' ? stats.distribution : stats.incomeDistribution).map((item) => (
                      <div key={item.name} className="relative overflow-hidden p-2.5 bg-surface-container-low/40 rounded-xl hover:bg-surface-container-low transition-colors border border-on-surface/5">
                        <div 
                          className="absolute left-0 top-0 bottom-0 bg-on-surface/[0.03] -z-10 rounded-xl"
                          style={{ width: `${Math.min(item.value, 100)}%` }}
                        />
                        <div className="flex justify-between items-center gap-2 relative z-10">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div 
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs" 
                              style={{ backgroundColor: item.color }}
                            >
                              <CategoryIconBadge name={item.icon} size={13} />
                            </div>
                            <div className="truncate">
                              <span className="text-xs font-bold text-on-surface block truncate">{item.name}</span>
                              <span className="text-[10px] font-mono text-on-surface-variant/60 block">
                                {formatCurrency(item.amount, stats.activeCurrency)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-mono font-black text-on-surface bg-surface-container-lowest px-2 py-0.5 rounded-md border border-on-surface/5">
                              {item.value.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </ChartCard>

              {/* Classification Breakdown Chart */}
              {viewType === 'expense' && stats.classificationData.length > 0 && (
                <div className="space-y-6">
                  <ChartCard title="Análisis de Estabilidad" icon={<Layers size={18} />}>
                    <div className="flex flex-col items-center py-4">
                      <div className="relative w-48 h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stats.classificationData}
                              cx="50%"
                              cy="50%"
                              innerRadius={65}
                              outerRadius={85}
                              paddingAngle={8}
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
                          <span className="text-[10px] font-bold text-on-surface/40 uppercase tracking-widest">Total</span>
                          <span className="text-sm font-black text-on-surface">{formatCurrency(stats.totalExpenses, stats.activeCurrency)}</span>
                        </div>
                      </div>
                      
                      <div className="w-full mt-6 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          {stats.classificationData.map((item) => (
                            <div key={item.name} className="flex flex-col p-3 bg-on-surface/[0.02] rounded-2xl border border-on-surface/5">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                                <span className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-wider">{item.name}</span>
                              </div>
                              <span className="text-sm font-black text-on-surface">{formatCurrency(item.value, stats.activeCurrency)}</span>
                              <span className="text-[9px] font-bold text-on-surface-variant/40">
                                {((item.value / stats.totalExpenses) * 100).toFixed(1)}% del gasto
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Financial Health Indicators */}
                        <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10">
                          <h5 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3">Salud Financiera</h5>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-semibold text-on-surface/60">Compromiso de Ingresos</span>
                              <span className={cn(
                                "text-xs font-black",
                                stats.fixedCoverage > 50 ? "text-rose-500" : "text-emerald-500"
                              )}>
                                {stats.fixedCoverage.toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-on-surface/5 rounded-full overflow-hidden">
                              <div 
                                className={cn("h-full transition-all duration-1000", stats.fixedCoverage > 50 ? "bg-rose-500" : "bg-emerald-500")}
                                style={{ width: `${Math.min(stats.fixedCoverage, 100)}%` }}
                              />
                            </div>
                            <p className="text-[9px] text-on-surface-variant/40 leading-tight">
                              Representa cuánto de tus ingresos se va en gastos fijos. Mantenerlo debajo del 50% es ideal.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </ChartCard>
                </div>
              )}

              <ChartCard title={`${viewType === 'expense' ? 'Gasto' : 'Ingreso'} por Categoría`} icon={<BarChart3 size={18} />}>
                <div className="h-[400px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={(viewType === 'expense' ? stats.distribution : stats.incomeDistribution).slice(0, 10)} margin={{ left: -20, right: 20 }}>
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--color-on-surface-variant)' }}
                        width={80}
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
                      />
                      <Bar 
                        dataKey="amount" 
                        radius={[0, 10, 10, 0]} 
                        barSize={12}
                        animationDuration={1500}
                      >
                        {(viewType === 'expense' ? stats.distribution : stats.incomeDistribution).slice(0, 10).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>

            {/* User Activity Project Shared Only */}
            {filterProject !== 'all' && filterProject !== 'personal' && (
              <ChartCard title="Actividad por Miembro" icon={<Target size={18} />}>
                <div className="space-y-4 mt-4">
                  {stats.userContributions.map((user) => (
                    <div key={user.id} className="bg-on-surface/[0.02] p-5 rounded-2xl flex flex-col gap-3">
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
              </ChartCard>
            )}


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
          </>
        )}
      </div>
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
