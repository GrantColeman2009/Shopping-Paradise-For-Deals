# node:sqlite (Node 24 built-in) — no native build step needed.
FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
# Seed on every boot (seed.js skips when data already exists), then start.
CMD ["sh", "-c", "node seed.js && node server.js"]
