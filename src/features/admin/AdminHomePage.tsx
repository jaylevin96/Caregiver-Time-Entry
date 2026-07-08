import { NavLink, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/features/auth/useAuth';
import { AdminCalendarPage } from '@/features/admin/AdminCalendarPage';
import { AdminPayPage } from '@/features/admin/AdminPayPage';
import { AdminSettingsPage } from '@/features/admin/AdminSettingsPage';
import { AdminUsersPage } from '@/features/admin/AdminUsersPage';

export function AdminHomePage() {
  const { profile } = useAuth();

  return (
    <AppShell
      title="Admin"
      subtitle={profile?.display_name}
      footer={<AdminNav />}
    >
      <Routes>
        <Route index element={<AdminCalendarPage />} />
        <Route path="pay" element={<AdminPayPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
      </Routes>
    </AppShell>
  );
}

function AdminNav() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    [
      'flex min-h-[4.5rem] flex-1 touch-manipulation flex-col items-center justify-center gap-1 px-2 py-3 text-sm font-medium transition-colors',
      isActive ? 'text-accent font-semibold' : 'text-text-muted',
    ].join(' ');

  return (
    <nav className="border-border bg-surface-raised/95 supports-[backdrop-filter]:bg-surface-raised/80 rounded-t-2xl border shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur">
      <div className="flex px-1">
        <NavLink to="/admin" end className={linkClass}>
          Calendar
        </NavLink>
        <NavLink to="/admin/pay" className={linkClass}>
          Pay
        </NavLink>
        <NavLink to="/admin/users" className={linkClass}>
          Users
        </NavLink>
        <NavLink to="/admin/settings" className={linkClass}>
          Settings
        </NavLink>
      </div>
    </nav>
  );
}
