# syntax=docker/dockerfile:1
# ---------- base: pnpm kurulu Node imajı ----------
# slim (glibc) seçildi: bcrypt gibi yerel modüllerin hazır derlenmiş dosyaları sorunsuz yüklenir
FROM node:24-slim AS base
RUN npm install -g pnpm@12.10.1
WORKDIR /app

# ---------- build: tüm bağımlılıklarla TypeScript'i derle ----------
FROM base AS build
# Önce yalnız manifest dosyaları: kaynak değişince bağımlılık katmanı yeniden kurulmaz
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# .d.ts dosyaları çalışma zamanında gerekmez; son imajda .ts uzantılı dosya kalmasın
RUN pnpm build && find dist -name '*.d.ts' -delete

# ---------- prod-deps: yalnız üretim bağımlılıkları ----------
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ---------- runtime: derlenmiş kod + üretim bağımlılıkları ----------
FROM node:24-slim AS runtime
ENV NODE_ENV=production \
    NODE_OPTIONS=--enable-source-maps
WORKDIR /app
# Dosyalar root'a ait kalır (salt okunur); uygulama ayrıcalıksız "node" kullanıcısıyla çalışır
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 4001
CMD ["node", "dist/main.js"]
