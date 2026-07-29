# Use Node.js 22 LTS slim
FROM node:22-slim AS builder

WORKDIR /app

# Install dependencies needed for compiling sqlite or native extensions
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runner stage
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy standalone build outputs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Ensure local data mount points exist
RUN mkdir -p /app/data/storage

EXPOSE 3000

CMD ["node", "server.js"]
