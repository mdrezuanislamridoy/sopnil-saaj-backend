FROM node:20-alpine

WORKDIR /app

# System dependency (Prisma safe)
RUN apk add --no-cache libc6-compat

# Copy dependency files (npm)
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy prisma schema আগে (important for generate cache)
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Copy rest of the project
COPY . .

# Build NestJS
RUN npm run build

# Production env
ENV NODE_ENV=production

EXPOSE 8888

# Run migration + start app
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]