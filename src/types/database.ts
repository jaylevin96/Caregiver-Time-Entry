export type UserRole = 'caregiver' | 'admin';

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  calendar_color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: string;
  caregiver_id: string;
  work_date: string;
  hours: number;
  notes: string | null;
  payment_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface TimeEntryExpense {
  id: string;
  time_entry_id: string;
  hours: number;
  note: string;
  amount: number;
  payment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  caregiver_id: string;
  period_start: string;
  period_end: string;
  total_hours: number;
  hourly_rate: number;
  total_amount: number;
  total_reimbursement: number;
  paid_at: string;
  paid_by: string;
  notes: string | null;
  created_at: string;
}

export interface CaregiverRate {
  id: string;
  caregiver_id: string;
  hourly_rate: number;
  effective_from: string;
  created_at: string;
}

export interface Database {
  care_hours: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at' | 'is_active'> & {
          is_active?: boolean;
        };
        Update: Partial<Omit<Profile, 'id'>>;
      };
      time_entries: {
        Row: TimeEntry;
        Insert: Omit<
          TimeEntry,
          'id' | 'created_at' | 'updated_at' | 'payment_id'
        > & { payment_id?: string | null };
        Update: Partial<
          Omit<TimeEntry, 'id' | 'caregiver_id' | 'created_at' | 'created_by'>
        >;
      };
      time_entry_expenses: {
        Row: TimeEntryExpense;
        Insert: Omit<
          TimeEntryExpense,
          'id' | 'created_at' | 'updated_at' | 'payment_id'
        > & { payment_id?: string | null };
        Update: Partial<
          Omit<TimeEntryExpense, 'id' | 'time_entry_id' | 'created_at'>
        >;
      };
      payments: {
        Row: Payment;
        Insert: never;
        Update: never;
      };
      caregiver_rates: {
        Row: CaregiverRate;
        Insert: Omit<CaregiverRate, 'id' | 'created_at'>;
        Update: Partial<Omit<CaregiverRate, 'id' | 'caregiver_id'>>;
      };
      settings: {
        Row: {
          key: string;
          value: unknown;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: never;
        Update: {
          value?: unknown;
          updated_by?: string | null;
        };
      };
    };
    Functions: {
      ensure_caregiver_profile: {
        Args: Record<string, never>;
        Returns: Profile;
      };
      set_user_role: {
        Args: { p_user_id: string; p_role: UserRole };
        Returns: Profile;
      };
      create_care_hours_profile: {
        Args: {
          p_user_id: string;
          p_email: string;
          p_display_name: string;
          p_role?: UserRole;
        };
        Returns: Profile;
      };
      mark_entries_paid: {
        Args: {
          p_caregiver_id: string;
          p_period_start: string;
          p_period_end: string;
          p_notes?: string | null;
        };
        Returns: Payment;
      };
      is_entry_locked: {
        Args: {
          p_work_date: string;
          p_payment_id: string | null;
          p_as_of?: string;
        };
        Returns: boolean;
      };
    };
  };
}
