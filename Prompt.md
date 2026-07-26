# Manage Accounts – Full CRUD and Account Lifecycle Enhancement

## Objective

Enhance the **Manage Accounts** page of the system into a complete, professional **Account Management (CRUD)** module using the existing PostgreSQL/Supabase `public.profiles` table.

The current table schema is:

```sql
create table public.profiles (
  id uuid not null default extensions.uuid_generate_v4 (),
  employee_id text null,
  first_name text not null,
  last_name text not null,
  email text null,
  username text not null,
  password text not null,
  role text null default 'Staff'::text,
  status text null default 'Active'::text,
  created_at timestamp with time zone null default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_email_key unique (email),
  constraint profiles_employee_id_key unique (employee_id),
  constraint profiles_username_key unique (username)
) TABLESPACE pg_default;
```

---

## 1. Account List

Display all non-archived user accounts in a responsive data table.

### Columns

* Employee ID
* Full Name
* Username
* Email
* Role
* Status
* Date Created
* Actions

### Required Features

* Search by Employee ID
* Search by Name
* Search by Username
* Search by Email
* Filter by Role
* Filter by Status
* Sort by any relevant column
* Pagination
* Loading state or skeleton loader
* Empty state when no records are available
* Responsive layout

---

## 2. Create Account

Provide an **Add Account** button that opens a modal or dedicated form.

### Fields

* Employee ID
* First Name
* Last Name
* Email
* Username
* Password
* Confirm Password
* Role

### Requirements

* Validate all required fields.
* Employee ID must be unique.
* Username must be unique.
* Email must be unique when provided.
* Password and Confirm Password must match.
* Password must meet the system's minimum security requirements.
* Display clear inline validation messages.
* Show a success toast after successful creation.
* Refresh the account list automatically after creation.

---

## 3. Edit Account

Allow authorized administrators to edit:

* Employee ID
* First Name
* Last Name
* Email
* Username
* Role
* Status

### Password Handling

Do not display the existing password.

Provide a separate **Change Password** action with:

* New Password
* Confirm Password

Only update the password when a new password is intentionally provided.

---

## 4. View Account

Provide a **View** action for each account.

Display the following information in a modal or details panel:

* Employee ID
* Full Name
* Username
* Email
* Role
* Status
* Date Created

Do not display passwords or password hashes.

---

## 5. Delete Account

Provide a permanent delete action with a confirmation dialog.

Example confirmation:

> Are you sure you want to permanently delete this account?

Buttons:

* Cancel
* Delete

Permanent deletion should remove the account from the database.

Clearly distinguish **Delete** from **Archive** so administrators understand that deletion is permanent.

---

## 6. Archive Account

Implement soft deletion through an archive mechanism.

If the `profiles` table does not yet contain an archive field, add:

```sql
ALTER TABLE public.profiles
ADD COLUMN archived boolean NOT NULL DEFAULT false;
```

### Archived Account Behavior

* Archived accounts must not appear in the default active account list.
* Add an **Archived Accounts** tab or dedicated archive view.
* Archived accounts can be viewed.
* Archived accounts can be restored.
* Archived accounts can be permanently deleted.

### Restore

Provide a **Restore** action for archived accounts.

Restoring an account should set:

```text
archived = false
```

The restored account should return to the normal account list.

---

## 7. Activate / Deactivate Account

Use the existing `status` field.

Allowed values:

* Active
* Inactive

### Deactivate

Update:

```text
status = 'Inactive'
```

### Activate

Update:

```text
status = 'Active'
```

Display clear status badges:

* Active → Green
* Inactive → Red
* Archived → Neutral or distinct archive styling

Prevent inactive accounts from logging in if the authentication flow supports account-status validation.

---

## 8. Bulk Actions

Allow administrators to select multiple accounts.

Provide bulk actions for:

* Activate
* Deactivate
* Archive
* Delete

Always show a confirmation dialog before destructive or multi-account actions.

The system should clearly display how many accounts will be affected.

---

## 9. Role Management

Support the following roles:

* Admin
* Division Focal Person
* Section Focal Person
* Staff

Display role badges using a consistent visual style.

### Permission Rules

Only authorized Admin users should be able to:

* Create accounts
* Permanently delete accounts
* Archive accounts
* Restore archived accounts
* Change user roles
* Activate or deactivate accounts

Non-admin users should have restricted access based on the system's existing role-based access control.

Do not rely only on frontend UI restrictions. Enforce authorization at the backend/database level as well.

---

## 10. Account Action Menu

Each account row should have an action menu containing the appropriate actions:

* View
* Edit
* Activate
* Deactivate
* Archive
* Restore
* Delete

Only show actions that are applicable to the account's current state.

For example:

* Active account → Deactivate, Archive, Delete
* Inactive account → Activate, Archive, Delete
* Archived account → Restore, Permanent Delete

Use clear icons and labels.

---

## 11. Account Statistics

Add summary cards above the account table.

Display:

* Total Users
* Active Users
* Inactive Users
* Archived Users
* Admins
* Staff

Statistics should update automatically whenever account data changes.

