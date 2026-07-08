import { useAuthContext } from '@/features/auth/AuthProvider';

export function useAuth() {
  return useAuthContext();
}
