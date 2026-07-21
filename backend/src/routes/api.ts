import { Hono } from "hono";
import { and, eq, desc } from "drizzle-orm";
import { db, schema } from "../db";
import { randomToken, pairingCode, cameraPath, currentUser } from "../lib";

export const api = new Hono();

const VIEW_TOKEN_TTL_MS = 1000 * 60 * 10; // 10 минут; плеер переспросит
const PAIRING_TTL_MS = 1000 * 60 * 15; // pairing-код живёт 15 минут
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Обрезка имени до разумного предела (защита от raw-payload).
function cleanName(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : fallback;
}

// Хост RTSP-ingest, куда bridge/ffmpeg пушат поток. Настраивается env (домен временный).
const INGEST_HOST = process.env.INGEST_HOST || "ingest.tunnel.poploker.ru:8554";
function ingestUrl(path: string, publishToken: string): string {
  return `rtsp://pub:${publishToken}@${INGEST_HOST}/${path}`;
}

// Регистрация/логин/сессии обслуживает Better Auth на /api/auth/*.
// Здесь — только доменные операции; пользователь берётся из BA-сессии.
async function requireUser(c: any) {
  return currentUser(c.req.raw.headers);
}

// --- Создать bridge → pairing-код ---
api.post("/bridges", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "нужна авторизация" }, 401);
  const { name } = await c.req.json().catch(() => ({}));
  const [b] = await db
    .insert(schema.bridges)
    .values({
      userId: u.id,
      name: cleanName(name, "Bridge"),
      pairingCode: pairingCode(),
      pairingExpiresAt: new Date(Date.now() + PAIRING_TTL_MS),
      token: randomToken(32),
    })
    .returning();
  return c.json({ id: b.id, name: b.name, pairingCode: b.pairingCode, expiresInMs: PAIRING_TTL_MS });
});

// --- Bridge привязывается по pairing-коду → получает постоянный токен ---
// Код одноразовый (после привязки гасится) и с TTL. Различие «не найден / истёк»
// наружу не выдаём — единый ответ, чтобы не давать оракул перебора.
api.post("/bridges/pair", async (c) => {
  const { pairingCode: code } = await c.req.json().catch(() => ({}));
  if (typeof code !== "string" || code.length !== 8) return c.json({ error: "неверный код" }, 400);
  const [b] = await db.select().from(schema.bridges).where(eq(schema.bridges.pairingCode, code)).limit(1);
  if (!b || !b.pairingExpiresAt || b.pairingExpiresAt.getTime() < Date.now()) {
    return c.json({ error: "код недействителен" }, 401);
  }
  // Атомарно гасим код: обновляем только если он ещё тот же (single-use гонко-безопасно).
  const [paired] = await db
    .update(schema.bridges)
    .set({ pairingCode: null, pairingExpiresAt: null, pairedAt: new Date(), lastSeen: new Date() })
    .where(and(eq(schema.bridges.id, b.id), eq(schema.bridges.pairingCode, code)))
    .returning();
  if (!paired) return c.json({ error: "код недействителен" }, 401);
  return c.json({ bridgeId: b.id, token: b.token });
});

// --- Зарегистрировать камеру → path + publish-токен ---
api.post("/cameras", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "нужна авторизация" }, 401);
  const { name, bridgeId } = await c.req.json().catch(() => ({}));
  // bridgeId, если задан, ДОЛЖЕН принадлежать этому юзеру (иначе IDOR, M-2).
  if (bridgeId !== undefined && bridgeId !== null) {
    if (typeof bridgeId !== "string" || !UUID_RE.test(bridgeId)) return c.json({ error: "неверный bridgeId" }, 400);
    const [br] = await db.select().from(schema.bridges).where(eq(schema.bridges.id, bridgeId)).limit(1);
    if (!br || br.userId !== u.id) return c.json({ error: "bridge не найден" }, 404);
  }
  const [cam] = await db
    .insert(schema.cameras)
    .values({
      userId: u.id,
      bridgeId: bridgeId || null,
      name: cleanName(name, "Камера"),
      path: cameraPath(),
      publishToken: randomToken(20),
    })
    .returning();
  return c.json({
    id: cam.id,
    name: cam.name,
    path: cam.path,
    publishToken: cam.publishToken,
    ingestUrl: ingestUrl(cam.path, cam.publishToken),
  });
});

