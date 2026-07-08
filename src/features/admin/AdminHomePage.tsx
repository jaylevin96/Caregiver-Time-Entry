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
      'flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium',
      isActive ? 'text-accent' : 'text-text-muted',
    ].join(' ');

  return (
    <nav className="border-border bg-surface-raised/95 supports-[backdrop-filter]:bg-surface-raised/80 border-t backdrop-blur">
      <div className="mx-auto flex max-w-lg px-1 pb-[env(safe-area-inset-bottom)]">
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
