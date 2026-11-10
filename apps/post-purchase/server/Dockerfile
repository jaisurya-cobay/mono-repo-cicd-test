# Build context = repo root. Only this app and the workspace packages it uses are copied,
# so a client-only change never invalidates these layers.
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared-contracts packages/shared-contracts
COPY apps/post-purchase/server apps/post-purchase/server
RUN pnpm --filter @lab/post-purchase-server deploy --prod --legacy /out

FROM node:24-alpine
WORKDIR /app
COPY --from=build /out .
USER node
EXPOSE 3000
CMD ["node", "src/index.js"]
