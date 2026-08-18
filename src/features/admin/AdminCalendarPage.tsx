import { useState } from 'react';
import { AdminAllDaySheet } from '@/features/admin/AdminAllDaySheet';
import {
  ALL_CAREGIVERS_ID,
  CaregiverFilter,
} from '@/features/admin/CaregiverFilter';
import { useCaregivers } from '@/features/admin/useCaregivers';
import { CalendarContainer } from '@/features/calendar/CalendarContainer';
import { DayEntrySheet } from '@/features/time-entry/DayEntrySheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { InlineSpinner } from '@/components/ui/InlineSpinner';
import type { TimeEntry } from '@/types/database';

export function AdminCalendarPage() {
  const {
    profiles,
    caregivers,
    payCaregivers,
    loading: caregiversLoading,
    error: caregiversError,
    refresh,
  } = useCaregivers();
  const [selectedCaregiverId, setSelectedCaregiverId] = useState<string | null>(
    ALL_CAREGIVERS_ID,
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | undefined>();

  const filterCaregivers = payCaregivers.length > 0 ? payCaregivers : caregivers;
  const activeFilterId = selectedCaregiverId ?? ALL_CAREGIVERS_ID;
  const showAllCaregivers = activeFilterId === ALL_CAREGIVERS_ID;
  const activeCaregiver = profiles.find(
    (caregiver) => caregiver.id === activeFilterId,
  );

  function handleSelectDate(date: string, entry: TimeEntry | undefined) {
    setSelectedDate(date);
    setSelectedEntry(entry);
  }

  function handleFilterSelect(id: string) {
    setSelectedCaregiverId(id);
    setSelectedDate(null);
    setSelectedEntry(undefined);
  }

  return (
    <>
      {caregiversLoading ? (
        <div className="flex justify-center py-12">
          <InlineSpinner />
        </div>
      ) : caregiversError ? (
        <div className="px-3 py-3 sm:px-4 sm:py-4">
          <ErrorBanner message={caregiversError} onRetry={refresh} />
        </div>
      ) : filterCaregivers.length === 0 ? (
        <EmptyState
          title="No caregivers yet"
          description="Share the app link so caregivers can sign up from the login page."
        />
      ) : (
        <CalendarContainer
          caregiverId={activeFilterId}
          caregivers={profiles}
          onSelectDate={handleSelectDate}
          readOnly
          accentColor={showAllCaregivers ? undefined : activeCaregiver?.calendar_color}
          stickyHeader={
            <CaregiverFilter
              caregivers={filterCaregivers}
              selectedId={activeFilterId}
              onSelect={handleFilterSelect}
              showAllOption
              embedded
            />
          }
        />
      )}

      {showAllCaregivers ? (
        <AdminAllDaySheet
          open={selectedDate !== null}
          workDate={selectedDate}
          caregivers={profiles}
          onClose={() => setSelectedDate(null)}
        />
      ) : (
        <DayEntrySheet
          open={selectedDate !== null && !!activeCaregiver}
          workDate={selectedDate}
          entry={selectedEntry}
          caregiverId={activeFilterId}
          readOnly
          onClose={() => setSelectedDate(null)}
          onSaved={() => {}}
        />
      )}
    </>
  );
}
