# --- сборка (Vite инлайнит VITE_* на этапе билда, поэтому это build ARG) ---
FROM oven/bun:1.3-alpine AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN bun run build

# --- рантайм: только собранный Nitro-сервер ---
FROM oven/bun:1.3-alpine
WORKDIR /app
COPY --from=build /app/.output ./.output
USER bun
ENV PORT=3000
EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]
