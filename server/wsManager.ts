import { WebSocket, type WebSocketServer } from 'ws';

export const ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export const ALLOWED_BOARD_EVENT_TYPES = new Set([
  'task:created',
  'task:moved',
  'task:updated',
  'task:deleted',
  'comment:added',
  'comment:updated',
  'member:joined',
  'member:removed',
  'sprint:created',
  'sprint:updated',
  'sprint:completed',
  'milestone:updated',
]);

export interface DecodedAuthUser {
  uid: string;
  displayName: string;
  photoURL: string;
  emailVerified: boolean;
  token: string;
  exp: number;
}

export interface MembershipInfo {
  isMember: boolean;
  role: 'owner' | 'admin' | 'member' | null;
}

export interface TokenVerifier {
  verifyIdToken: (token: string) => Promise<DecodedAuthUser>;
}

export interface MembershipVerifier {
  verifyProjectMember: (
    projectId: string,
    uid: string,
    token: string
  ) => Promise<MembershipInfo>;
}

export interface ValidatedWsMessage {
  type:
    | 'auth'
    | 'auth:refresh'
    | 'room:join'
    | 'room:leave'
    | 'task:dragging'
    | 'task:drag_end'
    | 'board:event';
  token?: string;
  projectId?: string;
  taskId?: string;
  taskKey?: string;
  eventType?: string;
  eventId?: string;
  summary?: string;
  recipientUids?: string[];
}

export interface AuthenticatedSession {
  ws: WebSocket;
  uid: string;
  displayName: string;
  photoURL: string;
  emailVerified: boolean;
  token: string;
  tokenExp: number;
  color: string;
  projectId: string | null;
  role: 'owner' | 'admin' | 'member' | null;
  isAlive: boolean;
  rateTimestamps: number[];
  dragTimestamps: number[];
}

const PRESENCE_COLORS = [
  '#315ECA',
  '#0D9488',
  '#D97706',
  '#7C3AED',
  '#DB2777',
  '#059669',
  '#DC2626',
  '#4F46E5',
];

export function colorForUid(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i += 1) {
    hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  }
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length];
}

export function validateWsIncomingMessage(
  raw: string
): { ok: true; data: ValidatedWsMessage } | { ok: false; code: string; error: string } {
  if (raw.length > 16384) {
    return { ok: false, code: 'PAYLOAD_TOO_LARGE', error: 'Message exceeds 16KB limit' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, code: 'INVALID_JSON', error: 'Malformed JSON payload' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, code: 'INVALID_SCHEMA', error: 'Payload must be a JSON object' };
  }

  const obj = parsed as Record<string, unknown>;
  const type = obj.type;
  if (typeof type !== 'string') {
    return { ok: false, code: 'MISSING_TYPE', error: 'Message type is required' };
  }

  switch (type) {
    case 'auth':
    case 'auth:refresh': {
      if (typeof obj.token !== 'string' || obj.token.length < 10 || obj.token.length > 8192) {
        return { ok: false, code: 'INVALID_TOKEN', error: 'Valid auth token is required' };
      }
      const projectId =
        typeof obj.projectId === 'string' && obj.projectId.trim()
          ? obj.projectId.trim()
          : undefined;
      if (projectId && !ID_REGEX.test(projectId)) {
        return { ok: false, code: 'INVALID_PROJECT_ID', error: 'Invalid project ID format' };
      }
      return { ok: true, data: { type, token: obj.token, projectId } };
    }

    case 'room:join': {
      if (typeof obj.projectId !== 'string' || !ID_REGEX.test(obj.projectId.trim())) {
        return { ok: false, code: 'INVALID_PROJECT_ID', error: 'Valid projectId is required' };
      }
      return { ok: true, data: { type, projectId: obj.projectId.trim() } };
    }

    case 'room:leave':
      return { ok: true, data: { type } };

    case 'task:dragging': {
      if (typeof obj.projectId !== 'string' || !ID_REGEX.test(obj.projectId)) {
        return { ok: false, code: 'INVALID_PROJECT_ID', error: 'Valid projectId is required' };
      }
      if (typeof obj.taskId !== 'string' || !ID_REGEX.test(obj.taskId)) {
        return { ok: false, code: 'INVALID_TASK_ID', error: 'Valid taskId is required' };
      }
      const taskKey = typeof obj.taskKey === 'string' ? obj.taskKey.slice(0, 16) : '';
      return {
        ok: true,
        data: { type, projectId: obj.projectId, taskId: obj.taskId, taskKey },
      };
    }

    case 'task:drag_end': {
      if (typeof obj.projectId !== 'string' || !ID_REGEX.test(obj.projectId)) {
        return { ok: false, code: 'INVALID_PROJECT_ID', error: 'Valid projectId is required' };
      }
      const taskId = typeof obj.taskId === 'string' && ID_REGEX.test(obj.taskId) ? obj.taskId : '';
      return { ok: true, data: { type, projectId: obj.projectId, taskId } };
    }

    case 'board:event': {
      if (typeof obj.projectId !== 'string' || !ID_REGEX.test(obj.projectId)) {
        return { ok: false, code: 'INVALID_PROJECT_ID', error: 'Valid projectId is required' };
      }
      if (typeof obj.eventType !== 'string' || !ALLOWED_BOARD_EVENT_TYPES.has(obj.eventType)) {
        return { ok: false, code: 'INVALID_EVENT_TYPE', error: 'Unsupported board event type' };
      }
      const taskId =
        typeof obj.taskId === 'string' && obj.taskId
          ? ID_REGEX.test(obj.taskId)
            ? obj.taskId
            : ''
          : '';
      if (typeof obj.taskId === 'string' && obj.taskId.length > 0 && !taskId) {
        return { ok: false, code: 'INVALID_TASK_ID', error: 'Invalid taskId format' };
      }
      const taskKey = typeof obj.taskKey === 'string' ? obj.taskKey.slice(0, 16) : '';
      const summary =
        typeof obj.summary === 'string' ? obj.summary.trim().slice(0, 240) : '';
      const eventId =
        typeof obj.eventId === 'string' && obj.eventId.length <= 64 ? obj.eventId : undefined;

      const recipientUids = Array.isArray(obj.recipientUids)
        ? obj.recipientUids
            .filter((r): r is string => typeof r === 'string' && ID_REGEX.test(r))
            .slice(0, 25)
        : [];

      return {
        ok: true,
        data: {
          type,
          projectId: obj.projectId,
          eventType: obj.eventType,
          taskId,
          taskKey,
          summary,
          eventId,
          recipientUids,
        },
      };
    }

    default:
      return { ok: false, code: 'UNKNOWN_TYPE', error: `Unsupported message type: ${type}` };
  }
}

