import { Hono } from "hono";
import { and, eq, desc, isNull } from "drizzle-orm";
import { db, schema } from "../db";
import {
  randomToken, pairingCode, cameraPath, currentUser,
  bridgeToken, hashToken, ingestUrl, isRtspUrl, isOnline, encryptSecret, rateLimit,
} from "../lib";
import { setRecording } from "../mediamtx";
import { forgetRecordState } from "../reconcile";
import { telegramLink, telegramConfigured } from "../telegram";

export const api = new Hono();

const VIEW_TOKEN_TTL_MS = 1000 * 60 * 10; // 10 минут; плеер переспросит
const PAIRING_TTL_MS = 1000 * 60 * 15; // pairing-код живёт 15 минут
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanName(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : fallback;
}
function clientIp(c: any): string {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "local";
}

async function requireUser(c: any) {
  return currentUser(c.req.raw.headers);
}

// --- Создать bridge → pairing-код (токен генерится при /pair) ---
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
    })
    .returning();
  return c.json({ id: b.id, name: b.name, pairingCode: b.pairingCode, expiresInMs: PAIRING_TTL_MS });
});

// --- Bridge привязывается по pairing-коду → токен (показан ОДИН раз; в БД только hash) ---
api.post("/bridges/pair", async (c) => {
  // Rate-limit неаутентифицированного эндпоинта (H-3): 10/мин на IP.
  if (!rateLimit(`pair:${clientIp(c)}`, 10, 60_000)) return c.json({ error: "слишком много попыток" }, 429);
  const { pairingCode: code } = await c.req.json().catch(() => ({}));
  if (typeof code !== "string" || code.length !== 8) return c.json({ error: "неверный код" }, 400);
  const [b] = await db.select().from(schema.bridges).where(eq(schema.bridges.pairingCode, code)).limit(1);
  if (!b || !b.pairingExpiresAt || b.pairingExpiresAt.getTime() < Date.now()) {
    return c.json({ error: "код недействителен" }, 401);
  }
  const raw = bridgeToken();
  // Атомарно гасим код и пишем hash (single-use гонко-безопасно).
  const [paired] = await db
    .update(schema.bridges)
    .set({
      pairingCode: null,
      pairingExpiresAt: null,
      pairedAt: new Date(),
      lastSeen: new Date(),
      tokenHash: hashToken(raw),
      tokenPrefix: raw.slice(0, 8),
    })
    .where(and(eq(schema.bridges.id, b.id), eq(schema.bridges.pairingCode, code)))
    .returning();
  if (!paired) return c.json({ error: "код недействителен" }, 401);
  return c.json({ bridgeId: b.id, token: raw }); // raw показан единственный раз
});

// --- Список моих bridge (без секретов), online деривируется ---
api.get("/bridges", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "нужна авторизация" }, 401);
  const rows = await db.select().from(schema.bridges).where(eq(schema.bridges.userId, u.id));
  return c.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      paired: !!r.pairedAt,
      online: isOnline(r.lastSeen),
      lastSeen: r.lastSeen,
      agentVersion: r.agentVersion,
      tokenPrefix: r.tokenPrefix,
      pairingCode: r.pairingCode, // ещё не привязан — показываем код; после привязки null
    }))
  );
});

// --- Отозвать токен bridge (мгновенно, привязки камер не рушит) ---
api.post("/bridges/:id/revoke", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "нужна авторизация" }, 401);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "неверный id" }, 400);
  const [b] = await db.select().from(schema.bridges).where(eq(schema.bridges.id, id)).limit(1);
  if (!b || b.userId !== u.id) return c.json({ error: "bridge не найден" }, 404);
  await db.update(schema.bridges).set({ revokedAt: new Date() }).where(eq(schema.bridges.id, id));
  return c.json({ ok: true });
});

// --- Удалить bridge (камеры отвяжутся: bridgeId → NULL) ---
api.delete("/bridges/:id", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "нужна авторизация" }, 401);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "неверный id" }, 400);
  const [b] = await db.select().from(schema.bridges).where(eq(schema.bridges.id, id)).limit(1);
  if (!b || b.userId !== u.id) return c.json({ error: "bridge не найден" }, 404);
  await db.delete(schema.bridges).where(eq(schema.bridges.id, id));
  return c.json({ ok: true });
});

