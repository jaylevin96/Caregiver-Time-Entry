import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { CalendarContainer } from '@/features/calendar/CalendarContainer';
import { DayEntrySheet } from '@/features/time-entry/DayEntrySheet';
import { useAuth } from '@/features/auth/useAuth';
import type { TimeEntry } from '@/types/database';

export function CaregiverHomePage() {
  const { profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | undefined>();
  const [refreshSignal, setRefreshSignal] = useState(0);

  function handleSelectDate(date: string, entry: TimeEntry | undefined) {
    setSelectedDate(date);
    setSelectedEntry(entry);
  }

  return (
    <AppShell title="Calendar" subtitle={profile?.display_name}>
      <CalendarContainer
        caregiverId={profile?.id}
        caregivers={profile ? [profile] : []}
        onSelectDate={handleSelectDate}
        refreshSignal={refreshSignal}
        accentColor={profile?.calendar_color}
      />

      <DayEntrySheet
        open={selectedDate !== null}
        workDate={selectedDate}
        entry={selectedEntry}
        caregiverId={profile?.id ?? ''}
        onClose={() => setSelectedDate(null)}
        onSaved={() => setRefreshSignal((n) => n + 1)}
      />
    </AppShell>
  );
}