// --- Список моих камер (без секретов) ---
api.get("/cameras", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "нужна авторизация" }, 401);
  const rows = await db.select().from(schema.cameras).where(eq(schema.cameras.userId, u.id));
  return c.json(rows.map((r) => ({ id: r.id, name: r.name, path: r.path, createdAt: r.createdAt })));
});

// --- Данные подключения одной камеры (владелец/админ): path + publishToken + ingestUrl ---
api.get("/cameras/:id/connection", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "нужна авторизация" }, 401);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "неверный id" }, 400);
  const [cam] = await db.select().from(schema.cameras).where(eq(schema.cameras.id, id)).limit(1);
  if (!cam || (cam.userId !== u.id && u.role !== "admin")) return c.json({ error: "камера не найдена" }, 404);
  return c.json({
    id: cam.id,
    name: cam.name,
    path: cam.path,
    publishToken: cam.publishToken,
    ingestUrl: ingestUrl(cam.path, cam.publishToken),
  });
});

// --- View-токен для плеера (все мои камеры, либо одна для шаринга) ---
api.post("/cameras/view-token", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "нужна авторизация" }, 401);
  const { cameraId } = await c.req.json().catch(() => ({}));
  if (cameraId) {
    if (typeof cameraId !== "string" || !UUID_RE.test(cameraId)) return c.json({ error: "неверный cameraId" }, 400);
    const [cam] = await db.select().from(schema.cameras).where(eq(schema.cameras.id, cameraId)).limit(1);
    if (!cam || (cam.userId !== u.id && u.role !== "admin")) return c.json({ error: "камера не найдена" }, 404);
  }
  const token = randomToken(24);
  await db.insert(schema.viewTokens).values({
    token,
    userId: u.id,
    cameraId: cameraId || null,
    expiresAt: new Date(Date.now() + VIEW_TOKEN_TTL_MS),
  });
  return c.json({ token, ttlMs: VIEW_TOKEN_TTL_MS });
});

// --- Админ: все камеры всех пользователей (god-view; каждый просмотр аудируется в auth-hook) ---
api.get("/admin/cameras", async (c) => {
  const u = await requireUser(c);
  if (!u || u.role !== "admin") return c.json({ error: "только админ" }, 403);
  const rows = await db
    .select({
      id: schema.cameras.id,
      name: schema.cameras.name,
      path: schema.cameras.path,
      createdAt: schema.cameras.createdAt,
      ownerEmail: schema.user.email,
    })
    .from(schema.cameras)
    .leftJoin(schema.user, eq(schema.cameras.userId, schema.user.id))
    .orderBy(desc(schema.cameras.createdAt));
  return c.json(rows);
});

// --- Админ: журнал доступа (кто/когда/какую камеру смотрел) ---
api.get("/admin/audit", async (c) => {
  const u = await requireUser(c);
  if (!u || u.role !== "admin") return c.json({ error: "только админ" }, 403);
  const rows = await db
    .select({
      at: schema.viewAudit.at,
      actorRole: schema.viewAudit.actorRole,
      cameraPath: schema.viewAudit.cameraPath,
      action: schema.viewAudit.action,
      ip: schema.viewAudit.ip,
      actorEmail: schema.user.email,
    })
    .from(schema.viewAudit)
    .leftJoin(schema.user, eq(schema.viewAudit.actorUserId, schema.user.id))
    .orderBy(desc(schema.viewAudit.at))
    .limit(100);
  return c.json(rows);
});
