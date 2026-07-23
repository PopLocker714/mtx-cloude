# Шифрование ингеста bridge→облако (RTSPS) — фикс H1

Раньше bridge публиковал поток открытым RTSP: `rtsp://pub:PUBLISHTOKEN@ingest.<домен>:8554/PATH`.
Видео и `publishToken` шли по интернету **в открытом виде**. Этот гайд переводит ингест на
**RTSPS (RTSP-over-TLS)** — шифрование + аутентификация сервера (защита от пассивного
прослушивания И активного MITM).

Код уже готов и опт-ин: `INGEST_SCHEME=rtsps` на backend + `-tls_verify 1` на агенте.
Осталось серверная терминация TLS + сертификат. Ниже два пути.

> ⚠️ **Сначала подтверди gating-вопрос:** что такое `ingest.tunnel.poploker.ru` физически —
> прямой A-record на хост Dokploy или туннель-провайдер (Cloudflare Tunnel/frp), который САМ
> терминирует TLS? Wildcard-A + «Dokploy сам выпускает SSL» указывают на прямой A-record — тогда
> оба пути ниже применимы. Если это внешний туннель с собственным TLS — сначала выясни, как он
> проксирует сырой TCP/TLS (не HTTP), это меняет схему.

Всё техническое ниже **проверено эмпирически** (MediaMTX 1.19.2, ffmpeg host 8.1.1 + alpine-6):
ffmpeg публикует по rtsps; `rtspEncryption: optional` слушает 8554+8322 одновременно;
верифицированный TLS публикует, недоверенный отвергается; `publishToken` проходит через
auth-hook по зашифрованному транспорту (верный→200, неверный→401).

---

## Путь A — терминация TLS на Traefik (РЕКОМЕНДУЕТСЯ для старта)

Traefik расшифровывает TLS своим Let's Encrypt-сертификатом (переиспользуя уже работающее
ACME-автопродление Dokploy) и форвардит plaintext RTSP на `mediamtx:8554` во внутренней docker-сети.
**Плюс:** ноль возни с сертификатом внутри MediaMTX, ноль риска «тихого протухания серта на 90-й
день» (hot-reload серта MediaMTX 1.19.2 не подтверждён). MediaMTX-конфиг НЕ меняется.

1. **Entrypoint** в `/etc/dokploy/traefik/traefik.yml`:
   ```yaml
   entryPoints:
     rtsps-ingest: { address: ":8322" }   # отдельный entrypoint (НЕ на :80/:443 — иначе съест ACME-challenge)
   ```
   Опубликовать `:8322` на контейнере `dokploy-traefik`, перезапустить Traefik.
2. **TCP-роутер** (dynamic `/etc/dokploy/traefik/dynamic/ingest.yml`):
   ```yaml
   tcp:
     routers:
       rtsp-ingest:
         entryPoints: [rtsps-ingest]
         rule: "HostSNI(`ingest.tunnel.poploker.ru`)"   # ffmpeg шлёт SNI из rtsps-URL
         tls: { certResolver: letsencrypt }             # termination; certResolver = ваш из Dokploy
         service: rtsp-ingest
     services:
       rtsp-ingest:
         loadBalancer:
           servers: [{ address: "mediamtx:8554" }]
   ```
3. backend env: `INGEST_SCHEME=rtsps`, `INGEST_HOST=ingest.tunnel.poploker.ru:8322`.
4. **Проверка серта:**
   ```
   openssl s_client -connect ingest.tunnel.poploker.ru:8322 -servername ingest.tunnel.poploker.ru \
     </dev/null | openssl x509 -noout -issuer -subject -dates
   ```
   Ожидать: issuer = Let's Encrypt, SAN = ingest-хост, валидные даты.

---

## Путь B — нативный RTSPS в MediaMTX (альтернатива)

