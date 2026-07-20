import { API_BASE as BASE } from "./api-base";

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

export const listCameras = (): Promise<Camera[]> => api("/cameras");
export const createCamera = (name: string): Promise<Camera> =>
  api("/cameras", { method: "POST", body: JSON.stringify({ name }) });
export const createViewToken = (cameraId?: string): Promise<{ token: string; ttlMs: number }> =>
  api("/cameras/view-token", { method: "POST", body: JSON.stringify(cameraId ? { cameraId } : {}) });
