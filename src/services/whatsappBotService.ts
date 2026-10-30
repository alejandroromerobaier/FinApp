import { 
  addTransaction, 
  deleteTransaction, 
  getLatestUserTransaction 
} from './firestoreService';
import { parseVoiceTextToTransaction, ParsedVoiceTransaction } from './aiVoiceService';
import { formatCurrency } from '../lib/utils';

export interface BotContext {
  userId: string;
  userName: string;
  currency: string;
  categories: { id: string; name: string; type: string; color?: string; icon?: string }[];
  projects: { id: string; name: string }[];
  transactions: any[];
  budgets?: Record<string, number>;
}

export interface BotResponse {
  replyText: string;
  actionTaken?: 'transaction_created' | 'transaction_deleted' | 'query_answered' | 'help_shown';
  createdTransaction?: any;
}

/**
 * Intelligent WhatsApp message processor.
 * Analyzes the user's intent, interacts with Firestore, and formats WhatsApp-style replies.
 */
export const processWhatsAppMessage = async (
  messageText: string,
  context: BotContext
): Promise<BotResponse> => {
  const trimmed = messageText.trim();
  const lower = trimmed.toLowerCase();

  // 1. GREETING / HELP
  if (/^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|menu|ayuda|help|info|\?)$/i.test(lower)) {
    return {
      actionTaken: 'help_shown',
      replyText: `👋 *¡Hola ${context.userName || ''}!* Soy tu asistente financiero de *FinApp* en WhatsApp.\n\n` +
        `Podés hablarme con total naturalidad o mandarme notas de voz. Acá te muestro lo que podés hacer:\n\n` +
        `💸 *Registrar Gastos o Ingresos:*\n` +
        `• _"Gasté 15.000 en el súper con débito"_\n` +
        `• _"Cargué 40 lucas de nafta en efectivo"_\n` +
        `• _"Cobré 450.000 de sueldo transferencia"_\n` +
        `• _"Cena 28.000 con tarjeta en proyecto Vacaciones"_\n\n` +
        `📊 *Consultas e Informes:*\n` +
        `• _"¿Cuánto gasté este mes?"_\n` +
        `• _"¿Cuánto llevo gastado en comida?"_\n` +
        `• _"¿Cómo vengo con los presupuestos?"_\n` +
        `• _"¿Cuánto gasté hoy?"_\n\n` +
        `↩️ *Correcciones:*\n` +
        `• _"Deshacer"_ o _"Borrar último gasto"_`
    };
  }

  // 2. UNDO / DELETE LAST TRANSACTION
  if (/\b(deshacer|deshacé|anular|borrar ultimo|borrar último|eliminar ultimo|eliminar último|cancelar ultimo)\b/i.test(lower)) {
    const latestTx = await getLatestUserTransaction(context.userId);
    if (!latestTx) {
      return {
        actionTaken: 'query_answered',
        replyText: `⚠️ *No se encontraron movimientos recientes* para anular en tu cuenta.`
      };
    }

    // Check if created within reasonable time (e.g. 24 hours)
    await deleteTransaction(latestTx.id);
    const formattedAmount = formatCurrency(latestTx.amount, context.currency || 'ARS');

    return {
      actionTaken: 'transaction_deleted',
      replyText: `🗑️ *Movimiento anulado correctamente:*\n\n` +
        `• *Detalle:* ${latestTx.description || latestTx.categoryName || 'Gasto'}\n` +
        `• *Monto:* ${formattedAmount}\n` +
        `• *Categoría:* ${latestTx.categoryName || 'General'}\n\n` +
        `El saldo y tus estadísticas se actualizaron en FinApp.`
    };
  }

  // 3. BUDGET STATUS QUERY
  if (/\b(presupuesto|presupuestos|limite|límites|limites)\b/i.test(lower)) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Filter current month expenses
    const monthlyExpenses = context.transactions.filter(t => {
      if (t.type !== 'expense') return false;
      const d = t.date instanceof Date ? t.date : new Date(t.date);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return mStr === currentMonth;
    });

    // Sum by category
    const spentByCategory: Record<string, number> = {};
    monthlyExpenses.forEach(t => {
      const cat = t.categoryName || 'Otros';
      spentByCategory[cat] = (spentByCategory[cat] || 0) + (Number(t.amount) || 0);
    });

    const budgets = context.budgets || {};
    const budgetEntries = Object.entries(budgets);

    if (budgetEntries.length === 0) {
      return {
        actionTaken: 'query_answered',
        replyText: `🎯 *Presupuestos Mensuales*\n\n` +
          `Aún no tenés presupuestos asignados para este mes en FinApp.\n` +
          `💡 _Podés configurarlos desde la pestaña Presupuestos en la app web._`
      };
    }

    let report = `🎯 *Estado de tus Presupuestos (${currentMonth})*\n━━━━━━━━━━━━━━━━━━\n`;
    for (const [catName, budgetAmount] of budgetEntries) {
      const spent = spentByCategory[catName] || 0;
      const pct = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;
      let statusIcon = '🟢';
      if (pct >= 100) statusIcon = '🔴';
      else if (pct >= 80) statusIcon = '🟡';

      report += `${statusIcon} *${catName}:* ${formatCurrency(spent, context.currency)} / ${formatCurrency(budgetAmount, context.currency)} (${pct}%)\n`;
    }
    report += `━━━━━━━━━━━━━━━━━━\n💡 _Verde: <80% | Amarillo: 80-99% | Rojo: Superado_`;

    return {
      actionTaken: 'query_answered',
      replyText: report
    };
  }

  // 4. GENERAL SUMMARY / BALANCE (MONTH, WEEK, TODAY)
  const isSummaryQuery = /\b(cuanto gaste|cuánto gasté|cuanto llevo|cuánto llevo|resumen|balance|total gastado|gastos de este mes|gastos del mes|gastos hoy|gastos de hoy)\b/i.test(lower);
  if (isSummaryQuery) {
    const isToday = /\b(hoy|el dia|el día)\b/i.test(lower);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const filtered = context.transactions.filter(t => {
      const d = t.date instanceof Date ? t.date : new Date(t.date);
      const dStr = d.toISOString().slice(0, 10);
      if (isToday) return dStr === todayStr;
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return mStr === currentMonth;
    });

    let totalExpense = 0;
    let totalIncome = 0;
    const catExpenses: Record<string, number> = {};

    filtered.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'expense' || !t.type) {
        totalExpense += amt;
        const cName = t.categoryName || 'Otros';
        catExpenses[cName] = (catExpenses[cName] || 0) + amt;
      } else if (t.type === 'income') {
        totalIncome += amt;
      }
    });

    const netBalance = totalIncome - totalExpense;
    const sortedCats = Object.entries(catExpenses).sort((a, b) => b[1] - a[1]).slice(0, 3);

    const title = isToday ? `📅 *Resumen de Hoy*` : `📊 *Resumen Mensual (${currentMonth})*`;
    let res = `${title}\n━━━━━━━━━━━━━━━━━━\n` +
      `🔴 *Gastos Totales:* ${formatCurrency(totalExpense, context.currency)}\n` +
      `🟢 *Ingresos:* ${formatCurrency(totalIncome, context.currency)}\n` +
      `💰 *Balance:* ${netBalance >= 0 ? '+' : ''}${formatCurrency(netBalance, context.currency)}\n\n`;

    if (sortedCats.length > 0) {
      res += `🏆 *Mayores Gastos por Categoría:*\n`;
      sortedCats.forEach(([c, val], idx) => {
        res += `${idx + 1}. *${c}:* ${formatCurrency(val, context.currency)}\n`;
      });
      res += `━━━━━━━━━━━━━━━━━━\n`;
    }

    return {
      actionTaken: 'query_answered',
      replyText: res
    };
  }

  // 5. SPECIFIC CATEGORY SPENDING (e.g. "¿cuánto gasté en comida?", "¿cuánto gasté en nafta?")
  const matchedCategory = context.categories.find(c => lower.includes(c.name.toLowerCase()));
  if (matchedCategory && (lower.includes('gaste') || lower.includes('gasté') || lower.includes('cuanto') || lower.includes('cuánto'))) {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const catTxs = context.transactions.filter(t => {
      const matchCat = (t.categoryId === matchedCategory.id) || 
                       (t.categoryName && t.categoryName.toLowerCase() === matchedCategory.name.toLowerCase());
      if (!matchCat) return false;
      const d = t.date instanceof Date ? t.date : new Date(t.date);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return mStr === currentMonth;
    });

    const totalCatSpent = catTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    let catReport = `🏷️ *Gastos en ${matchedCategory.name} (${currentMonth})*\n━━━━━━━━━━━━━━━━━━\n` +
      `💸 *Total del mes:* ${formatCurrency(totalCatSpent, context.currency)} (${catTxs.length} movimientos)\n\n`;

    if (catTxs.length > 0) {
      catReport += `📝 *Últimos registros:*\n`;
      catTxs.slice(0, 4).forEach(t => {
        const d = t.date instanceof Date ? t.date : new Date(t.date);
        const dayStr = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
        catReport += `• ${dayStr}: ${formatCurrency(t.amount, context.currency)} - ${t.description || t.categoryName}\n`;
      });
      catReport += `━━━━━━━━━━━━━━━━━━`;
    }

    return {
      actionTaken: 'query_answered',
      replyText: catReport
    };
  }

  // 6. DEFAULT INTENT: RECORD A NEW TRANSACTION (Expense or Income)
  try {
    const parsed: ParsedVoiceTransaction = await parseVoiceTextToTransaction(
      trimmed,
      context.categories,
      context.projects,
      context.transactions
    );

    if (!parsed || !parsed.amount || parsed.amount <= 0) {
      return {
        actionTaken: 'help_shown',
        replyText: `🤔 No pude identificar un monto o movimiento claro en tu mensaje.\n\n` +
          `Ejemplo: _"Gasté 12.500 en supermercado con tarjeta"_\n` +
          `O escribí *Ayuda* para ver las opciones disponibles.`
      };
    }

    // Match category ID
    const targetCat = context.categories.find(c => 
      c.name.toLowerCase() === parsed.categoryName.toLowerCase()
    ) || context.categories[0];

    // Match project ID if shared
    let matchedProjectId: string | null = null;
    if (parsed.destinationType === 'shared' && parsed.projectName) {
      const p = context.projects.find(proj => proj.name.toLowerCase() === parsed.projectName?.toLowerCase());
      if (p) matchedProjectId = p.id;
    }

    const newTx = {
      type: parsed.type,
      amount: parsed.amount,
      description: parsed.description,
      categoryId: targetCat ? targetCat.id : 'others',
      categoryName: targetCat ? targetCat.name : parsed.categoryName,
      categoryIcon: targetCat?.icon || 'tag',
      categoryColor: targetCat?.color || '#3b82f6',
      paymentMethod: parsed.paymentMethod,
      classification: parsed.classification,
      projectId: matchedProjectId,
      date: new Date().toISOString().slice(0, 10)
    };

    // Save to Firestore
    await addTransaction(newTx);

    const formattedAmount = formatCurrency(parsed.amount, context.currency || 'ARS');
    const isExpense = parsed.type === 'expense';
    const destinationLabel = matchedProjectId 
      ? `📁 Proyecto: ${parsed.projectName}` 
      : `👤 Bóveda: Personal`;

    return {
      actionTaken: 'transaction_created',
      createdTransaction: newTx,
      replyText: `${isExpense ? '💸 *Gasto registrado*' : '💰 *Ingreso registrado*'} con éxito ✅\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `💵 *Monto:* ${formattedAmount}\n` +
        `🏷️ *Categoría:* ${newTx.categoryName}\n` +
        `📝 *Detalle:* ${parsed.description}\n` +
        `💳 *Método:* ${parsed.paymentMethod}\n` +
        `${destinationLabel}\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `💡 _Si te equivocaste, escribí "Deshacer"._`
    };
  } catch (error) {
    console.error('Error in WhatsApp bot parser:', error);
    return {
      actionTaken: 'help_shown',
      replyText: `⚠️ Ocurrió un error al procesar tu mensaje. Por favor intentá nuevamente o escribí *Ayuda*.`
    };
  }
};
