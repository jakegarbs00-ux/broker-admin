interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple';
  size?: 'sm' | 'md';
}

const variantStyles = {
  default: 'bg-[#f1f5f9] text-[#475569]',
  success: 'bg-[#d1fae5] text-[#065f46]',
  warning: 'bg-[#fef3c7] text-[#92400e]',
  error: 'bg-[#fee2e2] text-[#991b1b]',
  info: 'bg-[#dbeafe] text-[#1e40af]',
  purple: 'bg-[var(--color-accent-light)] text-[var(--color-accent)]',
};

const sizeStyles = {
  sm: 'px-3 py-1 text-xs',
  md: 'px-3 py-1 text-xs',
};

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-[9999px] ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {children}
    </span>
  );
}

// Helper function to get badge variant from application stage
export function getStageBadgeVariant(stage: string): BadgeProps['variant'] {
  switch (stage) {
    case 'created':
    case 'open':
      return 'default';
    case 'submitted':
    case 'pending':
      return 'warning';
    case 'in_credit':
    case 'processing':
      return 'info';
    case 'info_required':
      return 'warning';
    case 'approved':
    case 'shipped':
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
  const stageLabels: Record<string, string> = {
    info_required: 'Info Required',
    information_required: 'Info Required',
    in_credit: 'In Credit Review',
  };
  
  if (stageLabels[stage]) {
    return stageLabels[stage];
  }
  
  return stage
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}