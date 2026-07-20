# oko-cloud — видеоядро сервиса (этап 0)

MediaMTX в Docker: принимает RTSP-потоки камер, пишет архив на 7 суток со сроковым
автоудалением, отдаёт live (WebRTC/HLS) и архив по времени (Playback API).
Проверено на MediaMTX **v1.19.2** (тег запинен в compose — не менять на `latest`).

## Структура

```
docker-compose.yml      # сервис mediamtx: порты, env-секреты, volume записей
mediamtx/mediamtx.yml   # конфиг сервера (запись, ретенция, auth-каркас)
.env.example            # шаблон переменных — скопируй в .env локально
```

## Переменные окружения

| Переменная | Что это |
|---|---|
| `SERVER_HOST` | Публичный IP или домен сервера (для WebRTC-просмотра в браузере) |
| `PUBLISH_USER` / `PUBLISH_PASS` | Учётка для **публикации** потоков (бридж/ffmpeg/камера) |
| `VIEW_USER` / `VIEW_PASS` | Учётка для **просмотра** live и архива |

Права разведены: publisher не может смотреть, viewer не может публиковать —
проверено матрицей тестов (анонимный доступ всюду 401).

## Локальный запуск

```bash
cp .env.example .env      # и замени пароли
docker compose up -d
docker compose logs -f    # ждём: configuration loaded + listeners opened
```

## Деплой через Dokploy

1. Запушь эту папку как git-репозиторий, добавь его в Dokploy: **Create Service → Compose**.
2. Вкладка **Environment** — задай все 5 переменных из `.env.example` (в git их нет).
3. Deploy. Порты публикуются напрямую на хост (мимо Traefik): 8554, 8888, 8889, 8189/udp, 9996 —
   убедись, что они открыты в файрволе сервера. Домены/HTTPS через Traefik навесим на следующем этапе.

## Проверка (тестовый поток вместо камеры)

```bash
# Публикация: 30 секунд синтетики в путь cam1 (или rtsp-поток реальной камеры через -i)
ffmpeg -re -f lavfi -i "testsrc2=size=640x360:rate=15" -t 30 \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -f rtsp -rtsp_transport tcp "rtsp://PUBLISH_USER:PUBLISH_PASS@SERVER_HOST:8554/cam1"

# Live в браузере (спросит логин viewer):
#   http://SERVER_HOST:8889/cam1

# Список записанных отрезков архива:
curl -u VIEW_USER:VIEW_PASS "http://SERVER_HOST:9996/list?path=cam1"

# Скачать кусок архива (start — из ответа /list):
curl -u VIEW_USER:VIEW_PASS -o clip.mp4 \
  "http://SERVER_HOST:9996/get?path=cam1&start=2026-07-20T15%3A00%3A00Z&duration=60&format=mp4"
```

Когда появится реальная камера: тот же ffmpeg на устройстве в её локальной сети
(`-i "rtsp://user:pass@IP_КАМЕРЫ:554/..." -c copy`) — это ручной прототип бриджа.

## Как устроен конфиг (`mediamtx/mediamtx.yml`)

- `pathDefaults.record: yes` + `recordDeleteAfter: 168h` — та самая «бесплатная неделя»:
  пишем всё, сегменты старше 7 суток удаляются автоматически.
- `recordSegmentDuration: 15m` — размер одного файла архива; `fmp4` — играется браузером напрямую.
- `paths.all_others` — принимаем поток с любым именем (`cam1`, `cam2`, …); имя = путь в URL.
- `authInternalUsers` **обязан быть объявлен в файле**: без него действует дефолт MediaMTX
  с пользователем `any` — доступ без пароля. Логины/пароли заглушек перекрываются env
  (`MTX_AUTHINTERNALUSERS_0_USER` и т.д.); env-переопределение списков работает с версий новее 1.15.
- Порт 9997 (Control API) наружу не публикуется — для будущего ЛК изнутри docker-сети.

## Грабли, найденные при проверке

- `latest` нельзя: между 1.15 и 1.19 менялось поведение env-переопределений —
  на 1.15 секреты из env молча игнорируются и сервер остаётся открытым.
- JSON-строка в `MTX_AUTHINTERNALUSERS` не работает — только индексные переменные.
- RTSP-ingest пока без TLS: следующий этап — RTSPS или SRT-шифрование + домены через Traefik.

## Дальше

1. Домены + TLS (Traefik/RTSPS) · 2. Бридж-агент вместо ручного ffmpeg ·
3. ЛК поверх Control API (9997) + Playback API (9996) · 4. Мультитенантность (пользователь → камеры → пути).
