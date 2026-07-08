interface AuthFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function AuthField({ label, className = '', ...props }: AuthFieldProps) {
  return (
    <label className="block">
      <span className="text-text-muted mb-1.5 block text-sm">{label}</span>
      <input
        className={[
          'border-border bg-surface-raised focus:border-accent focus:ring-accent/20 w-full rounded-xl border px-4 py-3 text-base outline-none focus:ring-2',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />
    </label>
  );
}
