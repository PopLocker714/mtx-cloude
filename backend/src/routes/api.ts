import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { randomToken, pairingCode, cameraPath, currentUser } from "../lib";

export const api = new Hono();

const VIEW_TOKEN_TTL_MS = 1000 * 60 * 10; // 10 минут; плеер переспросит

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
    .values({ userId: u.id, name: name || "Bridge", pairingCode: pairingCode(), token: randomToken(32) })
    .returning();
  return c.json({ id: b.id, name: b.name, pairingCode: b.pairingCode });
});

// --- Bridge привязывается по pairing-коду → получает свой постоянный токен ---
api.post("/bridges/pair", async (c) => {
  const { pairingCode: code } = await c.req.json().catch(() => ({}));
  const [b] = await db.select().from(schema.bridges).where(eq(schema.bridges.pairingCode, code ?? "")).limit(1);
  if (!b) return c.json({ error: "код не найден" }, 404);
  await db.update(schema.bridges).set({ pairedAt: new Date(), lastSeen: new Date() }).where(eq(schema.bridges.id, b.id));
  return c.json({ bridgeId: b.id, token: b.token });
});

// --- Зарегистрировать камеру → path + publish-токен ---
api.post("/cameras", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "нужна авторизация" }, 401);
  const { name, bridgeId } = await c.req.json().catch(() => ({}));
  const [cam] = await db
    .insert(schema.cameras)
    .values({
      userId: u.id,
      bridgeId: bridgeId || null,
      name: name || "Камера",
      path: cameraPath(),
      publishToken: randomToken(20),
    })
    .returning();
  return c.json({ id: cam.id, name: cam.name, path: cam.path, publishToken: cam.publishToken });
});

// --- Список моих камер ---
api.get("/cameras", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "нужна авторизация" }, 401);
  const rows = await db.select().from(schema.cameras).where(eq(schema.cameras.userId, u.id));
  return c.json(rows.map((r) => ({ id: r.id, name: r.name, path: r.path, createdAt: r.createdAt })));
});

// --- View-токен для плеера (все мои камеры, либо одна для шаринга) ---
api.post("/cameras/view-token", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "нужна авторизация" }, 401);
  const { cameraId } = await c.req.json().catch(() => ({}));
  if (cameraId) {
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

// --- Админ: все камеры (god-view; каждый просмотр пишется в аудит на уровне auth-hook) ---
api.get("/admin/cameras", async (c) => {
  const u = await requireUser(c);
  if (!u || u.role !== "admin") return c.json({ error: "только админ" }, 403);
  const rows = await db.select().from(schema.cameras);
  return c.json(rows.map((r) => ({ id: r.id, userId: r.userId, name: r.name, path: r.path })));
});
