import { useAuth } from '@/features/auth/useAuth';
import { Button } from '@/components/ui/Button';

interface AppShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AppShell({ title, subtitle, children, footer }: AppShellProps) {
  const { signOut } = useAuth();

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={
        {
          '--app-header-height':
            'calc(env(safe-area-inset-top) + 4.5rem)',
        } as React.CSSProperties
      }
    >
      <header className="border-border bg-surface-raised/95 supports-[backdrop-filter]:bg-surface-raised/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{title}</h1>
            {subtitle ? (
              <p className="text-text-muted truncate text-sm">{subtitle}</p>
            ) : null}
          </div>
          <Button variant="ghost" className="min-h-10 shrink-0 px-3 text-sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>

      <main
        className={[
          'mx-auto w-full max-w-lg flex-1',
          footer
            ? 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]'
            : 'pb-[max(1rem,env(safe-area-inset-bottom))]',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </main>

      {footer ? (
        <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-10 px-3 pb-[env(safe-area-inset-bottom)] sm:px-4">
          <div className="pointer-events-auto mx-auto max-w-lg">{footer}</div>
        </footer>
      ) : null}
    </div>
  );
}
