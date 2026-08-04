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

function serve(c: any, body: string) {
  c.header("content-type", "text/x-shellscript; charset=utf-8");
  c.header("cache-control", "no-cache");
  return c.body(body);
}

install.get("/", (c) => {
  if (!script) return c.text("# установщик временно недоступен\n", 500);
  return serve(c, script);
});

// Алфавит pairing-кода из lib.ts: ABCDEFGHJKLMNPQRSTUVWXYZ23456789 (без I и O — их путают).
// Код попадает ВНУТРЬ тела shell-скрипта, поэтому проверка формата здесь — граница безопасности,
// а не удобство: всё, что не подошло под маску, до подстановки не доходит.
const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;

// Короткая форма установки: curl -fsSL <api>/i/AB12CD34 | sh
// Вдвое короче варианта с OKO_PAIR_CODE=… — важно, когда команду набирают руками
// на мини-ПК без буфера обмена. Код вшивается формой `: "${VAR:=…}"`, поэтому явная
// переменная окружения его по-прежнему перекрывает, и старый путь не ломается.
export const installShort = new Hono();

installShort.get("/:code", (c) => {
  if (!script) return c.text("# установщик временно недоступен\n", 500);
  const code = c.req.param("code");
  // В БД не ходим намеренно: иначе эндпоинт станет оракулом существования кода для перебора.
  if (!CODE_RE.test(code)) return c.notFound();
  const injected = script.replace("set -eu\n", `set -eu\n: "\${OKO_PAIR_CODE:=${code}}"\n`);
  return serve(c, injected);
});
