#!/bin/sh
# oko-cloud — установка bridge-агента одной командой (нативный бинарник, БЕЗ Docker).
#
#   curl -fsSL https://api.tunnel.poploker.ru/install.sh | OKO_PAIR_CODE=КОД sh
#
# Что делает: скачивает бинарник под твою ОС/архитектуру, ставит ffmpeg, поднимает
# systemd-сервис с автозапуском и привязкой по коду. Docker не требуется.
#
# Переменные:
#   OKO_PAIR_CODE — одноразовый код привязки из личного кабинета (нужен на ПЕРВУЮ установку)
#   OKO_API       — адрес API oko-cloud (по умолчанию прод)
#   OKO_RELEASES  — база GitHub-релизов с бинарниками (по умолчанию репозиторий проекта)
set -eu

OKO_API="${OKO_API:-https://api.tunnel.poploker.ru}"
OKO_RELEASES="${OKO_RELEASES:-https://github.com/PopLocker714/oko-bridge/releases/latest/download}"
BIN=/usr/local/bin/oko-bridge
DATA=/var/lib/oko-bridge
UNIT=/etc/systemd/system/oko-bridge.service

info() { printf '\033[36m[oko]\033[0m %s\n' "$1"; }
die()  { printf '\033[31m[oko] ОШИБКА:\033[0m %s\n' "$1" >&2; exit 1; }

# root или sudo (нужен для установки бинарника, ffmpeg и systemd-юнита)
if [ "$(id -u)" -eq 0 ]; then ROOT=""; elif command -v sudo >/dev/null 2>&1; then ROOT="sudo"; else die "запусти от root или установи sudo"; fi

# ОС/архитектура → имя ассета
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
[ "$OS" = "linux" ] || die "установщик пока для Linux (мини-ПК/Raspberry Pi). Для Mac/Windows — запусти bridge через Docker (команда в личном кабинете)."
case "$(uname -m)" in
  x86_64|amd64) ARCH=x64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) die "неподдерживаемая архитектура: $(uname -m). Используй Docker-вариант из ЛК." ;;
esac
ASSET="oko-bridge-linux-${ARCH}"
info "система: linux ${ARCH}"

# Код привязки нужен на первую установку (пока нет сохранённого состояния)
if [ ! -f "$DATA/state.json" ] && [ -z "${OKO_PAIR_CODE:-}" ]; then
  die "нужен код привязки. Возьми его в ЛК (Bridge → «Добавить») и запусти:
    curl -fsSL ${OKO_API}/install.sh | OKO_PAIR_CODE=ТВОЙ_КОД sh"
fi

# ffmpeg (нужен bridge для форвардинга). Ставим системным пакетным менеджером.
if ! command -v ffmpeg >/dev/null 2>&1; then
  info "устанавливаю ffmpeg…"
  if   command -v apt-get >/dev/null 2>&1; then $ROOT apt-get update -qq && $ROOT apt-get install -y ffmpeg
  elif command -v dnf     >/dev/null 2>&1; then $ROOT dnf install -y ffmpeg
  elif command -v yum     >/dev/null 2>&1; then $ROOT yum install -y ffmpeg
  elif command -v apk     >/dev/null 2>&1; then $ROOT apk add --no-cache ffmpeg
  elif command -v pacman  >/dev/null 2>&1; then $ROOT pacman -Sy --noconfirm ffmpeg
  else die "не смог поставить ffmpeg автоматически — установи его вручную и повтори"; fi
fi
command -v ffmpeg >/dev/null 2>&1 || die "ffmpeg не установился (на RHEL/CentOS может понадобиться репозиторий RPMFusion)"

# Скачиваем бинарник
info "скачиваю bridge (${ASSET})…"
TMP="$(mktemp)"
curl -fsSL "${OKO_RELEASES}/${ASSET}" -o "$TMP" || die "не удалось скачать бинарник (${OKO_RELEASES}/${ASSET}). Релиз опубликован и доступен публично?"

# Проверка целостности: сверяем SHA256 с SHA256SUMS.txt из релиза. Ловит порчу/обрыв закачки
# (важно для root-установки через curl|sh). Если файла сумм нет (старый релиз) — не блокируем.
SUMS="$(mktemp)"
if curl -fsSL "${OKO_RELEASES}/SHA256SUMS.txt" -o "$SUMS" 2>/dev/null; then
  EXPECT="$(grep -E "[[:space:]]${ASSET}\$" "$SUMS" | awk '{print $1}' | head -1)"
  if [ -n "$EXPECT" ]; then
    ACTUAL="$( (sha256sum "$TMP" 2>/dev/null || shasum -a 256 "$TMP") | awk '{print $1}')"
    [ "$EXPECT" = "$ACTUAL" ] || die "контрольная сумма не совпала — прерываю (ожидалось $EXPECT, получено $ACTUAL)"
    info "контрольная сумма ок"
  fi
fi
rm -f "$SUMS"

$ROOT install -m 0755 "$TMP" "$BIN"
rm -f "$TMP"
$ROOT mkdir -p "$DATA"

# systemd-сервис (автозапуск + перезапуск при сбое/ребуте)
command -v systemctl >/dev/null 2>&1 || die "нет systemd. Запусти вручную: OKO_API=$OKO_API OKO_DATA_DIR=$DATA OKO_PAIR_CODE=... $BIN"
info "настраиваю сервис oko-bridge…"
$ROOT tee "$UNIT" >/dev/null <<UNIT
[Unit]
Description=oko-cloud bridge
After=network-online.target
Wants=network-online.target

[Service]
Environment=OKO_API=${OKO_API}
Environment=OKO_DATA_DIR=${DATA}
${OKO_PAIR_CODE:+Environment=OKO_PAIR_CODE=${OKO_PAIR_CODE}}
ExecStart=${BIN}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
$ROOT systemctl daemon-reload
$ROOT systemctl enable --now oko-bridge >/dev/null 2>&1 || $ROOT systemctl restart oko-bridge

sleep 3
if $ROOT systemctl is-active --quiet oko-bridge; then
  info "✓ bridge установлен и запущен (systemd)."
  info "  Логи:      journalctl -u oko-bridge -f"
  info "  Статус:    systemctl status oko-bridge"
  info "  Дальше:    личный кабинет → «Камеры» → «Найдена камера» → «Подключить»"
  info "             (логин обычно admin, пароль часто пустой — см. «Как подключить камеру»)"
else
  die "сервис не запустился. Диагностика: journalctl -u oko-bridge -n 50 --no-pager"
fi
