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
import { InlineSpinner } from '@/components/ui/InlineSpinner';
import type { TimeEntry } from '@/types/database';

export function AdminCalendarPage() {
  const { caregivers, loading: caregiversLoading } = useCaregivers();
  const [selectedCaregiverId, setSelectedCaregiverId] = useState<string | null>(
    ALL_CAREGIVERS_ID,
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | undefined>();

  const activeFilterId = selectedCaregiverId ?? ALL_CAREGIVERS_ID;
  const showAllCaregivers = activeFilterId === ALL_CAREGIVERS_ID;
  const activeCaregiver = caregivers.find(
    (caregiver) => caregiver.id === activeFilterId,
  );

  function handleSelectDate(date: string, entry: TimeEntry | undefined) {
    setSelectedDate(date);
    setSelectedEntry(entry);
  }

  return (
    <>
      {caregiversLoading ? (
        <div className="flex justify-center py-12">
          <InlineSpinner />
        </div>
      ) : caregivers.length === 0 ? (
        <EmptyState
          title="No caregivers yet"
          description="Share the app link so caregivers can sign up from the login page."
        />
      ) : (
        <CalendarContainer
          caregiverId={activeFilterId}
          caregivers={caregivers}
          onSelectDate={handleSelectDate}
          readOnly
          accentColor={showAllCaregivers ? undefined : activeCaregiver?.calendar_color}
          stickyHeader={
            <CaregiverFilter
              caregivers={caregivers}
              selectedId={activeFilterId}
              onSelect={setSelectedCaregiverId}
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
          caregivers={caregivers}
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
