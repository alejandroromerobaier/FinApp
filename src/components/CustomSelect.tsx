import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { haptic } from '../lib/haptics';

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
}

export interface CustomSelectProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  align?: 'left' | 'right';
  maxHeight?: string;
  ariaLabel?: string;
}

export function CustomSelect<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  label,
  disabled = false,
  className,
  size = 'md',
  icon,
  align = 'left',
  maxHeight = 'max-h-64',
  ariaLabel
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val: T) => {
    haptic.selection();
    onChange(val);
    setIsOpen(false);
  };

  const toggleOpen = () => {
    if (disabled) return;
    haptic.light();
    setIsOpen((prev) => !prev);
  };

  const sizeClasses = {
    sm: 'py-2 px-3 text-xs rounded-xl min-h-[36px]',
    md: 'py-3 px-4 text-sm rounded-2xl min-h-[46px]',
    lg: 'py-4 px-5 text-base rounded-2xl min-h-[54px]'
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {label && (
        <label className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 px-1">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={toggleOpen}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || label || placeholder}
        className={cn(
          "w-full flex items-center justify-between gap-2.5 bg-surface-container-low hover:bg-surface-container text-on-surface border border-on-surface/10 font-bold transition-all text-left outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-2xs select-none",
          sizeClasses[size],
          isOpen && "ring-2 ring-primary/20 border-primary/40 bg-surface-container",
          disabled && "opacity-50 pointer-events-none cursor-not-allowed"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {icon && <span className="shrink-0 text-on-surface-variant">{icon}</span>}
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}

          <div className="min-w-0 flex-1">
            <span className={cn("block truncate leading-tight", !selectedOption && "text-on-surface-variant/50")}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>

          {selectedOption?.badge && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary shrink-0">
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          size={size === 'sm' ? 14 : 18}
          className={cn(
            "text-on-surface-variant/60 transition-transform duration-200 shrink-0",
            isOpen && "rotate-180 text-primary"
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            role="listbox"
            className={cn(
              "absolute z-50 mt-1.5 w-full min-w-[200px] bg-surface-container-lowest border border-on-surface/10 rounded-2xl shadow-xl overflow-hidden p-1.5 space-y-0.5",
              align === 'right' ? 'right-0' : 'left-0',
              maxHeight,
              "overflow-y-auto custom-scrollbar"
            )}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(opt.value)}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer text-xs sm:text-sm",
                    isSelected
                      ? "bg-primary/10 text-primary font-extrabold shadow-2xs"
                      : "text-on-surface hover:bg-surface-container-low font-medium"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <div className="min-w-0 flex-1">
                      <span className="block truncate leading-tight">{opt.label}</span>
                      {opt.description && (
                        <span className="block text-[11px] text-on-surface-variant font-normal truncate mt-0.5">
                          {opt.description}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {opt.badge && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-on-surface/5 text-on-surface-variant">
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && <Check size={16} className="text-primary shrink-0" />}
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
