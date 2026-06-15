FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma/ prisma/
RUN npx prisma generate

FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache clamav-daemon curl

COPY --from=builder /app/node_modules node_modules/
COPY package.json ./
COPY prisma/ prisma/
COPY src/ src/

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 4000

CMD ["node", "src/server.js"]
