'use client';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterButtonsProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

export function FilterButtons({ options, value, onChange }: FilterButtonsProps) {
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            value === option.value
              ? 'bg-[var(--color-accent)] text-white'
              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
          }`}
        >
          {option.label}
          {option.count !== undefined && (
            <span className="ml-2 text-xs opacity-75">({option.count})</span>
          )}
        </button>
      ))}
    </div>
  );
}


