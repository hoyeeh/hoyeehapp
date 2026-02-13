

# Remove 700 Imported Users and Fix Build Error

## Overview
Delete all 700 users that were imported via CSV/MySQL from the database, and fix a pre-existing TypeScript build error.

## Part 1: Fix Build Error

**File: `src/hooks/usePushNotifications.ts`**
- Add proper type assertion for `pushManager` on `ServiceWorkerRegistration` (this is a known TypeScript limitation with the Push API types)

## Part 2: Create Edge Function to Bulk Delete Imported Users

**New file: `supabase/functions/delete-imported-users/index.ts`**

This edge function will:
1. Verify the calling user is a super admin
2. Query the `audit_logs` table for all user IDs imported via the MySQL/CSV import (`details->>'action' = 'user_import'`)
3. For each imported user:
   - Delete from `user_roles`
   - Delete from `watchlist`, `watch_history`, `reviews`, `subscriptions`
   - Delete from `profiles`
   - Delete from `auth.users` using the admin API
4. Delete the corresponding audit log entries
5. Return a summary of how many users were deleted, skipped, or failed

**Security**: Only super admins can invoke this function.

**Batch processing**: Users will be deleted one at a time to avoid timeouts, with progress tracking. The function processes all 700 users in a single call.

## Part 3: Trigger the Deletion

After deploying the edge function, I will call it directly to execute the deletion. No UI changes are needed since this is a one-time cleanup operation.

## Files to Create/Modify
| File | Action |
|------|--------|
| `supabase/functions/delete-imported-users/index.ts` | Create - bulk delete edge function |
| `src/hooks/usePushNotifications.ts` | Fix - TypeScript build error |

