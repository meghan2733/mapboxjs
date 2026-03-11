# Multi-stage build for Vite + React app
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Stage 2: Runtime
FROM nginx:alpine

# Copy nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Generate runtime config for the frontend from container env vars.
COPY docker-entrypoint.d/40-generate-env-js.sh /docker-entrypoint.d/40-generate-env-js.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-generate-env-js.sh \
  && chmod +x /docker-entrypoint.d/40-generate-env-js.sh

# Copy built app from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