// --- Зарегистрировать камеру. sourceUrl (RTSP) — только вместе с bridgeId, шифруется. ---
api.post("/cameras", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "нужна авторизация" }, 401);
  const { name, bridgeId, sourceUrl } = await c.req.json().catch(() => ({}));

  if (bridgeId !== undefined && bridgeId !== null) {
    if (typeof bridgeId !== "string" || !UUID_RE.test(bridgeId)) return c.json({ error: "неверный bridgeId" }, 400);
    const [br] = await db.select().from(schema.bridges).where(eq(schema.bridges.id, bridgeId)).limit(1);
    if (!br || br.userId !== u.id) return c.json({ error: "bridge не найден" }, 404);
  }
  let encryptedSource: string | null = null;
  if (sourceUrl !== undefined && sourceUrl !== null && sourceUrl !== "") {
    if (!bridgeId) return c.json({ error: "sourceUrl требует bridgeId" }, 400); // M-6
    if (!isRtspUrl(sourceUrl)) return c.json({ error: "sourceUrl должен быть rtsp://" }, 400); // LOW-1
    encryptedSource = encryptSecret(String(sourceUrl));
  }

  const [cam] = await db
    .insert(schema.cameras)
    .values({
      userId: u.id,
      bridgeId: bridgeId || null,
      name: cleanName(name, "Камера"),
      path: cameraPath(),
      publishToken: randomToken(20),
      sourceUrl: encryptedSource,
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

// --- Список моих камер (без секретов); online = deriv(lastSeen) && enabled ---
api.get("/cameras", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "нужна авторизация" }, 401);
  const rows = await db.select().from(schema.cameras).where(eq(schema.cameras.userId, u.id));
  return c.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      path: r.path,
      createdAt: r.createdAt,
      bridgeId: r.bridgeId,
      enabled: r.enabled,
      online: isOnline(r.lastSeen) && r.enabled,
      lastSeen: r.lastSeen,
      viaBridge: !!r.sourceUrl || !!r.onvifUrl,
      recordMode: r.recordMode,
      notifyEnabled: r.notifyEnabled,
    }))
  );
});

// --- Изменить камеру (имя / вкл-выкл) ---
api.patch("/cameras/:id", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "нужна авторизация" }, 401);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "неверный id" }, 400);
  const [cam] = await db.select().from(schema.cameras).where(eq(schema.cameras.id, id)).limit(1);
  if (!cam || cam.userId !== u.id) return c.json({ error: "камера не найдена" }, 404);
  const body = await c.req.json().catch(() => ({}));
  const patch: { name?: string; enabled?: boolean; recordMode?: string; notifyEnabled?: boolean } = {};
  if (typeof body.name === "string") patch.name = cleanName(body.name, cam.name);
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (body.recordMode === "continuous" || body.recordMode === "motion") patch.recordMode = body.recordMode;
  if (typeof body.notifyEnabled === "boolean") patch.notifyEnabled = body.notifyEnabled;
  if (Object.keys(patch).length) await db.update(schema.cameras).set(patch).where(eq(schema.cameras.id, id));

  // Смена режима записи → синхронизируем MediaMTX (иначе рассинхрон до следующего движения).
  if (patch.recordMode && patch.recordMode !== cam.recordMode) {
    forgetRecordState(cam.path); // reconcile переприменит гейт
    if (patch.recordMode === "continuous") await setRecording(cam.path, true); // вернуть непрерывную запись сразу
  }
  return c.json({ ok: true });
});

// --- Удалить камеру (форвардер гаснет на след. heartbeat; архив истечёт по recordDeleteAfter) ---
api.delete("/cameras/:id", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "нужна авторизация" }, 401);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "неверный id" }, 400);
  const [cam] = await db.select().from(schema.cameras).where(eq(schema.cameras.id, id)).limit(1);
  if (!cam || cam.userId !== u.id) return c.json({ error: "камера не найдена" }, 404);
  await db.delete(schema.cameras).where(eq(schema.cameras.id, id));
  return c.json({ ok: true });
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

// ─── ONVIF-обнаружение (Этап 2) ───

// --- Найденные в LAN ONVIF-камеры, ещё не добавленные и не скрытые (по моим bridge'ам) ---
api.get("/discovered", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "нужна авторизация" }, 401);
  const rows = await db
    .select({
      id: schema.discoveredCameras.id,
      bridgeId: schema.discoveredCameras.bridgeId,
      bridgeName: schema.bridges.name,
      name: schema.discoveredCameras.name,
      manufacturer: schema.discoveredCameras.manufacturer,
      model: schema.discoveredCameras.model,
      ip: schema.discoveredCameras.ip,
      lastSeenAt: schema.discoveredCameras.lastSeenAt,
    })
    .from(schema.discoveredCameras)
    .innerJoin(schema.bridges, eq(schema.discoveredCameras.bridgeId, schema.bridges.id))
    .where(
      and(
        eq(schema.bridges.userId, u.id),
        isNull(schema.discoveredCameras.cameraId), // ещё не усыновлена
        isNull(schema.discoveredCameras.dismissedAt) // не скрыта
      )
    )
    .orderBy(desc(schema.discoveredCameras.lastSeenAt));
  return c.json(rows);
});

