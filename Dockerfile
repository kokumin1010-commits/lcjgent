FROM node:22-slim
# Install build tools for native modules (bcrypt, sharp) and OpenSSL
RUN apt-get update && apt-get install -y python3 make g++ openssl ffmpeg && rm -rf /var/lib/apt/lists/*
# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
# Increase Node.js memory for large builds
ENV NODE_OPTIONS="--max-old-space-size=8192"
WORKDIR /app
# Copy package files AND patches
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
# Install all dependencies
RUN pnpm install --no-frozen-lockfile
# Copy source code
COPY . .
# Build the image without touching the production database. The required
# additive migration runs once the container starts, under an advisory lock.
RUN pnpm run build:compile
# Remove dev dependencies to reduce image size
RUN pnpm prune --prod
# Reset NODE_OPTIONS for production (don't need extra memory at runtime)
ENV NODE_OPTIONS=""
EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080
CMD ["sh", "-c", "node run-required-startup-migrations.mjs && node dist/index.js"]
