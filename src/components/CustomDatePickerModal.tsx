import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { haptic } from '../lib/haptics';
import { 
  getLocalToday, 
  getLocalYesterday, 
  parseLocalYYYYMMDD, 
  formatLocalYYYYMMDD 
} from '../lib/dateUtils';

export interface CustomDatePickerModalProps {
  isOpen: boolean;
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  onClose: () => void;
  title?: string;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const WEEKDAY_NAMES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

export const CustomDatePickerModal: React.FC<CustomDatePickerModalProps> = ({
  isOpen,
  selectedDate,
  onSelectDate,
  onClose,
  title = 'Seleccionar Fecha'
}) => {
  // Parse initial selected date to set current viewing month/year
  const initialDate = useMemo(() => {
    try {
      return selectedDate ? parseLocalYYYYMMDD(selectedDate) : new Date();
    } catch {
      return new Date();
    }
  }, [selectedDate]);

  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth()); // 0-indexed

  // When modal opens, sync view with selectedDate
  React.useEffect(() => {
    if (isOpen && selectedDate) {
      try {
        const d = parseLocalYYYYMMDD(selectedDate);
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      } catch {
        // keep current
      }
    }
  }, [isOpen, selectedDate]);

  const todayStr = getLocalToday();
  const yesterdayStr = getLocalYesterday();

  const handlePrevMonth = () => {
    haptic.selection();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    haptic.selection();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    // Total days in viewMonth
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    // Day of the week of 1st day (0 = Sunday, 1 = Monday, ...)
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();

    // Trailing days of previous month
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
    const prevDays: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevMonthNum = viewMonth === 0 ? 12 : viewMonth;
      const prevYearNum = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${prevYearNum}-${String(prevMonthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      prevDays.push({ day: d, dateStr, isCurrentMonth: false });
    }

    // Days in current month
    const currentDays: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      currentDays.push({ day: d, dateStr, isCurrentMonth: true });
    }

    // Leading days of next month to complete rows (multiples of 7)
    const totalFilled = prevDays.length + currentDays.length;
    const remaining = (7 - (totalFilled % 7)) % 7;
    const nextDays: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];
    for (let d = 1; d <= remaining; d++) {
      const nextMonthNum = viewMonth === 11 ? 1 : viewMonth + 2;
      const nextYearNum = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = `${nextYearNum}-${String(nextMonthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      nextDays.push({ day: d, dateStr, isCurrentMonth: false });
    }

    return [...prevDays, ...currentDays, ...nextDays];
  }, [viewYear, viewMonth]);

  const handleSelectDay = (dateStr: string) => {
    haptic.success();
    onSelectDate(dateStr);
    onClose();
  };

  const handleSelectPreset = (dateStr: string) => {
    haptic.selection();
    const d = parseLocalYYYYMMDD(dateStr);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    onSelectDate(dateStr);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Sheet */}
        <motion.div
          initial={{ y: 60, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 60, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative z-10 w-full max-w-md bg-surface-container-lowest rounded-t-[2.5rem] sm:rounded-[2.5rem] border border-on-surface/10 shadow-2xl p-6 sm:p-7 space-y-5 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-1 border-b border-on-surface/5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <CalendarIcon size={18} />
              </div>
              <h3 className="text-lg font-extrabold text-on-surface font-headline tracking-tight">
                {title}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-on-surface/5 transition-colors cursor-pointer"
              aria-label="Cerrar calendario"
            >
              <X size={18} />
            </button>
          </div>

          {/* Quick Shortcuts */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => handleSelectPreset(todayStr)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer active:scale-95 border",
                selectedDate === todayStr
                  ? "bg-primary text-white border-primary shadow-xs"
                  : "bg-surface-container-low text-on-surface-variant hover:text-on-surface border-transparent"
              )}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset(yesterdayStr)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer active:scale-95 border",
                selectedDate === yesterdayStr
                  ? "bg-primary text-white border-primary shadow-xs"
                  : "bg-surface-container-low text-on-surface-variant hover:text-on-surface border-transparent"
              )}
            >
              Ayer
            </button>
            <button
              type="button"
              onClick={() => {
                const firstDayMonth = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`;
                handleSelectPreset(firstDayMonth);
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-transparent transition-all shrink-0 cursor-pointer active:scale-95"
            >
              1° de mes
            </button>
          </div>

          {/* Month & Year Navigation */}
          <div className="flex items-center justify-between px-1 py-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer active:scale-90"
              aria-label="Mes anterior"
            >
              <ChevronLeft size={20} />
            </button>

            <span className="text-base font-extrabold text-on-surface font-headline capitalize">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer active:scale-90"
              aria-label="Mes siguiente"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_NAMES.map((name, i) => (
              <span
                key={name + i}
                className="text-[11px] font-black uppercase text-on-surface-variant/50 py-1"
              >
                {name}
              </span>
            ))}
          </div>

          {/* Calendar Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((item, index) => {
              const isSelected = item.dateStr === selectedDate;
              const isToday = item.dateStr === todayStr;

              return (
                <button
                  key={item.dateStr + index}
                  type="button"
                  onClick={() => handleSelectDay(item.dateStr)}
                  className={cn(
                    "h-10 w-full rounded-2xl flex flex-col items-center justify-center text-xs font-bold transition-all relative cursor-pointer active:scale-95",
                    !item.isCurrentMonth && "opacity-25 hover:opacity-50",
                    isSelected
                      ? "bg-primary text-white font-black shadow-md shadow-primary/30 ring-2 ring-primary/20 scale-105 z-10"
                      : isToday
                        ? "bg-primary/10 text-primary font-black hover:bg-primary/20"
                        : "text-on-surface hover:bg-surface-container-low"
                  )}
                >
                  <span>{item.day}</span>
                  {isToday && !isSelected && (
                    <span className="w-1 h-1 rounded-full bg-primary absolute bottom-1.5" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Close Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-surface-container-low hover:bg-surface-container text-on-surface font-extrabold text-xs rounded-2xl border border-on-surface/5 uppercase tracking-wider transition-all active:scale-98 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