export class WsRoomManager {
  private sessions = new Map<WebSocket, AuthenticatedSession>();
  private rooms = new Map<string, Set<WebSocket>>();
  private membershipCache = new Map<string, { info: MembershipInfo; checkedAt: number }>();
  private recentEventIds = new Map<string, number>();
  private readonly cacheTtlMs = 30_000;

  constructor(
    private readonly tokenVerifier: TokenVerifier,
    private readonly membershipVerifier: MembershipVerifier
  ) {}

  get activeCount(): number {
    return this.sessions.size;
  }

  private sendJson(ws: WebSocket, payload: unknown) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  private checkRateLimit(timestamps: number[], maxEvents: number, windowMs: number): boolean {
    const now = Date.now();
    while (timestamps.length > 0 && now - timestamps[0] > windowMs) {
      timestamps.shift();
    }
    if (timestamps.length >= maxEvents) {
      return false;
    }
    timestamps.push(now);
    return true;
  }

  private isDuplicateEvent(eventId?: string): boolean {
    if (!eventId) return false;
    const now = Date.now();
    for (const [id, ts] of this.recentEventIds.entries()) {
      if (now - ts > 60_000) this.recentEventIds.delete(id);
    }
    if (this.recentEventIds.has(eventId)) return true;
    this.recentEventIds.set(eventId, now);
    return false;
  }

  private async checkMembership(
    projectId: string,
    uid: string,
    token: string,
    forceRefresh = false
  ): Promise<MembershipInfo> {
    const cacheKey = `${projectId}:${uid}`;
    const cached = this.membershipCache.get(cacheKey);
    if (!forceRefresh && cached && Date.now() - cached.checkedAt < this.cacheTtlMs) {
      return cached.info;
    }
    const info = await this.membershipVerifier.verifyProjectMember(projectId, uid, token);
    this.membershipCache.set(cacheKey, { info, checkedAt: Date.now() });
    return info;
  }

