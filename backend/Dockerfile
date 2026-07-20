FROM oven/bun:1.3-alpine
WORKDIR /app

COPY package.json ./
RUN bun install

COPY . .

EXPOSE 9998
# Миграция идемпотентна — безопасно гонять на каждом старте на MVP.
CMD ["sh", "-c", "bun src/db/migrate.ts && bun src/index.ts"]
