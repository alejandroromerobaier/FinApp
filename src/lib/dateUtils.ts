
/**
 * Returns the current date in YYYY-MM-DD format based on local time.
 */
export const getLocalToday = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getLocalMonth = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const parseLocalMonth = (monthStr: string): Date => {
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(year, month - 1, 1);
};

/**
 * Returns a YYYY-MM-DD string from a Date object based on local time.
 */
export const formatLocalYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parses a YYYY-MM-DD string into a Date object representing local midnight.
 */
export const parseLocalYYYYMMDD = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Using the constructor with year, month (0-indexed), day creates a local Date
  return new Date(year, month - 1, day);
};

/**
 * Formats a date for display in Spanish (es-ES).
 */
export const formatDisplayDate = (date: Date | string, includeToday = true): string => {
  // For string inputs (likely YYYY-MM-DD), we parse as local midnight
  // For Date objects, we use them as is (preserving original time if present)
  const d = typeof date === 'string' ? parseLocalYYYYMMDD(date) : date;
  
  // Set comparison time to middle of day to avoid day-shifts during date-only comparisons
  const compareDate = new Date(d);
  compareDate.setHours(12, 0, 0, 0);
  
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const formatted = d.toLocaleDateString('es-ES', options);
  
  if (includeToday && compareDate.toDateString() === today.toDateString()) {
    return `Hoy, ${formatted}`;
  }
  
  return formatted;
};
