interface InlineSpinnerProps {
  size?: 'sm' | 'md';
}

export function InlineSpinner({ size = 'md' }: InlineSpinnerProps) {
  const sizeClass = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8';

  return (
    <div
      className={`border-border border-t-accent animate-spin rounded-full border-2 ${sizeClass}`}
      role="status"
      aria-label="Loading"
    />
  );
}
