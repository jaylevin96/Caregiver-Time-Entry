# Supabase Setup — Time Tracker

This app lives in the **`care_hours`** schema inside your existing Supabase project, separate from `public.profiles` and reservations tables.

## 1. Run the migration

1. Open **Supabase Dashboard → SQL Editor**
2. Paste the contents of `supabase/migrations/001_care_hours_schema.sql`
3. Click **Run**
4. Confirm no errors

## 2. Expose the schema to the API

The React app reads from `care_hours`, not `public`.

1. **Project Settings → API**
2. Find **Exposed schemas**
3. Add `care_hours` (keep `public` if your other app needs it)
4. Save

Without this step, Supabase JS queries to `care_hours` will fail.

## 3. Run admin user management migration

Run `supabase/migrations/002_admin_user_management.sql` in the SQL Editor.

This adds:

- `create_care_hours_profile()` — link an auth user to the app (caregiver or admin)
- `set_user_role()` — promote/demote users (also in the app under Admin → Users)

## 4. Enable email sign-up

Caregivers register in the app. This setting applies project-wide.

1. **Authentication → Providers → Email**
2. Turn **on** **Enable email signups**

Optional: under **Authentication → Email**, disable **Confirm email** if you want instant access without a confirmation link (fine for a private family app).

## 5. Run caregiver self-registration migration

Run `supabase/migrations/003_caregiver_self_registration.sql` in the SQL Editor.

This adds:

- Auto-create `care_hours.profiles` (role = `caregiver`) when someone signs up
- `ensure_caregiver_profile()` — backfill profile for existing auth users on first login

Admins are **never** self-assigned. Promote via Admin → Users or `set_user_role()`.

## 6. Block future-week time entry

Run `supabase/migrations/004_no_future_week_entries.sql` in the SQL Editor.

Caregivers cannot log hours for dates after the current Mon–Sun week (enforced in RLS and the app).

## 6b. Later migrations (expenses, deactivate, inactive profile)

Run these in order in the SQL Editor if they are not applied yet:

- `005_expense_line_items.sql` — expense reimbursements
- `006_deactivate_user.sql` — admin deactivate
- `007_inactive_profile_select.sql` — deactivated users can load their own profile so the app shows **Account inactive**

## 7. Bootstrap admin (your existing user)

Use **your** Supabase auth account as the first admin while building. Your dad can get his own admin account later (same steps — `role = 'admin'`).

Because no admin exists yet, RLS blocks normal app inserts. Run this **once** in the SQL Editor after the migration.

**Option A — by email** (easiest; replace email and display name):

```sql
INSERT INTO care_hours.profiles (id, email, display_name, role)
SELECT id, email, 'Jay', 'admin'
FROM auth.users
WHERE email = 'your-email@example.com';
```

**Option B — by UUID** from **Authentication → Users**:

```sql
INSERT INTO care_hours.profiles (id, email, display_name, role)
VALUES (
  'PASTE-YOUR-AUTH-USER-UUID',
  'your-email@example.com',
  'Jay',
  'admin'
);
```

Verify:

```sql
SELECT id, email, display_name, role
FROM care_hours.profiles
WHERE role = 'admin';
```

This does **not** modify `public.profiles` (reservations app). Same auth user, separate row in `care_hours.profiles`.

**Add your dad later** when ready:

1. **Authentication → Users → Add user**
2. Insert his row into `care_hours.profiles` with `role = 'admin'` (you can do this from SQL Editor or the app once it exists)

## 7. Caregiver sign-up (in the app)

No manual setup needed. Caregivers go to **Create an account** on the login page.

To add a custom hourly rate after they sign up:

```sql
INSERT INTO care_hours.caregiver_rates (caregiver_id, hourly_rate, effective_from)
SELECT id, 30.00, CURRENT_DATE
FROM care_hours.profiles
WHERE email = 'caregiver@example.com';
```

## 8. Promote a user to admin (SQL or app)

**In the app:** Admin → Users → **Make admin**

**In SQL:**

```sql
SELECT * FROM care_hours.set_user_role(
  'USER-UUID',
  'admin'
);
```

## 9. Verify locking logic (optional)

```sql
-- Week of Mon Jul 6 – Sun Jul 12, 2026 locks Wed Jul 15 00:00 Chicago
SELECT care_hours.payroll_lock_date('2026-07-10'::date);  -- → 2026-07-15

-- Unpaid entry editable until lock instant
SELECT care_hours.is_entry_locked('2026-07-10'::date, NULL, '2026-07-14 23:59:00-05'::timestamptz);  -- false
SELECT care_hours.is_entry_locked('2026-07-10'::date, NULL, '2026-07-15 00:00:00-05'::timestamptz);  -- true
```

## 10. Test data (optional)

Run as admin context or directly in SQL Editor (bypasses RLS):

```sql
-- Replace UUIDs with a real caregiver and admin UUID
INSERT INTO care_hours.time_entries (
  caregiver_id, work_date, hours, notes, created_by, updated_by
) VALUES (
  'CAREGIVER-UUID',
  '2026-07-01',
  8.00,
  'Morning shift',
  'CAREGIVER-UUID',
  'CAREGIVER-UUID'
);
```

## 11. Mark entries paid (admin)

Once the app exists, this happens in the UI. For now, call the DB function (must be logged in as admin via Supabase client, or test in SQL Editor by temporarily using service role):

```sql
SELECT * FROM care_hours.mark_entries_paid(
  'CAREGIVER-UUID',
  '2026-07-01'::date,
  '2026-07-07'::date,
  'Paid via Zelle'
);
```

This creates one `payments` row and links all unpaid entries in that range.

## Environment variables (for Step 2 — React app)

You'll need these from **Project Settings → API**:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Schema overview

| Table | Purpose |
|-------|---------|
| `care_hours.profiles` | App users (caregiver / admin) — separate from `public.profiles` |
| `care_hours.caregiver_rates` | Per-caregiver rate history |
| `care_hours.time_entries` | One row per caregiver per day |
| `care_hours.payments` | Payment batches (Zelle copy source) |
| `care_hours.settings` | Default rate, timezone, payment template |

## Important notes

- **Two profile tables**: `public.profiles` (reservations app) and `care_hours.profiles` (this app) can point to the same `auth.users` row if someone uses both apps — usually they won't overlap.
- **Quarter hours only**: entries must be 0.25, 0.50, 0.75, 1.00, etc.
- **Paid badge**: `payment_id IS NOT NULL` on a time entry.
- **Locked badge**: payroll week closed and not yet paid (caregivers cannot edit).
