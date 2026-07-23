import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { hashToken, ingestUrl, decryptSecret, isRtspUrl, HEARTBEAT_MS, rateLimit } from "../lib";

// API для самого bridge-агента. Авторизация — Bearer okb_… (хэш в БД).
// Всё self-scoped к bridge.userId/bridge.id — userId/bridgeId из тела не принимаем (нет IDOR).
type BridgeRow = typeof schema.bridges.$inferSelect;
export const bridgeApi = new Hono<{ Variables: { bridge: BridgeRow } }>();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Единый источник desired-state (DRY для /cameras и /heartbeat). Отдаём только камеры с источником.
async function desiredState(b: BridgeRow) {
  const rows = await db
    .select()
    .from(schema.cameras)
    .where(and(eq(schema.cameras.bridgeId, b.id), eq(schema.cameras.userId, b.userId!))); // defense-in-depth
  return rows
    .filter((r) => r.sourceUrl && isRtspUrl(safeDecrypt(r.sourceUrl)))
    .map((r) => ({
      cameraId: r.id,
      path: r.path,
      enabled: r.enabled,
      ingestUrl: ingestUrl(r.path, r.publishToken),
      sourceUrl: decryptSecret(r.sourceUrl!),
    }));
}
function safeDecrypt(blob: string): string {
  try {
    return decryptSecret(blob);
  } catch {
    return "";
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
  return c.json({ intervalMs: HEARTBEAT_MS, cameras: await desiredState(b) });
});
