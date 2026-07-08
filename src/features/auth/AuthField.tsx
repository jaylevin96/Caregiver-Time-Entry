interface AuthFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  compact?: boolean;
}

export function AuthField({
  label,
  compact = false,
  className = '',
  ...props
}: AuthFieldProps) {
  return (
    <label className="block min-w-0">
      <span
        className={[
          'text-text-muted block font-medium',
          compact ? 'mb-1 text-xs' : 'mb-1.5 text-sm',
        ].join(' ')}
      >
        {label}
      </span>
      <input
        className={[
          'border-border bg-surface-raised focus:border-accent focus:ring-accent/20 w-full min-w-0 border outline-none focus:ring-2',
          compact
            ? 'rounded-lg px-2 py-2 text-sm'
            : 'rounded-xl px-4 py-3 text-base',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />
    </label>
  );
}
