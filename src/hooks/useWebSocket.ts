import { useCallback, useEffect, useRef, useState } from 'react';
import { onIdTokenChanged, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import type { BoardActivityEvent, PresenceMember, RemoteDragState } from '../types/pm';

interface UseWebSocketOptions {
  user: User | null;
  projectId: string | null;
  onRemotePushNotification?: (event: BoardActivityEvent) => void;
}

export function useWebSocket({
  user,
  projectId,
  onRemotePushNotification,
}: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const [presenceMembers, setPresenceMembers] = useState<PresenceMember[]>([]);
  const [remoteDrags, setRemoteDrags] = useState<Record<string, RemoteDragState>>({});
  const [liveFeed, setLiveFeed] = useState<BoardActivityEvent[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const authedRef = useRef(false);
  const projectIdRef = useRef<string | null>(projectId);
  const pushCallbackRef = useRef(onRemotePushNotification);

  projectIdRef.current = projectId;
  pushCallbackRef.current = onRemotePushNotification;

  const sendRaw = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  // Refresh WS token whenever Firebase Auth rotates the ID token
  useEffect(() => {
    if (!user) return;
    const unsub = onIdTokenChanged(auth, async (nextUser) => {
      if (!nextUser || !authedRef.current) return;
      try {
        const freshToken = await nextUser.getIdToken();
        sendRaw({
          type: 'auth:refresh',
          token: freshToken,
          projectId: projectIdRef.current ?? '',
        });
      } catch {
        // Reconnect handler will recover
      }
    });
    return () => unsub();
  }, [user, sendRaw]);

  useEffect(() => {
    if (!user) {
      setConnected(false);
      setWsError(null);
      setPresenceMembers([]);
      setRemoteDrags({});
      return;
    }

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    async function connect(forceRefreshToken = false) {
      if (cancelled || !user) return;
      let token = '';
      try {
        token = await user.getIdToken(forceRefreshToken);
      } catch {
        return;
      }
      if (cancelled) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;
      authedRef.current = false;

      ws.onopen = () => {
        attempt = 0;
        setWsError(null);
        ws.send(
          JSON.stringify({
            type: 'auth',
            token,
            projectId: projectIdRef.current ?? '',
          })
        );
      };

      ws.onmessage = (event) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(event.data as string) as Record<string, unknown>;
        } catch {
          return;
        }

        const type = typeof msg.type === 'string' ? msg.type : '';

        if (type === 'auth:ok') {
          authedRef.current = true;
          setConnected(true);
          setWsError(null);
          if (projectIdRef.current) {
            ws.send(JSON.stringify({ type: 'room:join', projectId: projectIdRef.current }));
          }
          return;
        }

        if (type === 'auth:error' || type === 'error') {
          const code = typeof msg.code === 'string' ? msg.code : '';
          const errText = typeof msg.error === 'string' ? msg.error : 'WebSocket error';
          setWsError(errText);
          if (code === 'TOKEN_EXPIRED') {
            ws.close();
          }
          return;
        }

        if (type === 'presence:sync') {
          if (msg.projectId === projectIdRef.current && Array.isArray(msg.members)) {
            setPresenceMembers(msg.members as PresenceMember[]);
          }
          return;
        }

        if (type === 'task:dragging') {
          if (msg.projectId === projectIdRef.current && typeof msg.taskId === 'string') {
            const dragInfo: RemoteDragState = {
              taskId: msg.taskId,
              taskKey: String(msg.taskKey || ''),
              actorUid: String(msg.actorUid || ''),
              actorName: String(msg.actorName || 'Teammate'),
              color: String(msg.color || '#315ECA'),
            };
            setRemoteDrags((prev) => ({ ...prev, [dragInfo.taskId]: dragInfo }));
          }
          return;
        }

        if (type === 'task:drag_end') {
          const taskId = typeof msg.taskId === 'string' ? msg.taskId : '';
          const actorUid = typeof msg.actorUid === 'string' ? msg.actorUid : '';
          setRemoteDrags((prev) => {
            const next = { ...prev };
            if (taskId && next[taskId]) {
              delete next[taskId];
            } else if (actorUid) {
              for (const [k, v] of Object.entries(next)) {
                if (v.actorUid === actorUid) delete next[k];
              }
            }
            return next;
          });
          return;
        }

        if (type === 'board:event') {
          const act: BoardActivityEvent = {
            id: String(msg.id || Date.now()),
            projectId: String(msg.projectId || ''),
            eventType: String(msg.eventType || ''),
            actorUid: String(msg.actorUid || ''),
            actorName: String(msg.actorName || 'Teammate'),
            actorPhoto: typeof msg.actorPhoto === 'string' ? msg.actorPhoto : '',
            taskId: typeof msg.taskId === 'string' ? msg.taskId : '',
            taskKey: typeof msg.taskKey === 'string' ? msg.taskKey : '',
            summary: String(msg.summary || ''),
            timestamp: Number(msg.timestamp || Date.now()),
          };
          setLiveFeed((prev) => {
            if (prev.some((existing) => existing.id === act.id)) return prev;
            return [act, ...prev].slice(0, 50);
          });
          return;
        }

        if (type === 'notification:push') {
          const act: BoardActivityEvent = {
            id: String(msg.id || Date.now()),
            projectId: String(msg.projectId || ''),
            eventType: String(msg.eventType || ''),
            actorUid: String(msg.actorUid || ''),
            actorName: String(msg.actorName || 'Teammate'),
            actorPhoto: typeof msg.actorPhoto === 'string' ? msg.actorPhoto : '',
            taskId: typeof msg.taskId === 'string' ? msg.taskId : '',
            taskKey: typeof msg.taskKey === 'string' ? msg.taskKey : '',
            summary: String(msg.summary || ''),
            timestamp: Number(msg.timestamp || Date.now()),
          };
          pushCallbackRef.current?.(act);
        }
      };

      ws.onclose = () => {
        authedRef.current = false;
        setConnected(false);
        setRemoteDrags({});
        if (!cancelled) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 15000);
          attempt += 1;
          reconnectTimer = setTimeout(() => connect(attempt > 1), delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect(false);

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      authedRef.current = false;
      setConnected(false);
      setPresenceMembers([]);
      setRemoteDrags({});
    };
  }, [user]);

  useEffect(() => {
    setRemoteDrags({});
    setLiveFeed([]);
    if (!authedRef.current) return;
    if (projectId) {
      sendRaw({ type: 'room:join', projectId });
    } else {
      sendRaw({ type: 'room:leave' });
      setPresenceMembers([]);
    }
  }, [projectId, sendRaw]);

  const emitDragStart = useCallback(
    (taskId: string, taskKey: string) => {
      if (!projectIdRef.current) return;
      sendRaw({
        type: 'task:dragging',
        projectId: projectIdRef.current,
        taskId,
        taskKey,
      });
    },
    [sendRaw]
  );

  const emitDragEnd = useCallback(
    (taskId: string) => {
      if (!projectIdRef.current) return;
      sendRaw({
        type: 'task:drag_end',
        projectId: projectIdRef.current,
        taskId,
      });
    },
    [sendRaw]
  );

  const emitBoardEvent = useCallback(
    (params: {
      eventType: string;
      taskId?: string;
      taskKey?: string;
      summary: string;
      recipientUids?: string[];
    }) => {
      if (!projectIdRef.current) return;
      const eventId = `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      sendRaw({
        type: 'board:event',
        projectId: projectIdRef.current,
        eventId,
        eventType: params.eventType,
        taskId: params.taskId ?? '',
        taskKey: params.taskKey ?? '',
        summary: params.summary,
        recipientUids: params.recipientUids ?? [],
      });
    },
    [sendRaw]
  );

  return {
    connected,
    wsError,
    presenceMembers,
    remoteDrags,
    liveFeed,
    emitDragStart,
    emitDragEnd,
    emitBoardEvent,
  };
}
