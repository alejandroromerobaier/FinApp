import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const formatterCache: Record<string, Intl.NumberFormat> = {};

export function formatCurrency(amount: number, currency: string = 'ARS') {
  try {
    const cacheKey = `${currency}-es-AR`;
    if (!formatterCache[cacheKey]) {
      formatterCache[cacheKey] = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
      });
    }
    return formatterCache[cacheKey].format(amount);
  } catch (e) {
    // Fallback in case of invalid currency code
    const fallbackKey = `ARS-es-AR`;
    if (!formatterCache[fallbackKey]) {
      formatterCache[fallbackKey] = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
      });
    }
    return formatterCache[fallbackKey].format(amount).replace('$', currency);
  }
}
