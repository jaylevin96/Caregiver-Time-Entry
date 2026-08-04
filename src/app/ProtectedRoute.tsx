import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/useAuth';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Button } from '@/components/ui/Button';
import type { UserRole } from '@/types/database';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

function AccessMessage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-text-muted mt-2 max-w-sm text-sm">{description}</p>
      </div>
      <Button variant="secondary" onClick={signOut}>
        Sign out
      </Button>
    </div>
  );
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return (
      <AccessMessage
        title="Setting up your account"
        description="We couldn't load your Time Tracker profile. Try signing out and back in."
      />
    );
  }

  if (!profile.is_active) {
    return (
      <AccessMessage
        title="Account inactive"
        description="Your account has been deactivated."
      />
    );
  }

  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/'} replace />;
  }

  return children;
}
