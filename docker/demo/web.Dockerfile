# Web demo: build Vite rồi phục vụ bằng nginx. Build context = thư mục gốc repo.
FROM node:22-alpine AS build
RUN npm install -g pnpm@11.5.3
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter "@drmayday/web..."
# Chuỗi rỗng: Web gọi API cùng origin (/api/v1/...), nginx chuyển tiếp sang API.
ENV VITE_API_BASE_URL=""
RUN pnpm --filter @drmayday/shared build && pnpm --filter @drmayday/web build

FROM nginx:1.27-alpine
COPY docker/demo/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
