# Goal Description

Implement an admin-only "Reset Staff Password" feature. A logged-in Admin can set a new password for a Staff account directly (no email link). As a security check, the Admin must **re-enter their own current password** before the change is allowed. The Staff member's password is updated immediately using Supabase's `auth.admin` API via a server-side Edge Function — the `service_role` key must never reach the browser.

## Open Questions
None — schema and role check already agreed (`profiles.role = 'Admin' | 'Staff'`, `status`, `archived`).

## Proposed Changes

### Database Changes
Run in Supabase SQL Editor:

```sql
-- Track forced password change after an admin reset
alter table public.profiles
  add column if not exists must_change_password boolean default false;

-- Audit log for sensitive admin actions
create table if not exists public.admin_action_logs (
  id uuid default gen_random_uuid() primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  target_id uuid references public.profiles(id),
  created_at timestamptz default timezone('utc'::text, now())
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Admins can view all profiles"
on public.profiles for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'Admin' and p.archived = false
  )
);
```

### Edge Function
#### [NEW] `supabase/functions/admin-reset-password/index.ts`
- Verify caller's JWT (`supabaseClient.auth.getUser()`).
- Fetch caller's `profiles` row → reject if `role != 'Admin'`, `status != 'Active'`, or `archived = true`.
- **Re-authenticate the admin**: call `supabaseClient.auth.signInWithPassword({ email: caller.email, password: admin_current_password })` using the password sent in the request body. If this fails, return `401`.
- Validate `target_user_id` exists in `profiles` and is `role = 'Staff'` (admin resets staff only, not other admins, for this MVP).
- Validate `new_password` (min 8 chars).
- Use `service_role` client: `supabaseAdmin.auth.admin.updateUserById(target_user_id, { password: new_password })`.
- Set `profiles.must_change_password = true` for the target.
- Insert a row into `admin_action_logs` (`action: 'password_reset'`).
- Return `{ success: true }`.

Request body:
```json
{
  "admin_current_password": "string",
  "target_user_id": "uuid",
  "new_password": "string"
}
```

Env vars required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (set via `supabase secrets set`, never exposed client-side).

### Components and Utilities
#### [NEW] `src/components/Admin/ResetStaffPasswordModal.jsx`
- Fields: staff selector (or pre-filled from a "Reset Password" row action in the staff table), new password, confirm new password, **admin's current password**.
- Client-side check: new password === confirm, min 8 chars.
- On submit, call:
  ```js
  const { data, error } = await supabase.functions.invoke('admin-reset-password', {
    body: { admin_current_password, target_user_id, new_password }
  })
  ```
- Show success/error toast. Clear form on success.

#### [MODIFY] Staff management table/page (wherever staff list currently renders)
- Add a "Reset Password" action per Staff row → opens `ResetStaffPasswordModal` with `target_user_id` prefilled.
- Only render this action if the logged-in user's `role === 'Admin'`.

#### [NEW] Forced password change gate (post-login)
- On login/session load, check `profiles.must_change_password` for the current user.
- If `true`, redirect to a "Set New Password" screen before allowing dashboard access.
- On successful `supabase.auth.updateUser({ password })`, set `must_change_password = false`.

## Verification Plan
### Manual Verification
1. Log in as Admin, open Staff table, click "Reset Password" on a Staff row.
2. Enter new password + confirm + own admin password → submit.
3. Confirm success toast; confirm `admin_action_logs` has a new row.
4. Log out, log in as the affected Staff user with the new password → confirm forced redirect to "Set New Password" screen.
5. Set a new password as Staff → confirm redirect to dashboard and `must_change_password` is now `false`.
6. Negative test: submit with wrong admin password → expect `401` and no password change.
7. Negative test: log in as Staff and attempt to call the Edge Function directly (e.g., via curl/Postman) → expect `403`.