FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN addgroup -S nexus && adduser -S nexus -G nexus
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY package.json ./
RUN mkdir -p /data && chown nexus:nexus /data
USER nexus
EXPOSE 3700
ENV NODE_ENV=production DATA_DIR=/data
CMD ["node", "dist/index.js"]
