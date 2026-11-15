# Cadence

> **Plan Smarter. Collaborate Better. Deliver Faster.**

Cadence is a collaborative, multi-user project management SaaS workspace built with **React 19**, **TypeScript**, **Tailwind CSS v4**, **Firebase Auth & Cloud Firestore**, **Firebase Storage**, and a room-isolated **Express + WebSocket (`ws`)** real-time server.

## Key Capabilities

- **Authentication & Verification**: Google Sign-In (`signInWithPopup`) plus Email/Password registration, sign-in, password reset, and email-verification gating aligned with `firestore.rules`.
- **Multi-View Workspace**:
  - **Kanban Board**: Drag-and-drop across columns (`Backlog`, `To Do`, `In Progress`, `Done`) powered by `@dnd-kit/core` + `@dnd-kit/sortable` with touch support, live remote drag indicators, optimistic rollback, and dependency-blocker checks.
  - **Task List**: Sortable columns, toggleable columns menu, 25-row pagination, and bulk status/priority/assignee/delete operations.
  - **Calendar**: Month, Week, and Day schedules with drag-and-drop due-date rescheduling and unscheduled backlog panel.
  - **Timeline / Gantt**: 14-day and 28-day duration bars, milestone flags, blocker badges, and inline start/due date adjustments.
  - **My Tasks & Overdue**: Personal focus views (`All`, `Overdue`, `Due Today`, `Upcoming`, `High Priority`, `Completed`) with live sidebar badges.
  - **Sprints & Milestones**: Sprint planning, active sprint burndown chart, retrospective notes, and milestone tracking.
  - **Analytics Dashboard**: Completion rate, velocity, overdue rate, workload distribution by member, and delivery imbalance insights.
  - **Team, Invites & Templates**: Owner/Admin/Member RBAC, expiring 12-character cryptographic invite codes (single-use or multi-use, optional email restriction), revocation, project settings, and custom project templates.
  - **Export & Reports**: CSV task/member exports, Markdown progress/workload/sprint/completion reports, and print-friendly stylesheet support.
- **Task Collaboration**: Subtask checklists, dependency graphs with circular-cycle detection and admin override workflow, recurring task schedules, persistent time tracking (live timer + manual entries), Firebase Storage file attachments, `@mention` comments with editing, and immutable task audit history.
- **Real-Time WebSocket Engine (`/ws`)**: Firebase ID token verification (`auth` & `auth:refresh`), Firestore membership checks, server-derived actor identity, rate limiting, `eventId` deduplication, and room-isolated broadcasts & push notifications.

## Architecture Overview

- `src/App.tsx`: Workspace orchestrator, auth/email verification gate, Firestore listeners, lazy-loaded secondary views, dependency override workflow, recurring task spawning, and daily deadline reminder sync.
- `src/lib/`: Modular client services (`firebase.ts`, `firestoreService.ts`, `sprintService.ts`, `timeTrackingService.ts`, `attachmentService.ts`, `notificationService.ts`, `searchService.ts`, `analyticsService.ts`, `exportService.ts`, `templateService.ts`, `validationService.ts`, `firestoreErrors.ts`).
- `server.ts` & `server/wsManager.ts`: Express server (port `3000`) serving Vite in development or `dist/` in production, `/api/health`, CORS enforcement, and authenticated `/ws` room management.
- `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `firebase-blueprint.json`: Strict member-gated security rules, composite query indexes, and storage limits (10 MB max per attachment).

## Setup & Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment variables** (see `.env.example`):
   - `PORT=3000`
   - `ALLOWED_ORIGINS=` (optional comma-separated allowlist for CORS / WebSocket origin checks)
   - `EMAIL_PROVIDER_API_KEY=` / `EMAIL_FROM_ADDRESS=` (optional for external email dispatch)

3. **Firebase Console configuration**:
   - Ensure **Google** and **Email/Password** providers are enabled under **Authentication → Sign-in method**.
   - Deploy `firestore.rules` and `firestore.indexes.json` to your Firebase project (`instant-clarity-dv0ns`).
   - Deploy `storage.rules` to Firebase Storage (`instant-clarity-dv0ns.firebasestorage.app`) for task attachments.

4. **Run the development server**:
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` — Start Express + Vite + WebSocket server on port `3000`.
- `npm run build` — Build production client bundle to `dist/`.
- `npm run start` — Start production Node server (`node server.ts`).
- `npm run lint` — TypeScript typecheck (`tsc --noEmit`).
- `npm test` — Run Vitest unit, WebSocket security, analytics, export, and React UI component tests.
- `npm run test:rules` — Run `firestore.rules.test.ts` (requires Java JDK + `FIRESTORE_EMULATOR_HOST`).
- `npx eslint firestore.rules` — Lint Firestore security rules with `@firebase/eslint-plugin-security-rules`.
