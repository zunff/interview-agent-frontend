'use client';

import { cn } from '../lib/utils';

type NumberStepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  icon: React.ReactNode;
  /** 图标容器样式，如 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' */
  iconClassName?: string;
  onChange: (value: number) => void;
  ariaLabelDecrement?: string;
  ariaLabelIncrement?: string;
};

/**
 * 数字步进器组件：显示标签、图标、数值和增减按钮
 */
export default function NumberStepper({
  label,
  value,
  min,
  max,
  icon,
  iconClassName = 'bg-primary/10 text-primary',
  onChange,
  ariaLabelDecrement,
  ariaLabelIncrement,
}: NumberStepperProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/90 bg-background/70 p-4 transition-colors hover:border-primary/25 dark:bg-background/50">
      <div className="mb-3 flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
        <div className={cn('flex size-7 items-center justify-center rounded-lg', iconClassName)}>
          {icon}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
          {value}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange(Math.max(min, value - 1))}
            disabled={value <= min}
            className="flex size-8 items-center justify-center rounded-xl border border-border bg-background text-base font-semibold leading-none transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50 disabled:pointer-events-none"
            aria-label={ariaLabelDecrement ?? `减少${label}`}
          >
            −
          </button>
          <button
            type="button"
            onClick={() => onChange(Math.min(max, value + 1))}
            disabled={value >= max}
            className="flex size-8 items-center justify-center rounded-xl border border-border bg-background text-base font-semibold leading-none transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50 disabled:pointer-events-none"
            aria-label={ariaLabelIncrement ?? `增加${label}`}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
