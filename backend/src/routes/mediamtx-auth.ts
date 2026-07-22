import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { isPrivateIp } from "../lib";

// Внешний авторизатор MediaMTX. MediaMTX шлёт сюда POST на КАЖДОЕ действие;
// 200 = разрешить, 401 = запретить. Здесь живёт вся мультитенантность.
export const mediamtxAuth = new Hono();

type MtxReq = {
  user?: string;
  password?: string;
  token?: string;
  ip?: string;
  action?: string; // publish | read | playback | api | metrics | pprof
  path?: string;
  protocol?: string;
  query?: string;
};

async function audit(actor: { id: string; role: string } | null, path: string, action: string, ip?: string) {
  await db.insert(schema.viewAudit).values({
    actorUserId: actor?.id ?? null,
    actorRole: actor?.role ?? "anonymous",
    cameraPath: path,
    action,
    ip: ip ?? null,
  });
}

mediamtxAuth.post("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as MtxReq;
  const action = body.action ?? "";
  const path = body.path ?? "";
  // MediaMTX может слать секрет в password ИЛИ в token (query ?token=).
  const secret = body.password || body.token || "";

  // Служебные действия — только из приватной сети (никогда наружу).
  if (action === "api" || action === "metrics" || action === "pprof") {
    return isPrivateIp(body.ip) ? c.body(null, 200) : c.body(null, 401);
  }

  if (!path) return c.body(null, 401);

  // Публикация: bridge/камера доказывает право publish-токеном именно этой камеры.
  if (action === "publish") {
    const cam = await db.select().from(schema.cameras).where(eq(schema.cameras.path, path)).limit(1);
    if (cam[0] && secret && secret === cam[0].publishToken) return c.body(null, 200);
    return c.body(null, 401);
  }

  // Просмотр (live) и архив: секрет = view-токен.
  if (action === "read" || action === "playback") {
    if (!secret) return c.body(null, 401);
    const vt = await db.select().from(schema.viewTokens).where(eq(schema.viewTokens.token, secret)).limit(1);
    const t = vt[0];
    if (!t || t.expiresAt.getTime() < Date.now()) return c.body(null, 401);

    const cam = await db.select().from(schema.cameras).where(eq(schema.cameras.path, path)).limit(1);
    if (!cam[0]) return c.body(null, 401);

    const actor = await db.select().from(schema.user).where(eq(schema.user.id, t.userId)).limit(1);
    const role = actor[0]?.role ?? "user";

    // Юзер видит только свою камеру (изоляция тенантов).
    const ownsPath = cam[0].userId === t.userId;
    const scopeOk = !t.cameraId || t.cameraId === cam[0].id;

    // Админ: доступ к ЛЮБОЙ камере (god-view). Аудируем ТОЛЬКО привилегированный
    // доступ — просмотр админом ЧУЖОЙ камеры. Свои камеры и обычные юзеры не логируются
    // (журнал = только god-view, без шума и без путаницы с исторической ролью).
    if (role === "admin") {
      if (!ownsPath) await audit({ id: t.userId, role: "admin" }, path, action, body.ip);
      return c.body(null, 200);
    }

    if (ownsPath && scopeOk) return c.body(null, 200);
    return c.body(null, 401);
  }

  return c.body(null, 401);
});
