// Конфиг агента из env. На первом старте нужен OKO_API + OKO_PAIR_CODE (или уже сохранённый state).
export const AGENT_VERSION = "0.1.0";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`env ${name} обязателен`);
  return v;
}

export const config = {
  apiBase: (process.env.OKO_API || "").replace(/\/+$/, ""), // напр. https://api.tunnel.poploker.ru
  pairCode: process.env.OKO_PAIR_CODE || "",
  dataDir: process.env.OKO_DATA_DIR || "/data",
  heartbeatSec: Number(process.env.OKO_HEARTBEAT_SEC || 30),
  rtspTransport: process.env.OKO_RTSP_TRANSPORT || "tcp", // tcp надёжнее за NAT
  inputTimeoutSec: Number(process.env.OKO_INPUT_TIMEOUT_SEC || 15), // -rw_timeout: роняет ffmpeg на залипшем входе
  logLevel: process.env.OKO_LOG_LEVEL || "info",
};

export function requireApiBase(): string {
  if (!config.apiBase) throw new Error("env OKO_API обязателен (адрес API oko-cloud)");
  return config.apiBase;
}
export { req };