MediaMTX сам терминирует TLS на :8322. **Плюс:** сохраняет «ingest в обход общего прокси», чистый
docker-compose. **Минус:** вы владеете доставкой и продлением серта в MediaMTX (+ зависимость от
hot-reload, которую надо проверить).

1. Сертификат для `ingest.<домен>` в `./certs/ingest.crt` + `ingest.key` (PEM). Например через
   `traefik-certs-dumper` из существующего `acme.json` Dokploy + reload-хук MediaMTX на renew.
2. `docker-compose.yml` (сервис mediamtx) — раскомментировать (уже заготовлено):
   ```yaml
   environment:
     MTX_RTSPENCRYPTION: "optional"   # 8554 (старые агенты) + 8322 (RTSPS) одновременно
     MTX_RTSPTRANSPORTS: "tcp"
     MTX_RTSPSADDRESS: ":8322"
     MTX_RTSPSERVERCERT: "/certs/ingest.crt"
     MTX_RTSPSERVERKEY: "/certs/ingest.key"
   volumes:
     - ./certs:/certs:ro
   ```
   Порт `8322:8322` уже в compose.
3. backend env: `INGEST_SCHEME=rtsps`, `INGEST_HOST=ingest.tunnel.poploker.ru:8322`.
4. После стабилизации — `MTX_RTSPENCRYPTION=strict` (только TLS), убрать публичный `8554:8554`.
5. **Проверить hot-reload:** заменить cert/key в volume на живом MediaMTX → `openssl s_client`
   показывает новые даты БЕЗ рестарта. Нет hot-reload → провод reload-on-renew (restart/SIGHUP).

---

## Фазовый выкат (без простоя парка)

Backend рассылает `ingestUrl` всем мостам на reconcile → флип `INGEST_SCHEME` переключает парк
разом. Поэтому сначала делаем мосты СПОСОБНЫМИ, потом флипаем backend:

- **Фаза 0** — сервер слушает оба (Traefik :8322 поднят / MediaMTX `optional`); публичный `8554` жив.
- **Фаза 1** — выкатить новый образ моста (уже с `ca-certificates` + TLS-aware forward.ts) на весь
  парк. Пока backend отдаёт `rtsp://`, мосты шлют plaintext на 8554 — обратная совместимость.
- **Фаза 2** — флип backend: `INGEST_SCHEME=rtsps`, `INGEST_HOST=…:8322`. Весь парк переходит на
  rtsps на следующем reconcile. Смотреть логи `forward.ts` + path-ready MediaMTX + 200 от auth-hook.
  **Откат:** вернуть env → парк откатывается на 8554 (пока порт открыт).
- **Фаза 3** — после soak: закрыть публичный `8554` (Traefik: 8554 остаётся только внутренним;
  нативный: `strict`). Требует, чтобы ВСЕ мосты были на новом образе и подтверждённо на rtsps.

## Верификация агента (в образе моста)

```
docker run --rm <bridge-image> sh -c 'ffmpeg -hide_banner -buildconf | grep -i openssl && \
  ls -l /etc/ssl/certs/ca-certificates.crt'
```
Ожидать: `--enable-openssl` + наличие CA-бандла. `-tls_verify` дефолтит в **0** — потому агент
ставит его явно в `1` (config.ts `ingestTlsVerify`); при своём CA — `OKO_INGEST_CA_FILE`.

## Модель угроз (итог)

- **Пассив** (видео + токен): закрыт TLS.
- **Активный MITM / кража токена / захват камеры**: закрыт — но ТОЛЬКО за счёт `-tls_verify 1` +
  валидный публичный cert + проверка hostname. Явный `tls_verify 1` — несущий элемент.
- **Остаточно:** хоп Traefik→MediaMTX plaintext (Путь A, внутри хоста — та же зона, что auth-hook);
  `publishToken` — bearer в URL (внутри TLS; стратегически → mTLS per-bridge, pairing уже есть);
  доступность зависит от продления серта (Путь A переиспользует проверенный renewer — плюс).
