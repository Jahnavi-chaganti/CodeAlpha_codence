# Security Specification — Cadence Project Management

## 1. Data Invariants

1. **Email & PII Isolation**: A user's email address in `/users/{userId}` may only be read or written by that authenticated, email-verified user (`request.auth.uid == userId`).
2. **Master Gate Membership**: No user can read, list, create, update, or delete tasks or comments in `/projects/{projectId}/**` unless `/projects/{projectId}/members/{request.auth.uid}` exists.
3. **No Self-Assigned Owner/Admin Privilege Escalation**: A user cannot create a member document in `/projects/{projectId}/members/{uid}` with `role == 'owner'` unless they are atomically creating the project with `ownerId == request.auth.uid`, nor join with `role == 'admin' | 'member'` without referencing a valid, active `/projectInvites/{inviteCode}` matching that `projectId` and `role`.
4. **Immutable Ownership & Provenance**: `createdAt`, `createdBy`, `authorUid`, `ownerId`, `projectId`, and `taskId` cannot be mutated after document creation.
5. **Temporal Integrity**: All `createdAt`, `updatedAt`, and `joinedAt` timestamps must equal `request.time`.
6. **Strict Field Allowlisting & Size Bounds**: Every write validates exact required + allowed keys via `hasAll` / `hasOnly` (create) and `affectedKeys().hasOnly(...)` (update), plus strict string `.size()` and array `.size() <= 5` limits.

## 2. The "Dirty Dozen" Attack Payloads

1. **Identity Spoofing on Task Creation**: `createdBy: "victim-uid"` when `request.auth.uid == "attacker-uid"` -> `PERMISSION_DENIED`.
2. **Shadow Field Injection on Project**: Creating a project with `{ ...validProject, isAdmin: true }` -> `PERMISSION_DENIED`.
3. **Unverified Email Write**: Authenticated user with `email_verified: false` attempting to create a project or task -> `PERMISSION_DENIED`.
4. **Cross-Tenant Task Read/List**: Non-member reading or listing `/projects/proj-a/tasks` -> `PERMISSION_DENIED`.
5. **PII Leak Attempt**: User B calling `get` on `/users/user-a` -> `PERMISSION_DENIED`.
6. **Self-Promotion to Project Owner**: Member updating `/projects/proj-a/members/user-b` `{ role: "owner" }` -> `PERMISSION_DENIED`.
7. **Orphaned Comment Creation**: Creating `/projects/proj-a/tasks/nonexistent/comments/c1` -> `PERMISSION_DENIED` (`exists()` check fails).
8. **Timestamp Forgery**: Creating a task with client-supplied `createdAt: Timestamp(1999-01-01)` -> `PERMISSION_DENIED` (`request.time` mismatch).
9. **ID Poisoning**: Creating `/projects/<1500-char-id>` -> `PERMISSION_DENIED` (`isValidId` rejects > 128 chars).
10. **Tag Array Resource Exhaustion**: Creating a task with 25 tags or a numeric tag element `[123]` -> `PERMISSION_DENIED`.
11. **Comment Author Impersonation / Edit**: User B updating User A's comment `body` -> `PERMISSION_DENIED`.
12. **Invite Enumeration (`list`)**: Authenticated user calling `list` on `/projectInvites` to harvest invite codes -> `PERMISSION_DENIED`.
