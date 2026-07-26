#!/bin/sh
# oko-cloud — установка bridge-агента одной командой.
#
#   curl -fsSL https://api.tunnel.poploker.ru/install.sh | OKO_PAIR_CODE=КОД sh
#
# Переменные окружения:
#   OKO_PAIR_CODE — одноразовый код привязки из личного кабинета (нужен на ПЕРВУЮ установку)
#   OKO_API       — адрес API oko-cloud (по умолчанию прод)
#   OKO_IMAGE     — образ bridge (по умолчанию из GHCR)
set -eu

OKO_API="${OKO_API:-https://api.tunnel.poploker.ru}"
OKO_IMAGE="${OKO_IMAGE:-ghcr.io/poplocker714/oko-bridge:latest}"
NAME=oko-bridge

info() { printf '\033[36m[oko]\033[0m %s\n' "$1"; }
die()  { printf '\033[31m[oko] ОШИБКА:\033[0m %s\n' "$1" >&2; exit 1; }

# Нужен root (для установки Docker и запуска контейнера) — иначе sudo.
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then SUDO=sudo; else die "запусти от root или установи sudo"; fi
else
  SUDO=""
fi

info "система: $(uname -s) $(uname -m)"

# Docker: ставим официальным скриптом, если нет.
if ! command -v docker >/dev/null 2>&1; then
  info "Docker не найден — устанавливаю (get.docker.com)…"
  curl -fsSL https://get.docker.com | $SUDO sh || die "не удалось установить Docker"
fi
if ! $SUDO docker info >/dev/null 2>&1; then
  info "запускаю Docker…"
  $SUDO systemctl enable --now docker >/dev/null 2>&1 || $SUDO service docker start >/dev/null 2>&1 || true
fi
$SUDO docker info >/dev/null 2>&1 || die "Docker не запущен — запусти его и повтори"

# Код привязки обязателен только на первую установку (пока нет сохранённого состояния в томе).
if ! $SUDO docker volume inspect oko-bridge-data >/dev/null 2>&1; then
  if [ -z "${OKO_PAIR_CODE:-}" ]; then
    die "нужен код привязки. Возьми его в личном кабинете (Bridge → «Добавить») и запусти:
    curl -fsSL ${OKO_API}/install.sh | OKO_PAIR_CODE=ТВОЙ_КОД sh"
  fi
fi

info "скачиваю образ ${OKO_IMAGE}…"
$SUDO docker pull "$OKO_IMAGE" || die "не удалось скачать образ"

$SUDO docker rm -f "$NAME" >/dev/null 2>&1 || true

info "запускаю bridge…"
# --network host нужен для ONVIF-автообнаружения (multicast). --restart переживает перезагрузку.
# shellcheck disable=SC2086
$SUDO docker run -d --name "$NAME" --restart unless-stopped --network host \
  -e OKO_API="$OKO_API" ${OKO_PAIR_CODE:+-e OKO_PAIR_CODE="$OKO_PAIR_CODE"} \
  -v oko-bridge-data:/data "$OKO_IMAGE" >/dev/null || die "контейнер не запустился"

sleep 3
if $SUDO docker ps --format '{{.Names}}' | grep -q "^${NAME}$"; then
  info "✓ bridge установлен и запущен."
  info "  Логи:   docker logs -f $NAME"
  info "  Дальше: личный кабинет → «Камеры» → «Найдена камера» → «Подключить»"
  info "          (логин обычно admin, пароль часто пустой — см. «Как подключить камеру»)"
else
  die "контейнер не поднялся. Диагностика: docker logs $NAME"
fi
