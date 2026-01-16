import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
  className?: string;
}

export function SummaryCard({ title, value, icon: Icon, trend, className = '' }: SummaryCardProps) {
  return (
    <div className={`bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)] p-5 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-[var(--color-text-secondary)] mb-1">{title}</p>
          <p className="text-3xl font-semibold text-[var(--color-text-primary)]">{value}</p>
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs ${trend.isPositive ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{trend.value}%</span>
              <span className="text-[var(--color-text-tertiary)]">{trend.label}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="p-2 bg-[var(--color-bg-tertiary)] rounded-lg">
            <Icon className="w-5 h-5 text-[var(--color-primary)]" />
          </div>
        )}
      </div>
    </div>
  );
}

