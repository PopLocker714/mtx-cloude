import { Hono } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "../db";
import { hashToken, ingestUrl, decryptSecret, isRtspUrl, HEARTBEAT_MS, rateLimit } from "../lib";
import { setRecording } from "../mediamtx";
import { sendTelegram } from "../telegram";

// API для самого bridge-агента. Авторизация — Bearer okb_… (хэш в БД).
// Всё self-scoped к bridge.userId/bridge.id — userId/bridgeId из тела не принимаем (нет IDOR).
type BridgeRow = typeof schema.bridges.$inferSelect;
export const bridgeApi = new Hono<{ Variables: { bridge: BridgeRow } }>();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Единый источник desired-state (DRY для /cameras и /heartbeat). Отдаём камеры с источником:
// либо готовый RTSP (Этап 1), либо ONVIF-дескриптор — агент сам резолвит RTSP через GetStreamUri (Этап 2).
async function desiredState(b: BridgeRow) {
  const rows = await db
    .select()
    .from(schema.cameras)
    .where(and(eq(schema.cameras.bridgeId, b.id), eq(schema.cameras.userId, b.userId!))); // defense-in-depth
  const out: Array<Record<string, unknown>> = [];
  for (const r of rows) {
    // motion: агенту нужно детектить движение, если запись по движению ИЛИ включены уведомления.
    const base = {
      cameraId: r.id,
      path: r.path,
      enabled: r.enabled,
      ingestUrl: ingestUrl(r.path, r.publishToken),
      motion: r.recordMode === "motion" || r.notifyEnabled,
    };
    // ONVIF-режим: креды и xaddr — агент резолвит RTSP на своей стороне (креды не уходят в MediaMTX).
    if (r.onvifUrl && r.onvifCreds) {
      const creds = safeCreds(r.onvifCreds);
      if (creds) {
        out.push({ ...base, onvif: { url: r.onvifUrl, username: creds.u, password: creds.p } });
        continue;
      }
    }
    // RTSP-режим (Этап 1): готовый источник.
    if (r.sourceUrl) {
      const src = safeDecrypt(r.sourceUrl);
      if (isRtspUrl(src)) out.push({ ...base, sourceUrl: src });
    }
  }
  return out;
}
function safeDecrypt(blob: string): string {
  try {
    return decryptSecret(blob);
  } catch {
    return "";
  }
}
function safeCreds(blob: string): { u: string; p: string } | null {
  try {
    const o = JSON.parse(decryptSecret(blob));
    return o && typeof o.u === "string" && typeof o.p === "string" ? { u: o.u, p: o.p } : null;
  } catch {
    return null;
  }
}
function strOrNull(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

// Приём найденных ONVIF-устройств (пришли в теле heartbeat). Upsert по (bridgeId, deviceKey):
// обновляем «живость»/метаданные, НЕ трогаем camera_id и dismissed_at (усыновление/скрытие — решение из ЛК).
async function ingestDiscovered(b: BridgeRow, devices: unknown[]) {
  for (const d of devices.slice(0, 64)) {
    const dev = d as Record<string, unknown>;
    const deviceKey = strOrNull(dev.deviceKey, 200);
    const onvifUrl = strOrNull(dev.onvifUrl, 500);
    if (!deviceKey || !onvifUrl || !/^https?:\/\//i.test(onvifUrl)) continue;
    const meta = {
      name: strOrNull(dev.name, 120),
      manufacturer: strOrNull(dev.manufacturer, 80),
      model: strOrNull(dev.model, 80),
      ip: strOrNull(dev.ip, 64),
      onvifUrl,
      lastSeenAt: new Date(),
    };
    await db
      .insert(schema.discoveredCameras)
      .values({ bridgeId: b.id, deviceKey, ...meta })
      .onConflictDoUpdate({
        target: [schema.discoveredCameras.bridgeId, schema.discoveredCameras.deviceKey],
        set: meta,
      });
  }
}

// Bearer okb_… → bridge. Непривязанный/отозванный → 401 (токен инертен).
bridgeApi.use("*", async (c, next) => {
  const m = /^Bearer\s+(okb_[0-9a-f]{16,})$/i.exec(c.req.header("authorization") || "");
  if (!m) return c.json({ error: "нужен bridge-токен" }, 401);
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`bridge:${ip}`, 120, 60_000)) return c.json({ error: "слишком много запросов" }, 429);
  const [b] = await db.select().from(schema.bridges).where(eq(schema.bridges.tokenHash, hashToken(m[1]))).limit(1);
  if (!b || !b.pairedAt || b.revokedAt) return c.json({ error: "bridge не привязан" }, 401);
  c.set("bridge", b);
  await next();
});

