# Шифрование ингеста bridge→облако (RTSPS) — фикс H1

Раньше bridge публиковал поток открытым RTSP: `rtsp://pub:PUBLISHTOKEN@ingest.<домен>:8554/PATH`.
Видео и `publishToken` шли по интернету **в открытом виде**. Этот гайд переводит ингест на
**RTSPS (RTSP-over-TLS)** — шифрование + аутентификация сервера (защита от пассивного
прослушивания И активного MITM).

Код уже готов и опт-ин: `INGEST_SCHEME=rtsps` на backend + `-tls_verify 1` на агенте
(+ `ca-certificates` в образе моста). Осталось серверная терминация TLS + сертификат.

> ✅ **Сетап подтверждён (poploker.ru):** DNS через Cloudflare, запись
> `*.tunnel.poploker.ru A 203.31.40.13` в режиме **DNS only** (серое облако — Cloudflare НЕ
> проксирует). Трафик идёт НАПРЯМУЮ на хост 203.31.40.13, внешней TLS-терминации в пути нет,
> порт 8322 достижим снаружи. Cloudflare здесь — только DNS (+ API для DNS-01 валидации серта).

**Рекомендация для этого сетапа — Путь B** (нативный RTSPS + acme.sh DNS-01 через Cloudflare):
self-contained в docker-compose, НЕ требует ручной хирургии над HTTP-ориентированным Traefik
Dokploy (кастомный TCP-роутер), использует твой Cloudflare API. Главное — **hot-reload серта
в MediaMTX 1.19.2 подтверждён эмпирически** (подмена cert-файла на месте → новый cert без рестарта),
поэтому авто-продление НЕ требует рестарта и риск «тихого протухания на 90-й день» снят.

Всё техническое ниже **проверено эмпирически** (MediaMTX 1.19.2, ffmpeg host 8.1.1 + alpine-6):
ffmpeg публикует по rtsps; `rtspEncryption: optional` слушает 8554+8322 одновременно;
верифицированный TLS публикует, недоверенный отвергается; `publishToken` проходит через auth-hook
по зашифрованному транспорту (верный→200, неверный→401); hot-reload серта работает.

---

## Путь B — нативный RTSPS + acme.sh DNS-01 (Cloudflare) — РЕКОМЕНДУЕТСЯ

MediaMTX сам терминирует TLS на :8322 реальным Let's Encrypt-сертификатом. acme.sh получает и
авто-продлевает cert через DNS-01 (Cloudflare API), кладёт в общий volume; MediaMTX подхватывает
обновление без рестарта (hot-reload).

### 1. Cloudflare API-токен

Создай в Cloudflare API-токен со scope **Zone:DNS:Edit + Zone:Read** для зоны `poploker.ru`.
В Dokploy env: `CF_DNS_API_TOKEN=<токен>`.

### 2. docker-compose — сервис выпуска серта + включение RTSPS

Добавить сервис `acme` и общий volume; в `mediamtx` включить RTSPS-env + смонтировать серты:

```yaml
services:
  acme:
    image: neilpang/acme.sh:latest
    restart: unless-stopped
    environment:
      CF_Token: "${CF_DNS_API_TOKEN}"      # Cloudflare API token (Zone:DNS:Edit + Zone:Read)
    volumes:
      - ingest-certs:/certs                # сюда acme.sh кладёт ingest.crt/ingest.key
      - acme-data:/acme.sh                 # состояние acme.sh (аккаунт, серты, cron)
    command: daemon                        # cron авто-продления внутри контейнера

  mediamtx:
    # ... существующее ...
    environment:
      # ... существующее (MTX_WEBRTCADDITIONALHOSTS, MTX_AUTHHTTPADDRESS) ...
      MTX_RTSPENCRYPTION: "optional"       # переход: слушает и :8554 (старые агенты), и :8322 (RTSPS)
      MTX_RTSPTRANSPORTS: "tcp"
      MTX_RTSPSADDRESS: ":8322"
      MTX_RTSPSERVERCERT: "/certs/ingest.crt"
      MTX_RTSPSERVERKEY: "/certs/ingest.key"
    volumes:
      - ./mediamtx/mediamtx.yml:/mediamtx.yml:ro
      - recordings:/recordings
      - ingest-certs:/certs:ro             # читает cert, положенный acme.sh

volumes:
  recordings:
  pgdata:
  ingest-certs:
  acme-data:
```
Порт `8322:8322` уже опубликован в docker-compose.

### 3. Первый выпуск сертификата (один раз)

