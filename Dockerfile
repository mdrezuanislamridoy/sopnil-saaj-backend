FROM node:20-alpine

WORKDIR /app

# Prisma safe lib
RUN apk add --no-cache libc6-compat

# Copy dependency files
COPY package.json package-lock.json ./

# Install deps
RUN npm install

# 🔥 Copy EVERYTHING আগে (important fix)
COPY . .

# Generate Prisma client (এখন schema পাওয়া যাবে)
RUN npx prisma generate

# Build NestJS
RUN npm run build

ENV NODE_ENV=production

EXPOSE 8888

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]