  public broadcastPresence(projectId: string) {
    const roomSockets = this.rooms.get(projectId);
    if (!roomSockets) return;

    const uniqueMembers = new Map<
      string,
      { uid: string; displayName: string; photoURL: string; color: string; role: string | null }
    >();

    for (const sock of roomSockets) {
      const session = this.sessions.get(sock);
      if (session && sock.readyState === WebSocket.OPEN) {
        uniqueMembers.set(session.uid, {
          uid: session.uid,
          displayName: session.displayName,
          photoURL: session.photoURL,
          color: session.color,
          role: session.role,
        });
      }
    }

    const payload = {
      type: 'presence:sync',
      projectId,
      members: Array.from(uniqueMembers.values()),
    };

    for (const sock of roomSockets) {
      this.sendJson(sock, payload);
    }
  }

  public leaveCurrentRoom(ws: WebSocket) {
    const session = this.sessions.get(ws);
    if (!session || !session.projectId) return;

    const prevProjectId = session.projectId;
    session.projectId = null;
    session.role = null;

    const roomSockets = this.rooms.get(prevProjectId);
    if (roomSockets) {
      roomSockets.delete(ws);
      if (roomSockets.size === 0) {
        this.rooms.delete(prevProjectId);
      } else {
        this.broadcastPresence(prevProjectId);
      }
    }
  }

  private async joinAuthorizedRoom(
    ws: WebSocket,
    session: AuthenticatedSession,
    projectId: string
  ): Promise<boolean> {
    const membership = await this.checkMembership(projectId, session.uid, session.token, true);
    if (!membership.isMember) {
      this.sendJson(ws, {
        type: 'error',
        code: 'FORBIDDEN_ROOM',
        error: 'You are not an authorized member of this project.',
      });
      return false;
    }

    if (session.projectId === projectId) {
      session.role = membership.role;
      return true;
    }

    this.leaveCurrentRoom(ws);
    session.projectId = projectId;
    session.role = membership.role;

    let roomSockets = this.rooms.get(projectId);
    if (!roomSockets) {
      roomSockets = new Set<WebSocket>();
      this.rooms.set(projectId, roomSockets);
    }
    roomSockets.add(ws);
    this.broadcastPresence(projectId);
    return true;
  }

  public removeSocket(ws: WebSocket) {
    this.leaveCurrentRoom(ws);
    this.sessions.delete(ws);
  }

  public markAlive(ws: WebSocket) {
    const session = this.sessions.get(ws);
    if (session) session.isAlive = true;
  }

