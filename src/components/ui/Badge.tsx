interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple';
  size?: 'sm' | 'md';
}

const variantStyles = {
  default: 'bg-[var(--color-info-light)] text-[var(--color-info)]',
  success: 'bg-[var(--color-success-light)] text-[var(--color-success)]',
  warning: 'bg-[var(--color-warning-light)] text-[var(--color-warning)]',
  error: 'bg-[var(--color-error-light)] text-[var(--color-error)]',
  info: 'bg-[var(--color-info-light)] text-[var(--color-info)]',
  purple: 'bg-[var(--color-accent-light)] text-[var(--color-accent)]',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {children}
    </span>
  );
}

// Helper function to get badge variant from application stage
export function getStageBadgeVariant(stage: string): BadgeProps['variant'] {
  switch (stage) {
    case 'created':
      return 'default';
    case 'submitted':
      return 'info';
    case 'in_credit':
      return 'purple';
    case 'info_required':
      return 'warning';
    case 'approved':
      return 'success';
    case 'onboarding':
      return 'info';
    case 'funded':
      return 'success';
    case 'declined':
      return 'error';
    case 'withdrawn':
      return 'default';
    default:
      return 'default';
  }
}

// Format stage for display
export function formatStage(stage: string): string {
  return stage
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}