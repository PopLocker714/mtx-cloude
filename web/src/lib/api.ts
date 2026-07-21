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

export type Camera = { id: string; name: string; path: string; createdAt: string };
export type CameraConnection = {
  id: string;
  name: string;
  path: string;
  publishToken: string;
  ingestUrl: string;
};

export const listCameras = (): Promise<Camera[]> => api("/cameras");
export const createCamera = (name: string): Promise<CameraConnection> =>
  api("/cameras", { method: "POST", body: JSON.stringify({ name }) });
export const getConnection = (id: string): Promise<CameraConnection> =>
  api(`/cameras/${id}/connection`);
export const createViewToken = (cameraId?: string): Promise<{ token: string; ttlMs: number }> =>
  api("/cameras/view-token", { method: "POST", body: JSON.stringify(cameraId ? { cameraId } : {}) });

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

// --- Архив (MediaMTX playback-сервер, отдельный хост, Basic-auth view-токеном) ---
export type ArchiveSegment = { start: string; duration: number; url: string };

function basic(token: string) {
  return "Basic " + btoa("view:" + token);
}

export async function listArchive(path: string, token: string): Promise<ArchiveSegment[]> {
  const res = await fetch(`${ARCHIVE_BASE}/list?path=${encodeURIComponent(path)}`, {
    headers: { Authorization: basic(token) },
  });
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
