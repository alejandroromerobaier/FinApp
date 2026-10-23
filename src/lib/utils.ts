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

/**
 * Formats an integer string with thousand separator dots (e.g. 1000000 -> 1.000.000)
 */
export function formatNumberWithDots(val: string): string {
  return val.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formats a live user input string into Spanish monetary mask (thousands '.' and decimal ',').
 * Returns the masked display string, the raw decimal string suitable for parseFloat (e.g. "1250.50"),
 * and the numeric float value.
 */
export function formatCurrencyInput(val: string | number | null | undefined): { display: string; raw: string; numeric: number } {
  if (val === undefined || val === null || val === '') {
    return { display: '', raw: '', numeric: 0 };
  }

  let str = String(val).trim();
  if (!str) return { display: '', raw: '', numeric: 0 };

  const endsWithSeparator = str.endsWith('.') || str.endsWith(',');

  if (str.endsWith('.')) {
    str = str.slice(0, -1) + ',';
  }

  if (str.includes(',')) {
    const parts = str.split(',');
    let intPart = parts[0].replace(/\D/g, '');
    let decPart = parts.slice(1).join('').replace(/\D/g, '').slice(0, 2);

    intPart = intPart.replace(/^0+(?=\d)/, '') || (intPart ? '0' : '0');
    const formattedInt = formatNumberWithDots(intPart);

    const display = formattedInt + (decPart ? ',' + decPart : ',');
    const raw = intPart + (decPart ? '.' + decPart : (endsWithSeparator ? '.' : ''));
    const numeric = parseFloat(raw) || 0;
    return { display, raw, numeric };
  } else {
    let digits = str.replace(/\D/g, '');
    if (!digits) return { display: '', raw: '', numeric: 0 };
    digits = digits.replace(/^0+(?=\d)/, '');
    const display = formatNumberWithDots(digits);
    const raw = digits;
    const numeric = parseFloat(raw) || 0;
    return { display, raw, numeric };
  }
}

/**
 * Formats an existing numeric amount (from Firestore or state) to display format (e.g. 1500000 -> "1.500.000", 1500.5 -> "1.500,50")
 */
export function formatAmountForDisplay(amount: number | string | null | undefined): string {
  if (amount === undefined || amount === null || amount === '') return '';
  const num = typeof amount === 'string' ? parseFloat(amount.replace(/\./g, '').replace(',', '.')) : amount;
  if (isNaN(num) || num === 0) return '';
  const hasDecimals = num % 1 !== 0;
  const parts = num.toString().split('.');
  const intFormatted = formatNumberWithDots(parts[0]);
  if (hasDecimals && parts[1]) {
    return intFormatted + ',' + parts[1].slice(0, 2);
  }
  return intFormatted;
}

/**
 * Parses any formatted string or input value back to float number
 */
export function parseFormattedAmount(val: string | number | null | undefined): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const clean = val.replace(/\./g, '').replace(',', '.').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}
