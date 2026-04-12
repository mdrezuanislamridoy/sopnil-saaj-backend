# ========================
# Stage 1 — Builder
# ========================
FROM node:20-alpine AS builder

WORKDIR /app

# Install system deps (Prisma মাঝে মাঝে লাগে)
RUN apk add --no-cache libc6-compat

# Copy only dependency files (better caching)
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy rest of the project
COPY . .

# Set env for prisma
ENV DATABASE_URL=postgresql://postgres:postgres@db:5432/app

# Generate Prisma client
RUN npx prisma generate

# Build NestJS app
RUN npm run build


# ========================
# Stage 2 — Production
# ========================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install minimal deps
RUN apk add --no-cache libc6-compat

# Copy necessary files from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Set env again (important)
ENV DATABASE_URL=postgresql://postgres:postgres@db:5432/app

# Ensure Prisma client exists in runtime
RUN npx prisma generate

EXPOSE 8080

CMD ["node", "dist/src/main.js"]