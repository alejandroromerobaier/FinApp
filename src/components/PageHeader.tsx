import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { haptic } from '../lib/haptics';

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  categoryTag?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  onBack?: () => void;
  backTo?: string;
  hideBack?: boolean;
  rightAction?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  breakpoint?: 'sm' | 'md';
  align?: 'start' | 'center';
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  categoryTag,
  icon,
  badge,
  onBack,
  backTo,
  hideBack = false,
  rightAction,
  className,
  children,
  breakpoint = 'md',
  align = 'center'
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    haptic.selection();
    if (onBack) {
      onBack();
    } else if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  const isMd = breakpoint === 'md';

  return (
    <header className={cn("space-y-4 pb-2", className)}>
      <div
        className={cn(
          "flex justify-between gap-4 sm:gap-6",
          isMd ? "flex-col md:flex-row" : "flex-col sm:flex-row",
          align === 'center'
            ? (isMd ? "md:items-center" : "sm:items-center")
            : (isMd ? "md:items-start" : "sm:items-start")
        )}
      >
        <div className="flex items-start gap-3.5 sm:gap-4 min-w-0 flex-1">
          {!hideBack && (
            <button
              type="button"
              onClick={handleBack}
              className="p-2.5 sm:p-3 bg-surface-container-low hover:bg-surface-container text-on-surface rounded-2xl border border-on-surface/10 shadow-xs transition-all active:scale-95 cursor-pointer shrink-0 mt-0.5"
              title="Volver"
              aria-label="Volver atrás"
            >
              <ArrowLeft size={20} />
            </button>
          )}

          <div className="min-w-0 flex-1">
            {categoryTag && (
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary block mb-1">
                {categoryTag}
              </span>
            )}

            <div className="flex items-center gap-2.5 flex-wrap">
              {icon && <span className="shrink-0">{icon}</span>}
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-on-surface font-headline leading-tight">
                {title}
              </h1>
              {badge && <span className="shrink-0">{badge}</span>}
            </div>

            {subtitle && (
              <p className="text-xs sm:text-sm text-on-surface-variant font-medium mt-1 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {rightAction && (
          <div
            className={cn(
              "flex items-center gap-2 shrink-0",
              isMd ? "w-full md:w-auto" : "w-full sm:w-auto"
            )}
          >
            {rightAction}
          </div>
        )}
      </div>

      {children && (
        <div className="pt-1">
          {children}
        </div>
      )}
    </header>
  );
};
