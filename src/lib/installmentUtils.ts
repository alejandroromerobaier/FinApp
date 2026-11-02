import { parseLocalYYYYMMDD, formatLocalYYYYMMDD } from './dateUtils';

export interface InstallmentOverride {
  amount?: number;
  date?: string; // YYYY-MM-DD
  status?: 'active' | 'deleted' | 'paid';
  paidAt?: any;
  note?: string;
}

/**
 * Expands raw transactions in memory.
 * Any transaction with `isInstallmentPlan: true` and `totalInstallments > 1`
 * is dynamically projected into N virtual monthly transactions according to its calendar and overrides.
 * Regular transactions and legacy single installments pass through directly.
 */
export const expandProjectedTransactions = (rawTransactions: any[]): any[] => {
  if (!rawTransactions || rawTransactions.length === 0) return [];

  const expanded: any[] = [];

  for (const tx of rawTransactions) {
    if (tx.isInstallmentPlan && tx.totalInstallments && tx.totalInstallments > 1) {
      const totalInstallments = Number(tx.totalInstallments);
      const txDate = tx.date instanceof Date 
        ? tx.date 
        : (typeof tx.date?.toDate === 'function' ? tx.date.toDate() : new Date(tx.date));

      const firstDueDateStr = tx.firstDueDate || (isNaN(txDate.getTime()) ? null : formatLocalYYYYMMDD(txDate));
      
      const baseDate = firstDueDateStr ? parseLocalYYYYMMDD(firstDueDateStr) : new Date();
      const startYear = baseDate.getFullYear();
      const startMonth = baseDate.getMonth();
      const targetDay = baseDate.getDate();

      const hours = !isNaN(txDate.getTime()) ? txDate.getHours() : 12;
      const minutes = !isNaN(txDate.getTime()) ? txDate.getMinutes() : 0;
      const seconds = !isNaN(txDate.getTime()) ? txDate.getSeconds() : 0;

      const baseInstallmentAmount = tx.installmentAmount || Math.round((tx.amount / totalInstallments) * 100) / 100;

      for (let i = 1; i <= totalInstallments; i++) {
        const override: InstallmentOverride | undefined = tx.overrides?.[i] || tx.overrides?.[String(i)];

        // If this installment was individually deleted, omit it from projection
        if (override?.status === 'deleted') {
          continue;
        }

        let installmentDate: Date;
        if (override?.date) {
          installmentDate = parseLocalYYYYMMDD(override.date);
          installmentDate.setHours(hours, minutes, seconds);
        } else {
          const totalMonthIndex = startMonth + (i - 1);
          const targetYear = startYear + Math.floor(totalMonthIndex / 12);
          const targetMonth = totalMonthIndex % 12;
          const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
          const finalDay = Math.min(targetDay, daysInTargetMonth);
          installmentDate = new Date(targetYear, targetMonth, finalDay, hours, minutes, seconds);
        }

        const installmentAmount = override?.amount !== undefined ? override.amount : baseInstallmentAmount;

        const purchaseDateStr = tx.purchaseDate || (tx.firstDueDate ? tx.firstDueDate : (!isNaN(txDate.getTime()) ? formatLocalYYYYMMDD(txDate) : null));

        expanded.push({
          ...tx,
          id: `${tx.id}_installment_${i}`,
          parentPlanId: tx.id,
          amount: installmentAmount,
          date: installmentDate,
          purchaseDate: purchaseDateStr,
          description: `${tx.description} (${i}/${totalInstallments})`,
          isInstallment: true,
          installmentNumber: i,
          totalInstallments,
          installmentPlanId: tx.id,
          isVirtualInstallment: true,
          installmentOverride: override || null
        });
      }
    } else {
      expanded.push(tx);
    }
  }

  // Chronological sort: newest first
  expanded.sort((a, b) => {
    const timeA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
    const timeB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
    return timeB - timeA;
  });

  return expanded;
};
