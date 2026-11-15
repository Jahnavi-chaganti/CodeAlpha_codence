import { describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import {
  WsRoomManager,
  validateWsIncomingMessage,
  type MembershipVerifier,
  type TokenVerifier,
} from '../server/wsManager';

class MockWebSocket {
  public readyState: number = WebSocket.OPEN;
  public sent: Array<Record<string, unknown>> = [];
  public closedWith: { code?: number; reason?: string } | null = null;
  public terminated = false;

  send(data: string) {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close(code?: number, reason?: string) {
    this.closedWith = { code, reason };
    this.readyState = WebSocket.CLOSED;
  }

  terminate() {
    this.terminated = true;
    this.readyState = WebSocket.CLOSED;
  }

  ping() {
    // no-op for unit test
  }
}

function createVerifierHarness(options?: {
  memberships?: Record<string, { isMember: boolean; role: 'owner' | 'admin' | 'member' | null }>;
  unverifiedUsers?: Set<string>;
}) {
  const tokens: Record<
    string,
    { uid: string; displayName: string; photoURL: string; emailVerified: boolean; exp: number }
  > = {
    'valid-token-alice-12345': {
      uid: 'alice',
      displayName: 'Alice Chen',
      photoURL: '',
      emailVerified: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    'valid-token-bob-67890': {
      uid: 'bob',
      displayName: 'Bob Smith',
      photoURL: '',
      emailVerified: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    'valid-token-eve-99999': {
      uid: 'eve',
      displayName: 'Eve Outsider',
      photoURL: '',
      emailVerified: !options?.unverifiedUsers?.has('eve'),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
  };

  const tokenVerifier: TokenVerifier = {
    verifyIdToken: async (token: string) => {
      const user = tokens[token];
      if (!user) throw new Error('Invalid token');
      return { ...user, token };
    },
  };

  const membershipMap = options?.memberships ?? {
    'proj_1:alice': { isMember: true, role: 'owner' },
    'proj_1:bob': { isMember: true, role: 'member' },
    'proj_2:eve': { isMember: true, role: 'owner' },
  };

  const membershipVerifier: MembershipVerifier = {
    verifyProjectMember: async (projectId, uid) => {
      return membershipMap[`${projectId}:${uid}`] ?? { isMember: false, role: null };
    },
  };

  return { tokenVerifier, membershipVerifier };
}

describe('validateWsIncomingMessage', () => {
  it('rejects oversized, malformed, and unknown message payloads', () => {
    expect(validateWsIncomingMessage('x'.repeat(17000)).ok).toBe(false);
    expect(validateWsIncomingMessage('{bad json').ok).toBe(false);
    expect(validateWsIncomingMessage('[]').ok).toBe(false);
    expect(validateWsIncomingMessage(JSON.stringify({ type: 'unknown:type' })).ok).toBe(false);
  });

  it('validates auth, room:join, and board:event schemas', () => {
    const authRes = validateWsIncomingMessage(
      JSON.stringify({ type: 'auth', token: 'token-with-sufficient-length', projectId: 'proj_1' })
    );
    expect(authRes.ok).toBe(true);

    const badRoom = validateWsIncomingMessage(
      JSON.stringify({ type: 'room:join', projectId: '../etc/passwd' })
    );
    expect(badRoom.ok).toBe(false);

    const badEvent = validateWsIncomingMessage(
      JSON.stringify({
        type: 'board:event',
        projectId: 'proj_1',
        eventType: 'malicious:drop_db',
      })
    );
    expect(badEvent.ok).toBe(false);
  });
});

describe('WsRoomManager security & real-time isolation', () => {
  it('rejects unauthenticated messages before auth handshake', async () => {
    const { tokenVerifier, membershipVerifier } = createVerifierHarness();
    const manager = new WsRoomManager(tokenVerifier, membershipVerifier);
    const ws = new MockWebSocket();

    await manager.handleMessage(
      ws as unknown as WebSocket,
      JSON.stringify({ type: 'room:join', projectId: 'proj_1' })
    );

    expect(ws.sent[0]?.code).toBe('UNAUTHENTICATED');
    expect(ws.closedWith?.code).toBe(4001);
  });

  it('blocks non-members from joining unauthorized project rooms', async () => {
    const { tokenVerifier, membershipVerifier } = createVerifierHarness();
    const manager = new WsRoomManager(tokenVerifier, membershipVerifier);
    const eveWs = new MockWebSocket();

    await manager.handleMessage(
      eveWs as unknown as WebSocket,
      JSON.stringify({ type: 'auth', token: 'valid-token-eve-99999', projectId: 'proj_1' })
    );

    expect(eveWs.sent.some((m) => m.type === 'auth:ok')).toBe(true);
    expect(eveWs.sent.some((m) => m.code === 'FORBIDDEN_ROOM')).toBe(true);
  });

  it('isolates room broadcasts, enforces server-derived actor identity, and deduplicates events', async () => {
    const { tokenVerifier, membershipVerifier } = createVerifierHarness();
    const manager = new WsRoomManager(tokenVerifier, membershipVerifier);
    const aliceWs = new MockWebSocket();
    const bobWs = new MockWebSocket();
    const eveWs = new MockWebSocket();

    await manager.handleMessage(
      aliceWs as unknown as WebSocket,
      JSON.stringify({ type: 'auth', token: 'valid-token-alice-12345', projectId: 'proj_1' })
    );
    await manager.handleMessage(
      bobWs as unknown as WebSocket,
      JSON.stringify({ type: 'auth', token: 'valid-token-bob-67890', projectId: 'proj_1' })
    );
    await manager.handleMessage(
      eveWs as unknown as WebSocket,
      JSON.stringify({ type: 'auth', token: 'valid-token-eve-99999', projectId: 'proj_2' })
    );

    aliceWs.sent = [];
    bobWs.sent = [];
    eveWs.sent = [];

    // Alice sends a board event with spoofed actor fields and cross-room recipient Eve
    await manager.handleMessage(
      aliceWs as unknown as WebSocket,
      JSON.stringify({
        type: 'board:event',
        projectId: 'proj_1',
        eventType: 'task:moved',
        eventId: 'evt-unique-1',
        taskId: 'task_1',
        taskKey: 'ENG-1',
        actorUid: 'victim_spoof',
        actorName: 'Spoofed Name',
        summary: 'Moved ENG-1 to Done',
        recipientUids: ['bob', 'eve'],
      })
    );

    // Duplicate eventId should be ignored
    await manager.handleMessage(
      aliceWs as unknown as WebSocket,
      JSON.stringify({
        type: 'board:event',
        projectId: 'proj_1',
        eventType: 'task:moved',
        eventId: 'evt-unique-1',
        taskId: 'task_1',
        taskKey: 'ENG-1',
        summary: 'Moved ENG-1 to Done',
      })
    );

    const bobBoardEvents = bobWs.sent.filter((m) => m.type === 'board:event');
    const bobPushNotifs = bobWs.sent.filter((m) => m.type === 'notification:push');
    expect(bobBoardEvents).toHaveLength(1);
    expect(bobBoardEvents[0].actorUid).toBe('alice');
    expect(bobBoardEvents[0].actorName).toBe('Alice Chen');
    expect(bobPushNotifs).toHaveLength(1);

    // Eve is in proj_2, not proj_1, so she must receive neither broadcast nor push notification
    expect(eveWs.sent).toHaveLength(0);
  });

  it('blocks unverified users from broadcasting board events and enforces rate limits', async () => {
    const { tokenVerifier, membershipVerifier } = createVerifierHarness({
      memberships: {
        'proj_1:alice': { isMember: true, role: 'owner' },
        'proj_1:eve': { isMember: true, role: 'member' },
      },
      unverifiedUsers: new Set(['eve']),
    });
    const manager = new WsRoomManager(tokenVerifier, membershipVerifier);
    const eveWs = new MockWebSocket();

    await manager.handleMessage(
      eveWs as unknown as WebSocket,
      JSON.stringify({ type: 'auth', token: 'valid-token-eve-99999', projectId: 'proj_1' })
    );
    eveWs.sent = [];

    await manager.handleMessage(
      eveWs as unknown as WebSocket,
      JSON.stringify({
        type: 'board:event',
        projectId: 'proj_1',
        eventType: 'task:created',
        summary: 'Unverified write',
      })
    );
    expect(eveWs.sent[0]?.code).toBe('EMAIL_UNVERIFIED');

    // Rate limit check (>45 messages in 10s window)
    const aliceWs = new MockWebSocket();
    await manager.handleMessage(
      aliceWs as unknown as WebSocket,
      JSON.stringify({ type: 'auth', token: 'valid-token-alice-12345', projectId: 'proj_1' })
    );
    aliceWs.sent = [];
    for (let i = 0; i < 47; i += 1) {
      await manager.handleMessage(
        aliceWs as unknown as WebSocket,
        JSON.stringify({ type: 'room:join', projectId: 'proj_1' })
      );
    }
    expect(aliceWs.sent.some((m) => m.code === 'RATE_LIMITED')).toBe(true);
  });
});
