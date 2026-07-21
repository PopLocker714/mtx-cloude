// Базовый адрес API. Приоритет: build-time VITE_API_URL (если вшит),
// иначе выводим из текущего хоста: app.<домен> → api.<домен>.
// Так фронт работает даже если Dokploy не передал VITE_API_URL в build-arg.
export const API_BASE: string = (() => {
  const env = import.meta.env.VITE_API_URL as string | undefined;
  if (env) return env;
  if (typeof window !== "undefined") {
    const { protocol, host } = window.location;
    if (host.startsWith("app.")) return `${protocol}//api.${host.slice(4)}`;
    // dev: app на :3000 → api на :9998
    if (host.startsWith("localhost")) return `${protocol}//localhost:9998`;
  }
  return "";
})();

// Медиа-хосты выводим из API-хоста: api.<домен> → hls./archive./live.<домен>.
// В dev (localhost) — на портах MediaMTX.
function siblingHost(sub: string, devPort: number): string {
  try {
    const u = new URL(API_BASE);
    if (u.host.startsWith("api.")) return `${u.protocol}//${sub}.${u.host.slice(4)}`;
    if (u.hostname === "localhost") return `${u.protocol}//localhost:${devPort}`;
  } catch {
    /* API_BASE пуст на SSR — на клиенте пересчитается */
  }
  return "";
}

export const HLS_BASE = siblingHost("hls", 8888);
export const ARCHIVE_BASE = siblingHost("archive", 9996);
export const LIVE_BASE = siblingHost("live", 8889);
