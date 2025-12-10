interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple';
  size?: 'sm' | 'md';
}

const variantStyles = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
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