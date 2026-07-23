import { AGENT_VERSION } from "./config";

// Клиент API oko-cloud. 401 на bridge-эндпоинтах = токен отозван → RevokedError (агент стирает state).
export class RevokedError extends Error {}

export type DesiredCamera = {
  cameraId: string;
  path: string;
  enabled: boolean;
  ingestUrl: string;
  sourceUrl: string;
};
export type CameraStatus = { cameraId: string; status: string };

export async function pair(apiBase: string, code: string): Promise<{ bridgeId: string; token: string }> {
  const r = await fetch(`${apiBase}/api/bridges/pair`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pairingCode: code }),
  });
  if (!r.ok) throw new Error(`pair failed: HTTP ${r.status}`);
  const j = (await r.json()) as { bridgeId: string; token: string };
  if (!j.token) throw new Error("pair: нет токена в ответе");
  return j;
}

export async function heartbeat(
  apiBase: string,
  token: string,
  cameras: CameraStatus[]
): Promise<{ intervalMs: number; cameras: DesiredCamera[] }> {
  const r = await fetch(`${apiBase}/api/bridge/heartbeat`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ agentVersion: AGENT_VERSION, cameras }),
  });
  if (r.status === 401) throw new RevokedError("bridge токен отозван (401)");
  if (!r.ok) throw new Error(`heartbeat: HTTP ${r.status}`);
  const j = (await r.json()) as { intervalMs?: number; cameras?: DesiredCamera[] };
  if (!Array.isArray(j.cameras)) throw new Error("heartbeat: некорректный desired-state");
  return { intervalMs: j.intervalMs || 30_000, cameras: j.cameras };
}
