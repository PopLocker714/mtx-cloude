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
export function isPrivateIp(ip: string | undefined): boolean {
  if (!ip) return false;
  const clean = ip.replace(/^::ffff:/, "");
  return (
    clean === "127.0.0.1" ||
    clean === "::1" ||
    clean.startsWith("10.") ||
    clean.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(clean) ||
    clean.startsWith("172.") || // docker-сети
    clean.startsWith("fd")
  );
}
