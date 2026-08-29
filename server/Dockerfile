# ─── Build stage ───────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
RUN npm ci --workspace server --include-workspace-root
COPY server ./server
RUN npm run prisma:generate --workspace server

# ─── Runtime stage ─────────────────────────────────────────
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server ./server
WORKDIR /app/server
EXPOSE 4000
# Apply any pending migrations, then start the API + schedulers.
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
