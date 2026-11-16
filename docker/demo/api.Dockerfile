# API demo. Build context = thư mục gốc repo.
#   target `build`   : đủ devDependencies, dùng cho job seed (prisma CLI, tsx)
#   target `runtime` : chỉ phụ thuộc production + dist, chạy `node dist/main`
FROM node:22-alpine AS build
RUN npm install -g pnpm@11.5.3
WORKDIR /app
COPY . .
# postinstall của @drmayday/api chạy `prisma generate` (sinh client vào apps/api/src/generated).
RUN pnpm install --frozen-lockfile --filter "@drmayday/api..."
RUN pnpm --filter @drmayday/shared build && pnpm --filter @drmayday/api build
# Gói riêng apps/api + phụ thuộc production (kèm @drmayday/shared đã build) vào /out.
RUN pnpm --filter @drmayday/api deploy --prod --legacy /out \
 && cp -r apps/api/dist /out/dist

FROM node:22-alpine AS runtime
WORKDIR /app
ENV APP_ENV=production PORT=3000
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist
COPY --from=build /out/package.json ./package.json
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
