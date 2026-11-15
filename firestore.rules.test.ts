/**
 * Security Rules Verification Suite (Cadence)
 * Includes the 12 adversarial "Dirty Dozen" specifications and runnable
 * `@firebase/rules-unit-testing` assertions (requires Java + Firebase Emulator).
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
  enforcedByRule: string;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Task Creation',
    operation: 'create',
    path: '/projects/proj_1/tasks/task_1',
    payload: { createdBy: 'victim_uid', title: 'Spoofed Task' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidTaskCard(incoming()) checks data.createdBy == request.auth.uid',
  },
  {
    id: 2,
    name: 'Shadow Field Injection on Project',
    operation: 'create',
    path: '/projects/proj_1',
    payload: { id: 'proj_1', name: 'Hack', isAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'data.keys().hasOnly([...]) rejects unknown fields',
  },
  {
    id: 3,
    name: 'Unverified Email Write',
    operation: 'create',
    path: '/projects/proj_1',
    payload: { id: 'proj_1', name: 'Unverified' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isVerifiedUser() requires request.auth.token.email_verified == true',
  },
  {
    id: 4,
    name: 'Cross-Tenant Task List',
    operation: 'list',
    path: '/projects/proj_1/tasks',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isProjectMember(projectId) gate on tasks',
  },
  {
    id: 5,
    name: 'PII Leak on Users Collection',
    operation: 'get',
    path: '/users/victim_uid',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isOwner(userId) strict check on /users/{userId}',
  },
  {
    id: 6,
    name: 'Self-Promotion to Project Owner',
    operation: 'update',
    path: '/projects/proj_1/members/attacker_uid',
    payload: { role: 'owner' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'Only project owner can update member roles to admin/member; owner role immutable',
  },
  {
    id: 7,
    name: 'Orphaned Comment Creation',
    operation: 'create',
    path: '/projects/proj_1/tasks/missing_task/comments/c_1',
    payload: { taskId: 'missing_task', body: 'Orphan' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'exists(/databases/$(database)/documents/projects/$(projectId)/tasks/$(taskId))',
  },
  {
    id: 8,
    name: 'Timestamp Forgery',
    operation: 'create',
    path: '/projects/proj_1/tasks/task_2',
    payload: { createdAt: '1999-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'incoming().createdAt == request.time',
  },
  {
    id: 9,
    name: 'ID Poisoning (>128 chars)',
    operation: 'create',
    path: `/projects/${'a'.repeat(200)}`,
    payload: { name: 'Poison' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidId(projectId) enforces size() <= 128 and regex',
  },
  {
    id: 10,
    name: 'Tag Array Resource Exhaustion',
    operation: 'create',
    path: '/projects/proj_1/tasks/task_3',
    payload: { tags: Array.from({ length: 25 }, (_, i) => `tag_${i}`) },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'data.tags is list && data.tags.size() <= 5',
  },
  {
    id: 11,
    name: 'Comment Author Impersonation on Update',
    operation: 'update',
    path: '/projects/proj_1/tasks/task_1/comments/c_1',
    payload: { body: 'Edited by attacker' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'existing().authorUid == request.auth.uid required for comment update',
  },
  {
    id: 12,
    name: 'Invite Enumeration Attempt',
    operation: 'list',
    path: '/projectInvites',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'allow list: if false on /projectInvites/{inviteCode}',
  },
];

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;

describe.skipIf(!EMULATOR_HOST)('Firestore Security Rules (Emulator Suite)', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'cadence-rules-test',
      firestore: {
        rules: fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it('allows verified owner to create a valid project and rejects shadow fields & unverified users', async () => {
    const alice = testEnv.authenticatedContext('alice', { email_verified: true });
    const unverified = testEnv.authenticatedContext('bob', { email_verified: false });

    await assertSucceeds(
      setDoc(doc(alice.firestore(), 'projects', 'proj_1'), {
        id: 'proj_1',
        name: 'Core Platform',
        key: 'CORE',
        description: 'Main workspace',
        ownerId: 'alice',
        taskCounter: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    await assertFails(
      setDoc(doc(alice.firestore(), 'projects', 'proj_bad'), {
        id: 'proj_bad',
        name: 'Bad',
        key: 'BAD',
        description: '',
        ownerId: 'alice',
        taskCounter: 0,
        isAdmin: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    await assertFails(
      setDoc(doc(unverified.firestore(), 'projects', 'proj_2'), {
        id: 'proj_2',
        name: 'Unverified',
        key: 'UNV',
        description: '',
        ownerId: 'bob',
        taskCounter: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('prevents cross-user PII reads and self-promotion on member roles', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'alice'), {
        uid: 'alice',
        email: 'alice@example.com',
        displayName: 'Alice',
        photoURL: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(ctx.firestore(), 'projects', 'proj_1'), {
        id: 'proj_1',
        name: 'Core',
        key: 'CORE',
        description: '',
        ownerId: 'alice',
        taskCounter: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(ctx.firestore(), 'projects', 'proj_1', 'members', 'bob'), {
        uid: 'bob',
        displayName: 'Bob',
        photoURL: '',
        role: 'member',
        inviteCode: 'abc123456789',
        joinedAt: serverTimestamp(),
      });
    });

    const bob = testEnv.authenticatedContext('bob', { email_verified: true });
    await assertFails(getDoc(doc(bob.firestore(), 'users', 'alice')));
    await assertFails(
      updateDoc(doc(bob.firestore(), 'projects', 'proj_1', 'members', 'bob'), { role: 'owner' })
    );
  });
});
