# Multi-stage production build for TaskGenie API
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install dependencies first for optimized layer caching
COPY package*.json ./
RUN npm ci --only=production

# Production runtime stage (lean, non-root user)
FROM node:20-alpine AS runner

WORKDIR /usr/src/app
ENV NODE_ENV=production

# Security: Run as non-root user
USER node

# Copy dependencies and application source
COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node . .

EXPOSE 5000

# Health check matching Kubernetes/ECS container probes
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health/live || exit 1

CMD ["node", "index.js"]
