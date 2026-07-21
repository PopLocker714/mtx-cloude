import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";
import { ensureAdmin } from "./bootstrap";
import { mediamtxAuth } from "./routes/mediamtx-auth";
import { api } from "./routes/api";

// Бутстрап админа из env при старте (create-or-promote).
await ensureAdmin();

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

// Better Auth: регистрация/логин/сессии на /api/auth/** (sign-up/email, sign-in/email, ...).
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// Внешний авторизатор MediaMTX (только из docker-сети, наружу не публикуется).
app.route("/internal/mediamtx-auth", mediamtxAuth);

// Доменный API (камеры, bridge, view-токены) — авторизация по BA-сессии.
app.route("/api", api);

const port = Number(process.env.PORT || 9998);
console.log(`oko-cloud backend on :${port}`);

export default { port, fetch: app.fetch };
