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
