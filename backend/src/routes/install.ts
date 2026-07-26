import { Hono } from "hono";

// Публичный установщик bridge: GET /install.sh отдаёт скрипт (backend/install.sh).
// Скрипт лежит в корне backend/ и попадает в образ через COPY . . — читаем один раз при старте.
export const install = new Hono();

let script = "";
try {
  script = await Bun.file(new URL("../../install.sh", import.meta.url)).text();
} catch (e) {
  console.error("install.sh не найден:", (e as Error).message);
}

install.get("/", (c) => {
  if (!script) return c.text("# установщик временно недоступен\n", 500);
  c.header("content-type", "text/x-shellscript; charset=utf-8");
  c.header("cache-control", "no-cache");
  return c.body(script);
});
