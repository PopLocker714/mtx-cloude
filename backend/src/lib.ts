import { auth } from "./auth";

// --- случайные токены/коды ---
export function randomToken(bytes = 24): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
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
