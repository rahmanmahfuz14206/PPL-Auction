import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  INITIAL_PLAYERS,
  PlayerSlide,
  BidEntry,
  getPhotoNumberFromFilename,
} from './src/data/auctionData.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_PLAYERS_DIR = path.join(__dirname, 'players');
const PUBLIC_PLAYERS_DIR = path.join(__dirname, 'public', 'players');

if (!fs.existsSync(ROOT_PLAYERS_DIR)) {
  fs.mkdirSync(ROOT_PLAYERS_DIR, { recursive: true });
}
if (!fs.existsSync(PUBLIC_PLAYERS_DIR)) {
  fs.mkdirSync(PUBLIC_PLAYERS_DIR, { recursive: true });
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

/**
 * Scans /players and /public/players folders and returns pure photo slides sorted numerically (01, 02, 03...)
 */
function scanPlayersFolder(existingPlayers: PlayerSlide[] = []): PlayerSlide[] {
  try {
    const rootFiles = fs.existsSync(ROOT_PLAYERS_DIR)
      ? fs.readdirSync(ROOT_PLAYERS_DIR)
      : [];
    for (const file of rootFiles) {
      const ext = path.extname(file).toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext)) {
        const src = path.join(ROOT_PLAYERS_DIR, file);
        const dest = path.join(PUBLIC_PLAYERS_DIR, file);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
        }
      }
    }

    const pubFiles = fs.existsSync(PUBLIC_PLAYERS_DIR)
      ? fs.readdirSync(PUBLIC_PLAYERS_DIR)
      : [];
    for (const file of pubFiles) {
      const ext = path.extname(file).toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext)) {
        const src = path.join(PUBLIC_PLAYERS_DIR, file);
        const dest = path.join(ROOT_PLAYERS_DIR, file);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
        }
      }
    }

    const allImageFiles = fs
      .readdirSync(ROOT_PLAYERS_DIR)
      .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (allImageFiles.length === 0) {
      return existingPlayers.length > 0 ? existingPlayers : INITIAL_PLAYERS;
    }

    const existingMap = new Map<string, PlayerSlide>();
    for (const p of existingPlayers) {
      existingMap.set(p.id, p);
      existingMap.set(p.slideImageUrl, p);
    }

    return allImageFiles.map((file, idx) => {
      const id = `folder-${file}`;
      const slideImageUrl = `/players/${encodeURIComponent(file)}`;
      const photoNumber = getPhotoNumberFromFilename(file, idx);
      const prev = existingMap.get(id) || existingMap.get(slideImageUrl);
      if (prev) {
        return {
          ...prev,
          photoNumber,
          filename: file,
          slideImageUrl,
        };
      }
      return {
        id,
        photoNumber,
        filename: file,
        slideImageUrl,
        basePrice: 5000000,
      };
    });
  } catch (err) {
    console.error('Error scanning players folder:', err);
    return existingPlayers.length > 0 ? existingPlayers : INITIAL_PLAYERS;
  }
}

export interface SharedAuctionState {
  players: PlayerSlide[];
  currentIndex: number;
  currentBid: number;
  bidHistory: BidEntry[];
  leadingTeamId?: string;
  lastStepAmount: number;
  isAuctionEnded: boolean;
  activeSale: {
    playerId: string;
    teamId: string;
    amount: number;
    timestamp: number;
  } | null;
  updatedAt: number;
}

const initialScannedPlayers = scanPlayersFolder(INITIAL_PLAYERS);
const initialFirstPlayer = initialScannedPlayers[0];

let serverState: SharedAuctionState = {
  players: initialScannedPlayers,
  currentIndex: 0,
  currentBid: initialFirstPlayer ? initialFirstPlayer.basePrice : 5000000,
  bidHistory: [],
  leadingTeamId: undefined,
  lastStepAmount: 1000,
  isAuctionEnded: false,
  activeSale: null,
  updatedAt: Date.now(),
};

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  app.use(express.json({ limit: '50mb' }));

  app.use('/players', express.static(ROOT_PLAYERS_DIR));
  app.use('/players', express.static(PUBLIC_PLAYERS_DIR));

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  const broadcastState = (excludeClient?: WebSocket) => {
    const payload = JSON.stringify({
      type: 'state:sync',
      state: serverState,
      connectedClients: wss.clients.size,
    });
    wss.clients.forEach((client) => {
      if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  };

  const broadcastPresence = () => {
    const payload = JSON.stringify({
      type: 'presence:update',
      connectedClients: wss.clients.size,
    });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  };

  wss.on('connection', (ws) => {
    ws.send(
      JSON.stringify({
        type: 'state:sync',
        state: serverState,
        connectedClients: wss.clients.size,
      })
    );
    broadcastPresence();

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'state:update' && msg.state) {
          serverState = {
            ...serverState,
            ...msg.state,
            updatedAt: Date.now(),
          };
          broadcastState();
        }
      } catch {
        // ignore malformed WS messages
      }
    });

    ws.on('close', () => {
      broadcastPresence();
    });
  });

  try {
    fs.watch(ROOT_PLAYERS_DIR, () => {
      const updated = scanPlayersFolder(serverState.players);
      serverState = {
        ...serverState,
        players: updated,
        updatedAt: Date.now(),
      };
      broadcastState();
    });
  } catch {
    // ignore fs.watch unsupported errors
  }

  app.get('/api/state', (_req, res) => {
    res.json({
      state: serverState,
      connectedClients: wss.clients.size,
    });
  });

  app.post('/api/state', (req, res) => {
    if (req.body && req.body.state) {
      serverState = {
        ...serverState,
        ...req.body.state,
        updatedAt: Date.now(),
      };
      broadcastState();
    }
    res.json({
      ok: true,
      state: serverState,
      connectedClients: wss.clients.size,
    });
  });

  app.post('/api/players/upload', (req, res) => {
    try {
      const files: Array<{ filename: string; dataUrl: string }> =
        req.body?.files || [];
      for (const item of files) {
        const matches = item.dataUrl.match(
          /^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/
        );
        if (!matches) continue;
        const buffer = Buffer.from(matches[2], 'base64');
        const safeName = item.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        fs.writeFileSync(path.join(ROOT_PLAYERS_DIR, safeName), buffer);
        fs.writeFileSync(path.join(PUBLIC_PLAYERS_DIR, safeName), buffer);
      }

      const updatedPlayers = scanPlayersFolder(serverState.players);
      serverState = {
        ...serverState,
        players: updatedPlayers,
        isAuctionEnded: false,
        updatedAt: Date.now(),
      };
      broadcastState();

      res.json({
        ok: true,
        players: updatedPlayers,
        state: serverState,
      });
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ error: 'Failed to save to players folder' });
    }
  });

  app.post('/api/players/rescan', (_req, res) => {
    const updatedPlayers = scanPlayersFolder(serverState.players);
    serverState = {
      ...serverState,
      players: updatedPlayers,
      updatedAt: Date.now(),
    };
    broadcastState();
    res.json({
      ok: true,
      players: updatedPlayers,
      state: serverState,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(
      `PPL-26 Auction Server running on http://0.0.0.0:${PORT} (Photos served from /players folder)`
    );
  });
}

startServer();
