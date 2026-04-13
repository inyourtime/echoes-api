# Stage 1: Build & Prune
FROM node:25-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Remove devDependencies and clean cache
RUN npm prune --omit=dev && npm cache clean --force

# Remove junk from production node_modules (docs, tests, maps)
RUN find node_modules -type f -name "*.md" -delete \
    && find node_modules -type f -name "*.ts" -delete \
    && find node_modules -type f -name "*.map" -delete \
    && rm -rf node_modules/**/test node_modules/**/docs

# Stage 2: Production
FROM node:25-alpine AS production
WORKDIR /app

# Copy only the pruned node_modules and the build folder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]