// --- Усыновить найденную камеру: юзер вводит только логин/пароль, RTSP резолвит агент через ONVIF ---
api.post("/discovered/:id/adopt", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "нужна авторизация" }, 401);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "неверный id" }, 400);
  const { name, username, password } = await c.req.json().catch(() => ({}));
  if (typeof username !== "string" || !username.trim() || typeof password !== "string" || !password) {
    return c.json({ error: "нужны логин и пароль камеры" }, 400);
  }
  const [d] = await db.select().from(schema.discoveredCameras).where(eq(schema.discoveredCameras.id, id)).limit(1);
  if (!d) return c.json({ error: "не найдено" }, 404);
  const [br] = await db.select().from(schema.bridges).where(eq(schema.bridges.id, d.bridgeId)).limit(1);
  if (!br || br.userId !== u.id) return c.json({ error: "не найдено" }, 404); // не мой bridge
  if (d.cameraId) return c.json({ error: "камера уже добавлена" }, 409);

  // encryptSecret вне try: отсутствие ключа → 500 (честная ошибка конфигурации), не маскируем как 409.
  const creds = encryptSecret(JSON.stringify({ u: username.trim(), p: password }));
  let cam;
  try {
    [cam] = await db
      .insert(schema.cameras)
      .values({
        userId: u.id,
        bridgeId: d.bridgeId,
        name: cleanName(name, d.name || "Камера"),
        path: cameraPath(),
        publishToken: randomToken(20),
        deviceKey: d.deviceKey,
        onvifUrl: d.onvifUrl,
        onvifCreds: creds,
      })
      .returning();
  } catch {
    return c.json({ error: "камера уже добавлена" }, 409); // конфликт (bridge_id, device_key)
  }
  await db.update(schema.discoveredCameras).set({ cameraId: cam.id }).where(eq(schema.discoveredCameras.id, id));
  return c.json({ id: cam.id, name: cam.name, path: cam.path });
});

// --- Скрыть находку (мягко; агент может пере-обнаружить, но в списке не покажем) ---
api.delete("/discovered/:id", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "нужна авторизация" }, 401);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "неверный id" }, 400);
  const [d] = await db.select().from(schema.discoveredCameras).where(eq(schema.discoveredCameras.id, id)).limit(1);
  if (!d) return c.json({ error: "не найдено" }, 404);
  const [br] = await db.select().from(schema.bridges).where(eq(schema.bridges.id, d.bridgeId)).limit(1);
  if (!br || br.userId !== u.id) return c.json({ error: "не найдено" }, 404);
  await db.update(schema.discoveredCameras).set({ dismissedAt: new Date() }).where(eq(schema.discoveredCameras.id, id));
  return c.json({ ok: true });
});

// ─── События движения + уведомления (Этап 3) ───

// --- Таймлайн событий движения камеры (владелец/админ) ---
api.get("/cameras/:id/events", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "нужна авторизация" }, 401);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "неверный id" }, 400);
  const [cam] = await db.select().from(schema.cameras).where(eq(schema.cameras.id, id)).limit(1);
  if (!cam || (cam.userId !== u.id && u.role !== "admin")) return c.json({ error: "камера не найдена" }, 404);
  const rows = await db
    .select({ id: schema.events.id, kind: schema.events.kind, startedAt: schema.events.startedAt, endedAt: schema.events.endedAt })
    .from(schema.events)
    .where(eq(schema.events.cameraId, id))
    .orderBy(desc(schema.events.startedAt))
    .limit(100);
  return c.json(rows);
});

// --- Telegram: получить ссылку привязки (или статус «уже привязан») ---
api.get("/telegram/link", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "нужна авторизация" }, 401);
  const [row] = await db.select().from(schema.user).where(eq(schema.user.id, u.id)).limit(1);
  if (row?.telegramChatId) return c.json({ linked: true, configured: telegramConfigured() });
  let code = row?.telegramLinkCode;
  if (!code) {
    code = randomToken(8);
    await db.update(schema.user).set({ telegramLinkCode: code }).where(eq(schema.user.id, u.id));
  }
  return c.json({ linked: false, configured: telegramConfigured(), url: telegramLink(code), code });
});

// --- Telegram: отвязать ---
api.delete("/telegram", async (c) => {
  const u = await requireUser(c);
  if (!u) return c.json({ error: "нужна авторизация" }, 401);
  await db.update(schema.user).set({ telegramChatId: null, telegramLinkCode: null }).where(eq(schema.user.id, u.id));
  return c.json({ ok: true });
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
