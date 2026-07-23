import { auth } from "./auth";
import { createHash, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

// --- случайные токены/коды ---
export function randomToken(bytes = 24): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Bridge-токен с самоопознаваемым префиксом (okb_ = oko-bridge), ~256 бит.
export function bridgeToken(): string {
  return "okb_" + randomToken(32);
}
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// --- online-деривация bridge/камеры по heartbeat ---
export const HEARTBEAT_MS = 30_000;
export const BRIDGE_STALE_MS = 90_000;

// --- Движение (Этап 3): запись и открытое событие держатся столько после последнего пинга ---
export const MOTION_COOLDOWN_MS = Number(process.env.MOTION_COOLDOWN_MS || 25_000);
export function isOnline(lastSeen?: Date | null): boolean {
  return !!lastSeen && Date.now() - lastSeen.getTime() < BRIDGE_STALE_MS;
}

// --- RTSP-ingest URL (перенесён из api.ts; единый источник) ---
const INGEST_HOST = process.env.INGEST_HOST || "ingest.tunnel.poploker.ru:8554";
export function ingestUrl(path: string, publishToken: string): string {
  return `rtsp://pub:${publishToken}@${INGEST_HOST}/${path}`;
}
export function isRtspUrl(u: string): boolean {
  return typeof u === "string" && /^rtsps?:\/\//i.test(u);
}

// --- Шифрование creds камеры (AES-256-GCM). Fail-closed: без ключа падаем. ---
const KEY = process.env.BRIDGE_SECRET_KEY ? Buffer.from(process.env.BRIDGE_SECRET_KEY, "hex") : null;
export function bridgeKeyConfigured(): boolean {
  return !!KEY && KEY.length === 32;
}
export function encryptSecret(plain: string): string {
  if (!KEY) throw new Error("BRIDGE_SECRET_KEY must be set (openssl rand -hex 32)");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString("base64")).join(".");
}
export function decryptSecret(blob: string): string {
  if (!KEY) throw new Error("BRIDGE_SECRET_KEY must be set (openssl rand -hex 32)");
  const [iv, tag, ct] = blob.split(".").map((s) => Buffer.from(s, "base64"));
  const d = createDecipheriv("aes-256-gcm", KEY, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

// --- Примитивный in-memory rate-limit (per-key, sliding window). Один инстанс; redis — Этап 3. ---
const rlBuckets = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (rlBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    rlBuckets.set(key, hits);
    return false; // превышен лимит
  }
  hits.push(now);
  rlBuckets.set(key, hits);
  return true;
}

// Человекочитаемый pairing-код: 8 символов без похожих (0/O, 1/I).
export function pairingCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => alphabet[b % alphabet.length]).join("");
}

// Путь камеры в MediaMTX: только [a-z0-9_], уникальный, без утечки id наружу.
export function cameraPath(): string {
  return "cam_" + randomToken(6);
}

// Текущий пользователь из Better Auth-сессии (по заголовкам запроса) или null.
export async function currentUser(headers: Headers): Promise<{ id: string; role: string } | null> {
  const s = await auth.api.getSession({ headers });
  if (!s?.user) return null;
  return { id: s.user.id, role: (s.user as any).role ?? "user" };
}

// Реальный IP клиента за ОДНИМ доверенным прокси (Traefik дописывает его в КОНЕЦ XFF).
// Берём последний элемент: всё, что раньше — клиент мог подделать. Первый ([0]) спуфится
// и ломает per-IP rate-limit/аудит (H3). Предполагает ровно один доверенный прокси.
export function realIp(xff?: string | null, xRealIp?: string | null): string {
  const parts = (xff || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length) return parts[parts.length - 1];
  return (xRealIp || "").trim() || "local";
}

// Приватный IP — для служебных действий MediaMTX (api/metrics), не публичных.
// Разбор по октетам, а не startsWith: 172.x приватен ТОЛЬКО 172.16–172.31 (docker сюда попадает).
export function isPrivateIp(ip: string | undefined): boolean {
  if (!ip) return false;
  const clean = ip.replace(/^::ffff:/, "");
  if (clean === "::1") return true;
  // IPv6 ULA: fc00::/7 → первый байт fc или fd
  if (/^f[cd]/i.test(clean) && clean.includes(":")) return true;
  const m = clean.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 127) return true; // loopback
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (docker default)
  return false;
}
