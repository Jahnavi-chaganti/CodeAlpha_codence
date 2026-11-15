import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };
import {
  WsRoomManager,
  type DecodedAuthUser,
  type MembershipInfo,
} from './server/wsManager.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const adminAuth = getAuth();

const tokenVerifier = {
  async verifyIdToken(token: string): Promise<DecodedAuthUser> {
    const decoded = await adminAuth.verifyIdToken(token);
    const displayName =
      typeof decoded.name === 'string' && decoded.name.trim()
        ? decoded.name.trim().slice(0, 80)
        : typeof decoded.email === 'string'
          ? decoded.email.split('@')[0].slice(0, 80)
          : 'Collaborator';
    const photoURL = typeof decoded.picture === 'string' ? decoded.picture.slice(0, 500) : '';
    return {
      uid: decoded.uid,
      displayName,
      photoURL,
      emailVerified: Boolean(decoded.email_verified),
      token,
      exp: typeof decoded.exp === 'number' ? decoded.exp : 0,
    };
  },
};

const membershipVerifier = {
  async verifyProjectMember(
    projectId: string,
    uid: string,
    token: string
  ): Promise<MembershipInfo> {
    try {
      const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
      const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        firebaseConfig.projectId
      )}/databases/${encodeURIComponent(dbId)}/documents/projects/${encodeURIComponent(
        projectId
      )}/members/${encodeURIComponent(uid)}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        return { isMember: false, role: null };
      }

      const data = (await res.json()) as {
        fields?: { role?: { stringValue?: string } };
      };
      const rawRole = data?.fields?.role?.stringValue;
      const role =
        rawRole === 'owner' || rawRole === 'admin' || rawRole === 'member' ? rawRole : 'member';
      return { isMember: true, role };
    } catch {
      return { isMember: false, role: null };
    }
  },
};

const wsManager = new WsRoomManager(tokenVerifier, membershipVerifier);

function parseAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS || '';
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  const allowedOrigins = parseAllowedOrigins();
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'cadence',
      activeConnections: wsManager.activeCount,
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 32 * 1024 });

  wss.on('connection', (ws) => {
    let authenticatedOnce = false;
    const authTimeout = setTimeout(() => {
      if (!authenticatedOnce && ws.readyState === ws.OPEN) {
        ws.close(4001, 'Authentication timeout');
      }
    }, 6000);

    ws.on('pong', () => {
      wsManager.markAlive(ws);
    });

    ws.on('message', async (raw) => {
      try {
        const text = raw.toString();
        await wsManager.handleMessage(ws, text);
        authenticatedOnce = true;
      } catch (err) {
        console.error('WebSocket handler error:', err instanceof Error ? err.message : 'Unknown');
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimeout);
      wsManager.removeSocket(ws);
    });

    ws.on('error', () => {
      clearTimeout(authTimeout);
      wsManager.removeSocket(ws);
    });
  });

  const heartbeatInterval = setInterval(() => {
    wsManager.pruneDeadSockets(wss);
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Cadence server listening on http://0.0.0.0:${PORT}`);
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    clearInterval(heartbeatInterval);
    for (const client of wss.clients) {
      client.close(1001, 'Server shutting down');
    }
    wss.close(() => {
      server.close(() => {
        process.exit(0);
      });
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
