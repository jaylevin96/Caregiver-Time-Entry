import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/features/auth/useAuth';
import { ProtectedRoute } from '@/app/ProtectedRoute';
import { LoginPage } from '@/features/auth/LoginPage';
import { SignUpPage } from '@/features/auth/SignUpPage';
import { CaregiverHomePage } from '@/features/caregiver/CaregiverHomePage';
import { AdminHomePage } from '@/features/admin/AdminHomePage';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

function AuthRedirect() {
  const { profile } = useAuth();
  return (
    <Navigate to={profile?.role === 'admin' ? '/admin' : '/'} replace />
  );
}

export function AppRoutes() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          session && profile ? <AuthRedirect /> : <LoginPage />
        }
      />

      <Route
        path="/signup"
        element={
          session && profile ? <AuthRedirect /> : <SignUpPage />
        }
      />

      <Route
        path="/"
        element={
          <ProtectedRoute allowedRoles={['caregiver']}>
            <CaregiverHomePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminHomePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to={
              !session
                ? '/login'
                : profile?.role === 'admin'
                  ? '/admin'
                  : '/'
            }
            replace
          />
        }
      />
    </Routes>
  );
}