  public pruneDeadSockets(wss: WebSocketServer) {
    for (const ws of wss.clients) {
      const session = this.sessions.get(ws);
      if (session) {
        if (!session.isAlive) {
          this.removeSocket(ws);
          ws.terminate();
          continue;
        }
        session.isAlive = false;
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }
  }

  public async handleMessage(ws: WebSocket, raw: string): Promise<void> {
    const validation = validateWsIncomingMessage(raw);
    if (!validation.ok) {
      this.sendJson(ws, { type: 'error', code: validation.code, error: validation.error });
      return;
    }

    const msg = validation.data;

    if (msg.type === 'auth' || msg.type === 'auth:refresh') {
      try {
        const decoded = await this.tokenVerifier.verifyIdToken(msg.token!);
        if (msg.type === 'auth:refresh') {
          const existing = this.sessions.get(ws);
          if (existing && existing.uid === decoded.uid) {
            existing.token = decoded.token;
            existing.tokenExp = decoded.exp;
            existing.displayName = decoded.displayName;
            existing.photoURL = decoded.photoURL;
            existing.emailVerified = decoded.emailVerified;
            this.sendJson(ws, { type: 'auth:ok', uid: decoded.uid });
            return;
          }
        }

        const session: AuthenticatedSession = {
          ws,
          uid: decoded.uid,
          displayName: decoded.displayName,
          photoURL: decoded.photoURL,
          emailVerified: decoded.emailVerified,
          token: decoded.token,
          tokenExp: decoded.exp,
          color: colorForUid(decoded.uid),
          projectId: null,
          role: null,
          isAlive: true,
          rateTimestamps: [],
          dragTimestamps: [],
        };
        this.sessions.set(ws, session);
        this.sendJson(ws, { type: 'auth:ok', uid: decoded.uid });

        if (msg.projectId) {
          await this.joinAuthorizedRoom(ws, session, msg.projectId);
        }
      } catch {
        this.sendJson(ws, {
          type: 'auth:error',
          code: 'UNAUTHORIZED',
          error: 'Authentication failed or token expired.',
        });
        ws.close(4001, 'Unauthorized');
      }
      return;
    }

    const session = this.sessions.get(ws);
    if (!session) {
      this.sendJson(ws, {
        type: 'error',
        code: 'UNAUTHENTICATED',
        error: 'Authenticate before sending events.',
      });
      ws.close(4001, 'Unauthenticated');
      return;
    }

    // Check token expiration
    if (session.tokenExp > 0 && Date.now() / 1000 > session.tokenExp) {
      this.sendJson(ws, {
        type: 'auth:error',
        code: 'TOKEN_EXPIRED',
        error: 'Session token expired. Please re-authenticate.',
      });
      this.removeSocket(ws);
      ws.close(4001, 'Token expired');
      return;
    }

    if (!this.checkRateLimit(session.rateTimestamps, 45, 10_000)) {
      this.sendJson(ws, {
        type: 'error',
        code: 'RATE_LIMITED',
        error: 'Too many WebSocket events. Slow down briefly.',
      });
      return;
    }

    if (msg.type === 'room:join' && msg.projectId) {
      await this.joinAuthorizedRoom(ws, session, msg.projectId);
      return;
    }

    if (msg.type === 'room:leave') {
      this.leaveCurrentRoom(ws);
      return;
    }

    // All task/board actions require active verified membership in the target project
    const targetProjectId = msg.projectId;
    if (!targetProjectId || session.projectId !== targetProjectId) {
      this.sendJson(ws, {
        type: 'error',
        code: 'ROOM_MISMATCH',
        error: 'Must join authorized project room before sending project events.',
      });
      return;
    }

    const membership = await this.checkMembership(targetProjectId, session.uid, session.token);
    if (!membership.isMember) {
      this.leaveCurrentRoom(ws);
      this.sendJson(ws, {
        type: 'error',
        code: 'FORBIDDEN_ROOM',
        error: 'Project membership revoked or unauthorized.',
      });
      return;
    }

    if (msg.type === 'task:dragging') {
      if (!this.checkRateLimit(session.dragTimestamps, 12, 1_000)) {
        return;
      }
      const roomSockets = this.rooms.get(targetProjectId);
      if (!roomSockets) return;
      const payload = {
        type: 'task:dragging',
        projectId: targetProjectId,
        taskId: msg.taskId,
        taskKey: msg.taskKey ?? '',
        actorUid: session.uid,
        actorName: session.displayName,
        color: session.color,
      };
      for (const sock of roomSockets) {
        if (sock !== ws) this.sendJson(sock, payload);
      }
      return;
    }

    if (msg.type === 'task:drag_end') {
      const roomSockets = this.rooms.get(targetProjectId);
      if (!roomSockets) return;
      const payload = {
        type: 'task:drag_end',
        projectId: targetProjectId,
        taskId: msg.taskId ?? '',
        actorUid: session.uid,
      };
      for (const sock of roomSockets) {
        if (sock !== ws) this.sendJson(sock, payload);
      }
      return;
    }

    if (msg.type === 'board:event') {
      if (!session.emailVerified) {
        this.sendJson(ws, {
          type: 'error',
          code: 'EMAIL_UNVERIFIED',
          error: 'Verify your email address before broadcasting project updates.',
        });
        return;
      }

      if (this.isDuplicateEvent(msg.eventId)) {
        return;
      }

      const eventPayload = {
        type: 'board:event',
        id: msg.eventId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        projectId: targetProjectId,
        eventType: msg.eventType!,
        actorUid: session.uid,
        actorName: session.displayName,
        actorPhoto: session.photoURL,
        taskId: msg.taskId ?? '',
        taskKey: msg.taskKey ?? '',
        summary: msg.summary ?? '',
        timestamp: Date.now(),
      };

      const roomSockets = this.rooms.get(targetProjectId);
      if (roomSockets) {
        for (const sock of roomSockets) {
          if (sock !== ws) this.sendJson(sock, eventPayload);
        }
      }

      // Push notifications ONLY to target users who are verified members of this same project
      if (msg.recipientUids && msg.recipientUids.length > 0) {
        const recipientSet = new Set(msg.recipientUids);
        for (const [sock, targetSession] of this.sessions.entries()) {
          if (
            targetSession.uid !== session.uid &&
            recipientSet.has(targetSession.uid)
          ) {
            const targetMembership = await this.checkMembership(
              targetProjectId,
              targetSession.uid,
              targetSession.token
            );
            if (targetMembership.isMember) {
              this.sendJson(sock, {
                ...eventPayload,
                type: 'notification:push',
              });
            }
          }
        }
      }
    }
  }
}
