import { Hono } from "hono";
import { auth } from "./auth";
import { mediamtxAuth } from "./routes/mediamtx-auth";
import { api } from "./routes/api";

const app = new Hono();

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
