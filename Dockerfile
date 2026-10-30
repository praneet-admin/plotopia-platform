# Single-server deploy (Render, Fly, Railway, a VPS): SQLite file on a persistent
# volume mounted at /app/data. For Vercel use Turso instead (see README).
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production DATABASE_URL=file:/app/data/show.db PORT=3000
COPY --from=build /app ./
VOLUME ["/app/data"]
EXPOSE 3000
# First boot creates the schema and seeds demo data if the database is empty.
CMD sh -c "npx drizzle-kit push --force >/dev/null 2>&1; [ -f /app/data/.seeded ] || (npx tsx scripts/seed.ts && touch /app/data/.seeded); npm start -- --port $PORT"
