import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth, enabledSocialProviders } from "./auth";
import { ensureAdmin, ensureBridgeKey } from "./bootstrap";
import { purgeExpiredOtp } from "./otp";
import { mediamtxAuth } from "./routes/mediamtx-auth";
import { api } from "./routes/api";
import { bridgeApi } from "./routes/bridge";
import { stubAuth } from "./routes/stub-auth";
import { telegramWebhook } from "./routes/telegram-webhook";
import { install, installShort } from "./routes/install";
import { startReconcile } from "./reconcile";

// Бутстрап при старте: админ из env + fail-closed проверка ключа шифрования creds.
await ensureAdmin();
await ensureBridgeKey();
await purgeExpiredOtp(); // протухшие коды подтверждения не копим

// Цикл записи/событий по движению (Этап 3): гейт записи MediaMTX + закрытие событий.
startReconcile();

const app = new Hono();

// CORS для ЛК на другом поддомене: явный whitelist origin из env, credentials:true.
// Никогда не "*" с credentials — это дыра. Список берём из TRUSTED_ORIGINS.
const allowedOrigins = (process.env.TRUSTED_ORIGINS || "http://localhost:5173").split(",").map((s) => s.trim());
app.use(
  "/api/*",
  cors({
    origin: (origin) => (origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]),
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })
);

// Единый обработчик ошибок — не отдаём стек/детали наружу (L-6).
app.onError((err, c) => {
  console.error("unhandled:", err);
  return c.json({ error: "internal error" }, 500);
});

app.get("/health", (c) => c.json({ ok: true, service: "oko-cloud-backend" }));

// Какие соцвходы настроены на этом сервере — страница входа рисует ровно их.
// Публичный и безопасный ответ: только имена, без ключей.
app.get("/api/auth-providers", (c) => c.json({ providers: enabledSocialProviders() }));

// Публичный установщик bridge одной командой: curl -fsSL <api>/install.sh | OKO_PAIR_CODE=… sh
app.route("/install.sh", install);

// Короткая форма той же установки с уже вшитым кодом: curl -fsSL <api>/i/AB12CD34 | sh
app.route("/i", installShort);

// Better Auth: регистрация/логин/сессии на /api/auth/** (sign-up/email, sign-in/email, ...).
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// Внешний авторизатор MediaMTX (только из docker-сети, наружу не публикуется).
app.route("/internal/mediamtx-auth", mediamtxAuth);

// Публичный Telegram-webhook (без сессии) — монтируем ДО /api, путь специфичнее.
app.route("/api/telegram/webhook", telegramWebhook);

// API bridge-агента (Bearer okb_…) — монтируем ДО /api, путь более специфичный.
app.route("/api/bridge", bridgeApi);

// Доменный API (камеры, bridge-управление из ЛК, view-токены) — авторизация по BA-сессии.
app.route("/api", api);

// ЗАГОТОВКА флоу подтверждения email / сброса пароля (стаб, любой код). /api/stub/*.
app.route("/api/stub", stubAuth);

const port = Number(process.env.PORT || 9998);
console.log(`oko-cloud backend on :${port}`);

export default { port, fetch: app.fetch };
