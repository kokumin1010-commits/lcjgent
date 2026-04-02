FROM node:22-slim AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY . .

# Build
RUN pnpm run build

# Production stage
FROM node:22-slim AS production

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile --prod

COPY --from=base /app/dist ./dist
COPY --from=base /app/client/dist ./client/dist
COPY --from=base /app/drizzle ./drizzle

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "dist/index.js"]
