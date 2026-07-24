import { API_BASE as BASE, ARCHIVE_BASE } from "./api-base";

// Тонкий клиент нашего Hono API. Куки Better Auth ходят через credentials:include.
async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}/api${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

export type Camera = {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  bridgeId: string | null;
  enabled: boolean;
  online: boolean;
  viaBridge: boolean;
  lastSeen: string | null;
  recordMode: "continuous" | "motion";
  notifyEnabled: boolean;
};
export type CameraConnection = {
  id: string;
  name: string;
  path: string;
  publishToken: string;
  ingestUrl: string;
};

export const listCameras = (): Promise<Camera[]> => api("/cameras");
// name-only (ручной ffmpeg-flow) ИЛИ через bridge (bridgeId + sourceUrl RTSP).
export const createCamera = (opts: { name: string; bridgeId?: string; sourceUrl?: string }): Promise<CameraConnection> =>
  api("/cameras", { method: "POST", body: JSON.stringify(opts) });
export const getConnection = (id: string): Promise<CameraConnection> => api(`/cameras/${id}/connection`);
export const patchCamera = (
  id: string,
  patch: { name?: string; enabled?: boolean; recordMode?: "continuous" | "motion"; notifyEnabled?: boolean }
) => api(`/cameras/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
export const deleteCamera = (id: string) => api(`/cameras/${id}`, { method: "DELETE" });

// --- События движения (Этап 3) ---
export type MotionEvent = { id: string; kind: string; startedAt: string; endedAt: string | null };
export const listEvents = (cameraId: string): Promise<MotionEvent[]> => api(`/cameras/${cameraId}/events`);

// --- Telegram-уведомления ---
export type TelegramStatus = { linked: boolean; configured: boolean; url?: string; code?: string };
export const getTelegramLink = (): Promise<TelegramStatus> => api("/telegram/link");
export const unlinkTelegram = () => api("/telegram", { method: "DELETE" });

// --- Bridge ---
export type Bridge = {
  id: string;
  name: string;
  paired: boolean;
  online: boolean;
  lastSeen: string | null;
  agentVersion: string | null;
  tokenPrefix: string | null;
  pairingCode: string | null;
};
export const listBridges = (): Promise<Bridge[]> => api("/bridges");
export const createBridge = (name: string): Promise<{ id: string; name: string; pairingCode: string; expiresInMs: number }> =>
  api("/bridges", { method: "POST", body: JSON.stringify({ name }) });
export const revokeBridge = (id: string) => api(`/bridges/${id}/revoke`, { method: "POST" });
export const deleteBridge = (id: string) => api(`/bridges/${id}`, { method: "DELETE" });
export const createViewToken = (cameraId?: string): Promise<{ token: string; ttlMs: number }> =>
  api("/cameras/view-token", { method: "POST", body: JSON.stringify(cameraId ? { cameraId } : {}) });

// --- ONVIF-обнаружение (Этап 2): камеры, найденные агентом в LAN ---
export type DiscoveredCamera = {
  id: string;
  bridgeId: string;
  bridgeName: string;
  name: string | null;
  manufacturer: string | null;
  model: string | null;
  ip: string | null;
  lastSeenAt: string;
};
export const listDiscovered = (): Promise<DiscoveredCamera[]> => api("/discovered");
// Усыновление: юзер вводит только логин/пароль камеры; RTSP резолвит агент через ONVIF.
export const adoptDiscovered = (
  id: string,
  opts: { name?: string; username: string; password: string }
): Promise<{ id: string; name: string; path: string }> =>
  api(`/discovered/${id}/adopt`, { method: "POST", body: JSON.stringify(opts) });
export const dismissDiscovered = (id: string) => api(`/discovered/${id}`, { method: "DELETE" });

// --- Админ ---
export type AdminCamera = { id: string; name: string; path: string; createdAt: string; ownerEmail: string | null };
export type AuditEntry = {
  at: string;
  actorRole: string;
  actorEmail: string | null;
  cameraPath: string;
  action: string;
  ip: string | null;
};
export const adminListCameras = (): Promise<AdminCamera[]> => api("/admin/cameras");
export const adminAudit = (): Promise<AuditEntry[]> => api("/admin/audit");

// --- Заготовка флоу подтверждения email / сброса пароля (стаб-эндпоинты, любой код) ---
export const stubSendCode = (email: string) =>
  api("/stub/send-code", { method: "POST", body: JSON.stringify({ email }) });
export const stubVerifyEmail = (email: string, code: string) =>
  api("/stub/verify-email", { method: "POST", body: JSON.stringify({ email, code }) });
export const stubResetPassword = (email: string, code: string, newPassword: string) =>
  api("/stub/reset-password", { method: "POST", body: JSON.stringify({ email, code, newPassword }) });

// --- Архив (MediaMTX playback-сервер, отдельный хост, Basic-auth view-токеном) ---
export type ArchiveSegment = { start: string; duration: number; url: string };

function basic(token: string) {
  return "Basic " + btoa("view:" + token);
}

export async function listArchive(path: string, token: string): Promise<ArchiveSegment[]> {
  const res = await fetch(`${ARCHIVE_BASE}/list?path=${encodeURIComponent(path)}`, {
    headers: { Authorization: basic(token) },
  });
  // Записей ещё нет → MediaMTX отдаёт 400/404 (директория /recordings/<path> не создана).
  // Это не ошибка, а пустой архив — UI покажет дружелюбное «Записей пока нет».
  if (res.status === 400 || res.status === 404) return [];
  if (!res.ok) throw new Error("Ошибка архива: " + res.status);
  return res.json();
}

// Скачивает кусок архива как mp4-blob (для проигрывания в <video>, auth заголовком).
export async function fetchArchiveClip(path: string, startISO: string, durationSec: number, token: string): Promise<string> {
  const url = `${ARCHIVE_BASE}/get?path=${encodeURIComponent(path)}&start=${encodeURIComponent(startISO)}&duration=${durationSec}&format=mp4`;
  const res = await fetch(url, { headers: { Authorization: basic(token) } });
  if (!res.ok) throw new Error("Ошибка воспроизведения: " + res.status);
  return URL.createObjectURL(await res.blob());
}
