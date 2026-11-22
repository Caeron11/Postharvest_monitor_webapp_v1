import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  acknowledgeAlertForCoop,
  applySimulatorRoomsForCoop,
  createBatchForCoop,
  fetchCooperativeWorkspace,
  getOrCreateProfile,
  updateBatchForCoop,
  updateCropRulesForCoop,
  updateProfileRecord,
  updateRoomForCoop,
} from './src/db/postharvestStore.ts';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import type {
  CompressorMode,
  CropThresholdRule,
  CropType,
  InventoryBatch,
  LanguageCode,
  UserRole,
} from './src/types/postharvest.ts';

const VALID_CROPS = new Set<CropType>(['Tomato', 'Broccoli']);

const VALID_MODES = new Set<CompressorMode>(['auto', 'boost', 'standby']);

const VALID_ROLES = new Set<UserRole>([
  'Facility Manager',
  'Cold-Chain Operator',
  'Quality Inspector',
]);

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

async function resolveUserCooperative(req: AuthRequest) {
  const uid = req.user?.uid;
  if (!uid) {
    throw new Error('Unauthorized');
  }
  const email = req.user?.email ?? '';
  const name = typeof req.user?.name === 'string' ? req.user.name : undefined;
  return getOrCreateProfile(uid, email, name);
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/facility', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email ?? '';
      const displayName =
        typeof req.user!.name === 'string' ? req.user!.name : undefined;
      const payload = await fetchCooperativeWorkspace(uid, email, displayName);
      res.json(payload);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to load facility data.';
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const body = req.body as Record<string, unknown>;
      const patch: Parameters<typeof updateProfileRecord>[1] = {};

      if (typeof body.fullName === 'string' && body.fullName.trim().length > 0) {
        patch.fullName = body.fullName.trim().slice(0, 120);
      }
      if (typeof body.email === 'string' && body.email.includes('@')) {
        patch.email = body.email.trim().slice(0, 180);
      }
      if (
        typeof body.cooperativeName === 'string' &&
        body.cooperativeName.trim().length > 0
      ) {
        patch.cooperativeName = body.cooperativeName.trim().slice(0, 120);
      }
      if (
        typeof body.role === 'string' &&
        VALID_ROLES.has(body.role as UserRole)
      ) {
        patch.role = body.role as UserRole;
      }
      if (body.language === 'en' || body.language === 'fil') {
        patch.language = body.language as LanguageCode;
      }
      if (body.themePrefs && typeof body.themePrefs === 'object') {
        const tp = body.themePrefs as Record<string, unknown>;
        if (
          (tp.theme === 'light' || tp.theme === 'dark') &&
          isFiniteNum(tp.blurPx) &&
          isFiniteNum(tp.frostPct) &&
          isFiniteNum(tp.depthScale) &&
          isFiniteNum(tp.dispersionPct)
        ) {
          patch.themePrefs = {
            theme: tp.theme,
            blurPx: Math.min(48, Math.max(8, tp.blurPx)),
            frostPct: Math.min(90, Math.max(35, tp.frostPct)),
            depthScale: Math.min(1.5, Math.max(0.5, tp.depthScale)),
            dispersionPct: Math.min(150, Math.max(0, tp.dispersionPct)),
          };
        }
      }
      if (body.notificationPrefs && typeof body.notificationPrefs === 'object') {
        const np = body.notificationPrefs as Record<string, unknown>;
        patch.notificationPrefs = {
          criticalTemp: Boolean(np.criticalTemp),
          sensorOffline: Boolean(np.sensorOffline),
          fefoReminders: Boolean(np.fefoReminders),
          audibleChime: Boolean(np.audibleChime),
        };
      }

      await updateProfileRecord(uid, patch);
      res.json({ ok: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save profile.';
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/rooms/:roomId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const profile = await resolveUserCooperative(req);
      const roomId = String(req.params.roomId ?? '').trim();
      if (!roomId) {
        res.status(400).json({ error: 'Invalid room ID.' });
        return;
      }

      const body = req.body as Record<string, unknown>;
      const patch: Parameters<typeof updateRoomForCoop>[2] = {};

      if (
        typeof body.equipmentMode === 'string' &&
        VALID_MODES.has(body.equipmentMode as CompressorMode)
      ) {
        patch.equipmentMode = body.equipmentMode as CompressorMode;
      }
      if (typeof body.defrostActive === 'boolean') {
        patch.defrostActive = body.defrostActive;
      }
      if (typeof body.sensorOnline === 'boolean') {
        patch.sensorOnline = body.sensorOnline;
      }
      if (isFiniteNum(body.tempC)) patch.tempC = body.tempC;
      if (isFiniteNum(body.humidityPct)) patch.humidityPct = body.humidityPct;
      if (isFiniteNum(body.co2Ppm)) patch.co2Ppm = body.co2Ppm;
      if (isFiniteNum(body.gasIndex)) patch.gasIndex = body.gasIndex;

      await updateRoomForCoop(profile.cooperativeId, roomId, patch);
      res.json({ ok: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to update room.';
      res.status(500).json({ error: message });
    }
  });

  app.put('/api/rules/:crop', requireAuth, async (req: AuthRequest, res) => {
    try {
      const profile = await resolveUserCooperative(req);
      const cropParam = decodeURIComponent(String(req.params.crop ?? ''));
      if (!VALID_CROPS.has(cropParam as CropType)) {
        res.status(400).json({ error: 'Unsupported crop type.' });
        return;
      }

      const body = req.body as Partial<CropThresholdRule>;
      if (
        !isFiniteNum(body.tempMin) ||
        !isFiniteNum(body.tempMax) ||
        body.tempMin >= body.tempMax ||
        !isFiniteNum(body.humidityMin) ||
        !isFiniteNum(body.humidityMax) ||
        body.humidityMin >= body.humidityMax ||
        !isFiniteNum(body.co2Max) ||
        !isFiniteNum(body.gasIndexMax)
      ) {
        res.status(400).json({ error: 'Invalid threshold values.' });
        return;
      }

      await updateCropRulesForCoop(profile.cooperativeId, {
        crop: cropParam as CropType,
        tempMin: body.tempMin,
        tempMax: body.tempMax,
        humidityMin: body.humidityMin,
        humidityMax: body.humidityMax,
        co2Max: body.co2Max,
        gasIndexMax: body.gasIndexMax,
        tempHoldMinutes: isFiniteNum(body.tempHoldMinutes)
          ? body.tempHoldMinutes
          : 15,
        notifyInApp: Boolean(body.notifyInApp ?? true),
        notifySms: Boolean(body.notifySms ?? false),
      });

      res.json({ ok: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save crop rules.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/batches', requireAuth, async (req: AuthRequest, res) => {
    try {
      const profile = await resolveUserCooperative(req);
      const body = req.body as Partial<InventoryBatch>;
      if (
        typeof body.id !== 'string' ||
        !body.id.trim() ||
        typeof body.roomId !== 'string' ||
        !body.roomId.trim() ||
        typeof body.crop !== 'string' ||
        !VALID_CROPS.has(body.crop as CropType) ||
        !isFiniteNum(body.qtyKg) ||
        body.qtyKg <= 0 ||
        !isFiniteNum(body.shelfLifeDays) ||
        !isFiniteNum(body.shelfLifeLimitDays) ||
        !isFiniteNum(body.currentPricePhp) ||
        !isFiniteNum(body.targetPricePhp)
      ) {
        res.status(400).json({ error: 'Invalid inventory batch payload.' });
        return;
      }

      await createBatchForCoop(profile.cooperativeId, {
        id: body.id.trim().slice(0, 80),
        crop: body.crop as CropType,
        roomId: body.roomId.trim(),
        rackId:
          typeof body.rackId === 'string' && body.rackId.trim()
            ? body.rackId.trim().slice(0, 20)
            : 'R1',
        qtyKg: body.qtyKg,
        harvestedDate:
          typeof body.harvestedDate === 'string'
            ? body.harvestedDate
            : new Date().toISOString().slice(0, 10),
        shelfLifeDays: Math.max(0, Math.round(body.shelfLifeDays)),
        shelfLifeLimitDays: Math.max(1, Math.round(body.shelfLifeLimitDays)),
        currentPricePhp: body.currentPricePhp,
        targetPricePhp: body.targetPricePhp,
        manualHold: Boolean(body.manualHold),
        released: Boolean(body.released),
        releaseNote:
          typeof body.releaseNote === 'string'
            ? body.releaseNote.slice(0, 240)
            : undefined,
      });

      res.status(201).json({ ok: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create batch.';
      res.status(500).json({ error: message });
    }
  });

  app.patch(
    '/api/batches/:batchId',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const profile = await resolveUserCooperative(req);
        const batchId = String(req.params.batchId ?? '').trim();
        if (!batchId) {
          res.status(400).json({ error: 'Invalid batch ID.' });
          return;
        }

        const body = req.body as Record<string, unknown>;
        const patch: Parameters<typeof updateBatchForCoop>[2] = {};

        if (isFiniteNum(body.quantityKg) && body.quantityKg >= 0) {
          patch.quantityKg = body.quantityKg;
        }
        if (
          body.status === 'active' ||
          body.status === 'hold' ||
          body.status === 'released'
        ) {
          patch.status = body.status;
        }
        if (typeof body.releaseNote === 'string') {
          patch.releaseNote = body.releaseNote.trim().slice(0, 240) || null;
        } else if (body.releaseNote === null) {
          patch.releaseNote = null;
        }

        await updateBatchForCoop(profile.cooperativeId, batchId, patch);
        res.json({ ok: true });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to update batch.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.patch(
    '/api/alerts/:alertId/acknowledge',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const profile = await resolveUserCooperative(req);
        const alertId = String(req.params.alertId ?? '').trim();
        if (!alertId) {
          res.status(400).json({ error: 'Invalid alert ID.' });
          return;
        }
        await acknowledgeAlertForCoop(profile.cooperativeId, alertId);
        res.json({ ok: true });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to acknowledge alert.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.post(
    '/api/simulator/apply',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const profile = await resolveUserCooperative(req);
        const body = req.body as {
          rooms?: Array<{
            id: string;
            tempC: number;
            humidityPct: number;
            co2Ppm: number;
            gasIndex: number;
            sensorOnline: boolean;
          }>;
        };
        if (!Array.isArray(body.rooms)) {
          res.status(400).json({ error: 'Invalid simulator payload.' });
          return;
        }
        const sanitized = body.rooms.filter(
          (r) =>
            typeof r?.id === 'string' &&
            isFiniteNum(r.tempC) &&
            isFiniteNum(r.humidityPct) &&
            isFiniteNum(r.co2Ppm) &&
            isFiniteNum(r.gasIndex) &&
            typeof r.sensorOnline === 'boolean'
        );
        await applySimulatorRoomsForCoop(profile.cooperativeId, sanitized);
        res.json({ ok: true });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to apply scenario readings.';
        res.status(500).json({ error: message });
      }
    }
  );

  const httpServer = http.createServer(app);

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : { server: httpServer },
        ws: disableHmr ? false : undefined,
        watch: disableHmr ? null : {},
      },
      appType: 'spa',
    });
    if (disableHmr) {
      app.get('/@vite/client', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.send(`
const sheetsMap = new Map();
let lastInsertedStyle;
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = undefined; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement('afterend', style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  const noop = () => {};
  return {
    data: {},
    accept: noop,
    acceptExports: noop,
    dispose: noop,
    prune: noop,
    decline: noop,
    invalidate: noop,
    on: noop,
    off: noop,
    send: noop,
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== '.' && url[0] !== '/') return url;
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.dev');
  return pathname + '?' + queryToInject + (search ? '&' + search.slice(1) : '') + (hash || '');
}
export class ErrorOverlay extends HTMLElement {}
`);
      });
    }
    app.use(vite.middlewares);
  } else {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Postharvest Monitor server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
