FROM oven/bun:1.3-alpine
WORKDIR /app

# Ставим зависимости по локфайлу — воспроизводимые версии.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Непривилегированный пользователь (образ oven/bun даёт готового 'bun').
USER bun

EXPOSE 9998
# Миграция идемпотентна — безопасно гонять на каждом старте на MVP.
CMD ["sh", "-c", "bun src/db/migrate.ts && bun src/index.ts"]