// Реконсиляция при рестарте агента.
bridgeApi.get("/cameras", async (c) => c.json(await desiredState(c.get("bridge"))));

// Heartbeat: телеметрия IN, desired-state OUT (единственный канал управления за NAT).
bridgeApi.post("/heartbeat", async (c) => {
  const b = c.get("bridge");
  const body = await c.req.json().catch(() => ({}) as any);
  await db
    .update(schema.bridges)
    .set({
      lastSeen: new Date(),
      lastIp: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      agentVersion: typeof body.agentVersion === "string" ? body.agentVersion.slice(0, 40) : b.agentVersion,
    })
    .where(eq(schema.bridges.id, b.id));

  for (const s of Array.isArray(body.cameras) ? body.cameras : []) {
    if (!s || typeof s.cameraId !== "string" || !UUID_RE.test(s.cameraId)) continue;
    await db
      .update(schema.cameras)
      .set({ lastSeen: new Date() }) // online деривируем, булев не храним
      .where(and(eq(schema.cameras.id, s.cameraId), eq(schema.cameras.bridgeId, b.id)));
  }
  // ONVIF-находки агента (если приложил к heartbeat) → «входящие» в ЛК.
  if (Array.isArray(body.discovered) && body.discovered.length) await ingestDiscovered(b, body.discovered);
  return c.json({ intervalMs: HEARTBEAT_MS, cameras: await desiredState(b) });
});

// Пинг движения: агент шлёт при обнаружении и периодически, пока движение длится.
// Нарастающий фронт (нет открытого события) → создаём событие + уведомляем + включаем запись.
// Спад/закрытие события и выключение записи по cooldown — в цикле reconcile (единый авторитет).
bridgeApi.post("/motion", async (c) => {
  const b = c.get("bridge");
  const body = await c.req.json().catch(() => ({}) as any);
  const cameraId = body.cameraId;
  if (typeof cameraId !== "string" || !UUID_RE.test(cameraId)) return c.json({ error: "неверный cameraId" }, 400);
  const [cam] = await db
    .select()
    .from(schema.cameras)
    .where(and(eq(schema.cameras.id, cameraId), eq(schema.cameras.bridgeId, b.id)))
    .limit(1);
  if (!cam) return c.json({ ok: false }, 404); // не моя камера

  const now = new Date();
  await db.update(schema.cameras).set({ lastMotionAt: now }).where(eq(schema.cameras.id, cam.id));

  const [open] = await db
    .select({ id: schema.events.id })
    .from(schema.events)
    .where(and(eq(schema.events.cameraId, cam.id), isNull(schema.events.endedAt)))
    .limit(1);
  if (!open) {
    // Нарастающий фронт движения.
    await db.insert(schema.events).values({ cameraId: cam.id, userId: cam.userId, kind: "motion", startedAt: now });
    if (cam.recordMode === "motion") await setRecording(cam.path, true); // низкая задержка старта записи
    if (cam.notifyEnabled) void notifyMotion(cam.userId, cam.name); // не блокируем ответ агенту
  }
  return c.json({ ok: true });
});

// Уведомление о движении в Telegram (если привязан chatId). Fire-and-forget.
async function notifyMotion(userId: string, cameraName: string) {
  try {
    const [u] = await db
      .select({ chatId: schema.user.telegramChatId })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1);
    if (u?.chatId) await sendTelegram(u.chatId, `🎥 Движение: <b>${cameraName}</b>`);
  } catch (e) {
    console.error("[motion] notify failed:", (e as Error).message);
  }
}