```bash
# зарегистрировать аккаунт (один раз)
docker compose exec acme --register-account -m you@example.com --server letsencrypt
# выпустить cert через DNS-01 (Cloudflare) и УСТАНОВИТЬ в volume (пути запоминаются для авто-renew)
docker compose exec acme --issue --dns dns_cf -d ingest.tunnel.poploker.ru --server letsencrypt \
  --key-file /certs/ingest.key --fullchain-file /certs/ingest.crt
docker compose restart mediamtx     # первый раз — чтобы MediaMTX увидел появившийся cert
```
Дальше acme.sh (`daemon`) продлевает сам; при renew переустанавливает в `/certs` те же файлы →
MediaMTX подхватывает без рестарта. `--reloadcmd` не нужен (hot-reload).

### 4. backend

Dokploy env: `INGEST_SCHEME=rtsps`, `INGEST_HOST=ingest.tunnel.poploker.ru:8322`.

### 5. Проверка

```bash
openssl s_client -connect ingest.tunnel.poploker.ru:8322 -servername ingest.tunnel.poploker.ru \
  </dev/null | openssl x509 -noout -issuer -subject -dates
```
Ожидать: issuer = Let's Encrypt, subject/SAN = ingest-хост, валидные даты.
После стабилизации: `MTX_RTSPENCRYPTION=strict` + убрать публичный `8554:8554`.

---

## Путь A — терминация TLS на Traefik (альтернатива)

Traefik расшифровывает TLS своим LE-сертификатом и форвардит plaintext RTSP на `mediamtx:8554`.
MediaMTX-конфиг не меняется. Минус для Dokploy: требует ручной правки Traefik (кастомный TCP-роутер
+ entrypoint), т.к. UI Dokploy — только для HTTP-приложений.

1. Entrypoint `:8322` в `/etc/dokploy/traefik/traefik.yml` (отдельный, НЕ на :80/:443 — иначе съест ACME-challenge).
2. TCP-роутер (dynamic `/etc/dokploy/traefik/dynamic/ingest.yml`):
   ```yaml
   tcp:
     routers:
       rtsp-ingest:
         entryPoints: [rtsps-ingest]
         rule: "HostSNI(`ingest.tunnel.poploker.ru`)"   # ffmpeg шлёт SNI из rtsps-URL
         tls: { certResolver: letsencrypt }             # termination; resolver = ваш из Dokploy
         service: rtsp-ingest
     services:
       rtsp-ingest:
         loadBalancer: { servers: [{ address: "mediamtx:8554" }] }
   ```
3. backend env: `INGEST_SCHEME=rtsps`, `INGEST_HOST=…:8322`. MediaMTX остаётся plaintext внутри сети.

---

## Фазовый выкат (без простоя парка)

Backend рассылает `ingestUrl` всем мостам на reconcile → флип `INGEST_SCHEME` переключает парк разом.
Сначала делаем мосты СПОСОБНЫМИ, потом флипаем backend:

- **Фаза 0** — сервер слушает оба (MediaMTX `optional`: 8554 + 8322), публичный 8554 жив.
- **Фаза 1** — выкатить новый образ моста (с `ca-certificates` + TLS-aware forward.ts) на весь парк.
  Пока backend отдаёт `rtsp://`, мосты шлют plaintext на 8554 — обратная совместимость.
- **Фаза 2** — флип backend: `INGEST_SCHEME=rtsps`, `INGEST_HOST=…:8322`. Парк переходит на rtsps на
  следующем reconcile. Смотреть логи `forward.ts` + path-ready MediaMTX + 200 auth-hook.
  **Откат:** вернуть env → парк откатывается на 8554 (пока порт открыт).
- **Фаза 3** — после soak: `MTX_RTSPENCRYPTION=strict`, убрать публичный `8554:8554`. Требует, чтобы
  ВСЕ мосты были на новом образе и подтверждённо на rtsps.

## Модель угроз (итог)

- **Пассив** (видео + токен): закрыт TLS.
- **Активный MITM / кража токена / захват камеры**: закрыт — ТОЛЬКО за счёт `-tls_verify 1` +
  валидный публичный LE-cert + проверка hostname. Явный `tls_verify 1` (дефолт ffmpeg = 0!) — несущий.
- **Остаточно:** `publishToken` — bearer в URL (теперь всегда внутри TLS; стратегически → mTLS
  per-bridge, pairing уже есть); доступность зависит от продления серта (acme.sh + hot-reload —
  авто, без рестарта). Компрометация хоста моста — вне зоны транспортного шифрования.
