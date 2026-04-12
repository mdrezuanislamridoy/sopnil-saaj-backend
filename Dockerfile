# ========================
# Stage 1 — Builder
# ========================
FROM node:20-alpine AS builder

WORKDIR /app

# প্রয়োজনীয় system lib (Prisma এর জন্য safe)
RUN apk add --no-cache libc6-compat

# Dependency files copy (cache optimization)
COPY package.json package-lock.json ./

# Install ALL deps (dev + prod লাগে build এর জন্য)
RUN npm install

# Project files copy
COPY . .

# Prisma client generate (IMPORTANT)
RUN npx prisma generate

# Build NestJS app
RUN npm run build


# ========================
# Stage 2 — Production
# ========================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# minimal প্রয়োজনীয় lib
RUN apk add --no-cache libc6-compat

# Only required files copy
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# ⚠️ DATABASE URL (change in production)
ENV DATABASE_URL=postgresql://postgres:postgres@db:5432/app

EXPOSE 8080

# Start app
CMD ["node", "dist/src/main.js"]