Archived accounts should be excluded from the default "Total Users" count if the system treats archived users as removed from active account management.

---

## 12. Search and Filtering

Implement real-time or responsive search.

Search should check:

* Employee ID
* First Name
* Last Name
* Full Name
* Username
* Email

Provide filters for:

* Role
* Status

The default view should exclude archived accounts.

---

## 13. User Interface and Experience

Use a professional administrative dashboard design.

### UI Requirements

* Clean spacing
* Responsive layout
* Rounded cards
* Consistent typography
* Status badges
* Role badges
* Hover states
* Loading indicators
* Skeleton loaders where appropriate
* Empty states
* Confirmation dialogs
* Toast notifications
* Accessible form controls
* Mobile-friendly layout

Maintain the existing system's design language and components where possible. Do not unnecessarily redesign unrelated pages.

---

## 14. Validation

Prevent the following:

* Duplicate Employee ID
* Duplicate Username
* Duplicate Email
* Blank required fields
* Invalid email format
* Password mismatch
* Weak passwords
* Invalid role values
* Invalid status values

Show user-friendly validation messages.

Handle database constraint errors gracefully instead of displaying raw database errors to end users.

---

## 15. Security Requirements

The account management implementation must follow secure password and authorization practices.

### Password Security

* Never display passwords in the UI.
* Never expose passwords through account listing or API responses.
* Never store plaintext passwords.
* Hash passwords using the authentication system's secure password hashing mechanism.
* Prefer the platform's built-in authentication service instead of manually managing passwords in a public profile table.

### Authorization

Validate permissions before allowing:

* Account creation
* Account editing
* Password changes
* Role changes
* Account activation/deactivation
* Account archiving
* Account restoration
* Permanent deletion

Enforce authorization at the backend/database level using appropriate Supabase Authentication and Row Level Security (RLS) policies where applicable.

---

## 16. Audit Logging

If an audit log system already exists, record account-related actions.

Log:

* User Created
* User Updated
* Password Changed
* User Archived
* User Restored
* User Deleted
* Status Changed
* Role Changed

Include:

* Performing administrator
* Affected user
* Action performed
* Timestamp

Do not log plaintext passwords or sensitive authentication credentials.

---

## 17. Archived Accounts

Create a dedicated **Archived Accounts** view.

Display:

* Employee ID
* Full Name
* Username
* Email
* Role
* Status
* Date Created
* Archive-related actions

Available actions:

* View
* Restore
* Permanent Delete

Require confirmation before permanent deletion.

---

## 18. Optional Enhancements

If compatible with the existing system, consider adding:

* Export accounts to CSV or Excel
* Import accounts from CSV or Excel
* Copy Employee ID
* Copy Email
* Reset Password action
* Last Updated timestamp
* Avatar generated from initials
* Profile picture support
* Account creation date
* Last login information

These features should not compromise account security or expose sensitive authentication data.

---

## 19. Database Considerations

Update the schema only when necessary.

Recommended addition:

```sql
ALTER TABLE public.profiles
ADD COLUMN archived boolean NOT NULL DEFAULT false;
```

Consider adding a `updated_at` field for tracking modifications:

```sql
ALTER TABLE public.profiles
ADD COLUMN updated_at timestamp with time zone DEFAULT now();
```

If the application uses Supabase Authentication, evaluate whether the current `password` column should be removed from `public.profiles` and authentication should instead be handled through Supabase Auth.

The `profiles` table should ideally contain profile and authorization-related information, while authentication credentials should be managed by the authentication provider.

---

## 20. Expected Result

The **Manage Accounts** page should function as a professional account administration module supporting:

* Full Create, Read, Update, Delete (CRUD)
* Account viewing
* Account editing
* Account activation and deactivation
* Soft deletion through archiving
* Archived account management
* Account restoration
* Permanent deletion
* Search
* Filtering
* Sorting
* Pagination
* Bulk actions
* Role-based access control
* Form validation
* Secure password handling
* Responsive UI
* Toast notifications
* Confirmation dialogs
* Proper error handling

---

## Implementation Instructions

Before making changes:

1. Inspect the existing Manage Accounts page.
2. Inspect the current authentication flow.
3. Inspect the existing Supabase client configuration.
4. Inspect current database queries and API functions.
5. Inspect existing role-based access control.
6. Inspect existing UI components and design patterns.
7. Reuse existing components and styling whenever possible.

Then implement the account management features without breaking existing authentication, navigation, or unrelated modules.

After implementation:

1. Verify that creating an account works.
2. Verify that viewing an account works.
3. Verify that editing an account works.
4. Verify that activating and deactivating an account works.
5. Verify that archiving an account works.
6. Verify that restoring an archived account works.
7. Verify that permanent deletion works.
8. Verify search, filtering, sorting, and pagination.
9. Verify bulk actions.
10. Verify role-based permissions.
11. Verify that passwords are never exposed in the UI.
12. Verify that unauthorized users cannot perform restricted account-management operations.
13. Check for and fix any errors introduced by the implementation.

Keep the implementation modular, maintainable, secure, and consistent with the existing system architecture and user interface.
