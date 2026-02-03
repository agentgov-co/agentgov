FROM node:22-alpine AS base

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/sdk/package.json packages/sdk/
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Generate Prisma client and build
RUN pnpm build:api

EXPOSE 3001

WORKDIR /app/apps/api
CMD ["node", "dist/index.js"]
