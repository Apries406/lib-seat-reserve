FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.27.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/seat-api/package.json ./apps/seat-api/package.json

RUN pnpm install --frozen-lockfile

COPY apps/seat-api ./apps/seat-api
RUN pnpm --filter seat-api build

FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@10.27.0 --activate

WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/seat-api/package.json ./apps/seat-api/package.json

RUN pnpm install --frozen-lockfile --prod && pnpm store prune

COPY --from=builder /app/apps/seat-api/dist ./apps/seat-api/dist

EXPOSE 3000

CMD ["node", "apps/seat-api/dist/main"]
