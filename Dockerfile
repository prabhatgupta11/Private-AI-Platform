# Use Node.js 22 LTS slim
FROM node:22-slim AS builder

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install packages
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Build the application
RUN npm run build

# Production image
FROM node:22-slim AS runner

WORKDIR /app

# Set production env
ENV NODE_ENV=production

# Copy built files and node_modules from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/worker ./worker
COPY --from=builder /app/.openai ./.openai

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]
