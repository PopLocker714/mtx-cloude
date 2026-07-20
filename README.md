# oko-cloud — видеосервис (этап 1: мультитенантное ядро)

Стек из трёх сервисов в Docker:
- **mediamtx** (v1.19.2) — приём RTSP, запись 7 суток с автоудалением, live (WebRTC/HLS), архив (Playback API).
- **backend** (Bun + Hono + Postgres) — пользователи, камеры, токены и **внешний авторизатор MediaMTX**.
- **postgres** — данные.

Мультитенантность: MediaMTX на каждое действие спрашивает backend «кому можно на этот путь»
(`authMethod: http`), backend отвечает 200/401. Проверено сквозным тестом: юзер видит только свои
камеры, чужой получает 401 и на live, и на архив.

## Структура

```
docker-compose.yml       # 3 сервиса: postgres, backend, mediamtx
mediamtx/mediamtx.yml     # конфиг MediaMTX (запись, ретенция, http-auth)
backend/                  # Bun-приложение: API + auth-hook (backend/src)
.env.example              # шаблон переменных для Dokploy
PLAN.md                   # план реализации сервиса
```

## Переменные окружения

| Переменная | Что это |
|---|---|
| `SERVER_HOST` | Публичный IP или домен сервера (для WebRTC-просмотра в браузере) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Данные Postgres |
| `BETTER_AUTH_SECRET` | Секрет подписи сессий (`openssl rand -hex 32`) |
| `API_BASE_URL` | Базовый URL бэкенда (для Better Auth) |
| `TRUSTED_ORIGINS` | Разрешённые origin ЛК (через запятую) |

Учёток publisher/viewer в env больше НЕТ — доступом заведует backend:
- **публикация**: bridge шлёт RTSP с логином `pub` и паролем = `publishToken` камеры (API выдаёт его при регистрации камеры);
- **просмотр**: ЛК получает короткий view-токен (`POST /api/cameras/view-token`) и передаёт его плееру
  через **Basic-auth** (`Authorization: Basic base64(view:ТОКЕН)`).

  ⚠️ `?token=` в URL MediaMTX для playback/live НЕ распознаёт — только Basic-auth (`-u view:ТОКЕН`).

## API backend (кратко)

Авторизация — **Better Auth** (email+password, сессия в HttpOnly-куке `better-auth.session_token`;
готово к magic-link/OAuth-плагинам без переписывания).

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/api/auth/sign-up/email` | регистрация (name + email + пароль ≥8) — Better Auth |
| POST | `/api/auth/sign-in/email` | вход → сессия в куке — Better Auth |
| GET | `/api/auth/get-session` | текущая сессия — Better Auth |
| POST | `/api/bridges` | создать bridge → pairing-код |
| POST | `/api/bridges/pair` | bridge привязывается по коду → свой токен |
| POST | `/api/cameras` | зарегистрировать камеру → `path` + `publishToken` |
| GET | `/api/cameras` | список моих камер |
| POST | `/api/cameras/view-token` | короткий токен для плеера (все мои камеры или одна) |
| GET | `/api/admin/cameras` | админ: все камеры (просмотр пишется в `view_audit`) |
| POST | `/internal/mediamtx-auth` | внутренний auth-hook (только из docker-сети) |

## Локальный запуск

```bash
cp .env.example .env      # заполни POSTGRES_* и SERVER_HOST
docker compose up -d --build
docker compose logs -f backend    # ждём "migrate: ok" + "backend on :9998"
```

## Деплой через Dokploy

1. Запушь репозиторий, добавь в Dokploy: **Create Service → Compose**.
2. Вкладка **Environment** — задай `SERVER_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.
3. Deploy. Открой в файрволе порты MediaMTX: 8554, 8888, 8889, 8189/udp, 9996.
   Порты backend (9998) и postgres (5432) наружу НЕ публикуются — они только внутри стека.
4. Домены/HTTPS для API и ЛК навесим через Traefik на следующем шаге.

## Проверка (сквозной тест мультитенантности)

```bash
# 1) регистрируем юзера, заводим камеру (backend не опубликован — вызываем изнутри сети)
NET=oko-cloud_default
run(){ docker run --rm --network $NET curlimages/curl:latest -s "$@"; }
run -X POST http://backend:9998/api/register -H 'content-type: application/json' -d '{"email":"a@b.io","password":"password123"}'
TOKEN=$(run -X POST http://backend:9998/api/login -H 'content-type: application/json' -d '{"email":"a@b.io","password":"password123"}' | sed -E 's/.*"token":"([^"]+)".*/\1/')
CAM=$(run -X POST http://backend:9998/api/cameras -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"name":"Двор"}')
# CAM содержит path и publishToken

# 2) публикация (bridge/ffmpeg) — логин pub, пароль = publishToken
ffmpeg -re -f lavfi -i "testsrc2=size=640x360:rate=15" -t 20 -c:v libx264 -preset ultrafast \
  -f rtsp -rtsp_transport tcp "rtsp://pub:PUBLISH_TOKEN@SERVER_HOST:8554/PATH"

# 3) view-токен и просмотр архива через Basic-auth
VT=$(run -X POST http://backend:9998/api/cameras/view-token -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{}' | sed -E 's/.*"token":"([^"]+)".*/\1/')
curl -u "view:$VT" "http://SERVER_HOST:9996/list?path=PATH"          # список сегментов
# live в браузере: http://view:$VT@SERVER_HOST:8889/PATH
```

## Как устроен конфиг (`mediamtx/mediamtx.yml`)

- `pathDefaults.record: yes` + `recordDeleteAfter: 168h` — «бесплатная неделя»; сегменты старше 7 суток удаляются.
- `recordSegmentDuration: 15m`, формат `fmp4` — играется браузером напрямую.
- `authMethod: http` + env `MTX_AUTHHTTPADDRESS` → все действия авторизует backend. `authHTTPExclude: []` — без исключений.
- `paths.all_others` — принимаем поток с любым именем пути (имя пути = камера, выдаёт backend).
- Порты 9997 (Control API MediaMTX), 9998 (backend), 5432 (postgres) наружу не публикуются.

## Грабли, найденные при проверке

- Тег MediaMTX запинен (1.19.2). `latest` нельзя: между 1.15 и 1.19 менялось поведение конфига/авторизации.
- Playback/live креды — только Basic-auth (заголовок), `?token=` в query MediaMTX игнорирует.
- В http-auth режиме внутренние пользователи (`authInternalUsers`) не используются — всё решает hook.
- RTSP-ingest пока без TLS: следующий этап — RTSPS/SRT + домены через Traefik.

## Дальше (по PLAN.md)

1. Домены + TLS (Traefik) для API и ЛК · 2. Bridge-агент (ONVIF-автообнаружение) вместо ручного ffmpeg ·
3. ЛК (React/Vite) поверх этого API · 4. P2P-камеры (включая камеру Ильи — см. knowledge).
