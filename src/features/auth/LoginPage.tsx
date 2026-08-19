import { Link } from 'react-router-dom';
import { useRef, useState } from 'react';
import { useAuth } from '@/features/auth/useAuth';
import { Button } from '@/components/ui/Button';
import { AuthField } from '@/features/auth/AuthField';

export function LoginPage() {
  const { signIn } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    const result = await signIn(email.trim(), password);
    if (result.error) {
      setError(result.error);
    }

    setSubmitting(false);
  }

  function handleFormKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter' || submitting) return;

    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    event.preventDefault();

    if (target.type === 'email' && !password.trim()) {
      formRef.current
        ?.querySelector<HTMLInputElement>('input[type="password"]')
        ?.focus();
      return;
    }

    formRef.current?.requestSubmit();
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pt-[max(3rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Time Tracker</h1>
          <p className="text-text-muted mt-2 text-sm">
            Sign in to log or review caregiver hours
          </p>
        </div>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          onKeyDown={handleFormKeyDown}
          className="space-y-4"
        >
          <AuthField
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            enterKeyHint="next"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <AuthField
            label="Password"
            type="password"
            autoComplete="current-password"
            enterKeyHint="go"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error ? (
            <p className="text-danger text-sm" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-text-muted mt-6 text-center text-sm">
          New caregiver?{' '}
          <Link to="/signup" className="text-accent font-medium">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
