FROM oven/bun:1.3-alpine
WORKDIR /app

# ffmpeg — форвардинг RTSP; tini — корректный reaper для дочерних ffmpeg-процессов.
RUN apk add --no-cache ffmpeg tini

COPY package.json ./
COPY src ./src

# Состояние (bridge-токен) — в volume /data.
VOLUME /data
USER bun

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["bun", "src/index.ts"]
