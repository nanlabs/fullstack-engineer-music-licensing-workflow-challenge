
FROM node:22.20.0-alpine3.21 AS dev-deps
WORKDIR /app
COPY package.json package.json
RUN npm install


FROM node:22.20.0-alpine3.21 AS builder
WORKDIR /app
COPY --from=dev-deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22.20.0-alpine3.21 AS prod-deps
WORKDIR /app
COPY package.json package.json
RUN npm install --prod


FROM node:22.20.0-alpine3.21 AS prod
EXPOSE 3000
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY scripts/entrypoint.sh .
RUN chmod +x ./entrypoint.sh

ENTRYPOINT [ "/app/entrypoint.sh" ]

CMD [ "node", "dist/main.js" ]