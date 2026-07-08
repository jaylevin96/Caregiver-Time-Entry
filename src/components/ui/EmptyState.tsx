interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <p className="text-base font-medium">{title}</p>
      {description ? (
        <p className="text-text-muted mt-2 max-w-xs text-sm">{description}</p>
      ) : null}
    </div>
  );
}
