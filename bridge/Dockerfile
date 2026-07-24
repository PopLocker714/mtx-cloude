FROM oven/bun:1.3-alpine
WORKDIR /app

# ffmpeg — форвардинг RTSP; tini — reaper для дочерних ffmpeg; ca-certificates — доверенный
# CA-стор для верификации сертификата при rtsps-ингесте (-tls_verify 1). Явно, а не транзитивно
# от ffmpeg: чтобы TLS-верификация (защита от MITM) не сломалась молча при смене зависимостей.
RUN apk add --no-cache ffmpeg tini ca-certificates && update-ca-certificates

COPY package.json ./
COPY src ./src

# Состояние (bridge-токен) — в volume /data. Создаём каталог и отдаём его пользователю bun
# ДО объявления VOLUME/USER — иначе том монтируется под root и агент падает с EACCES при
# записи state.json (контейнер бежит под non-root bun).
RUN mkdir -p /data && chown bun:bun /data
VOLUME /data
USER bun

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["bun", "src/index.ts"]
