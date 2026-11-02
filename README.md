# Mini WFM

Mini WFM, ekiplerin ve personellerin yönetildiği başlangıç seviyesinde bir Workforce Management projesidir. Tek bir Git reposunda üç uygulama bulunur:

| Uygulama | Teknoloji | Görevi |
|---|---|---|
| `web` | React 19, Vite, Ant Design 5, TanStack Query | Tarayıcı arayüzü |
| `api` | NestJS (HTTP) | Dış dünyaya açık REST API, doğrulama, Swagger |
| `workforce-service` | NestJS (TCP microservice), TypeORM | İş kuralları ve veritabanı |

Veritabanı olarak Docker içinde PostgreSQL kullanılır.

## Mimari

```text
Tarayıcı (5173)
   │  /api/* istekleri Vite proxy ile 3000'e gider
   ▼
  api (HTTP 3000) ── TCP (4001) ──►  workforce-service ──►  PostgreSQL (5433)
  doğrulama, Swagger                 iş kuralları, TypeORM     Docker container
```

- **web** API'ye doğrudan değil `/api` önekiyle istek atar; Vite geliştirme sunucusu bu istekleri `http://localhost:3000` adresine iletir.
- **api** işi kendisi yapmaz. Gelen isteği doğrular (`ValidationPipe`) ve `workforce-service`'e TCP mesajı olarak gönderir. Servisten gelen hata kodunu ve mesajını aynen HTTP cevabına çevirir.
- **workforce-service** HTTP dinlemez; yalnızca TCP mesajlarını (`@MessagePattern`) işler. Açılışta veritabanı migration'larını otomatik çalıştırır.

## Gereksinimler

| Araç | Sürüm | Not |
|---|---|---|
| Node.js | 24 LTS | `node -v` ile kontrol edin |
| pnpm | 12 ile denendi | `npm install -g pnpm` |
| Docker Desktop | güncel | PostgreSQL container'ı için; çalışır durumda olmalı |
| Git | güncel | |

## Kurulum

### 1. Repoyu klonlayın

```bash
git clone https://github.com/zilan-fidan/mini-wfm-.git mini-wfm
cd mini-wfm
```

### 2. Veritabanını başlatın

Proje kök dizininde:

```bash
docker compose up -d
docker ps   # "mini-wfm-postgres" container'ı listelenmeli
```

### 3. Ortam değişkenlerini hazırlayın

`workforce-service` veritabanı bilgilerini `.env` dosyasından okur. Örnek dosyayı kopyalamak yeterlidir; değerler `docker-compose.yaml` ile uyumludur:

```bash
cp workforce-service/.env.example workforce-service/.env
```

`api` ve `web` için `.env` dosyası gerekmez.

### 4. Bağımlılıkları kurun

Her uygulamanın kendi `package.json` dosyası vardır; üçünde ayrı ayrı kurulum yapılır:

```bash
cd workforce-service && pnpm install && cd ..
cd api && pnpm install && cd ..
cd web && pnpm install && cd ..
```

## Çalıştırma

**Sıra önemlidir:** veritabanı → `workforce-service` → `api` → `web`. Her biri için ayrı bir terminal açın.

```bash
# Terminal 1: iş kuralları servisi (açılışta migration'ları çalıştırır)
cd workforce-service
pnpm start:dev

# Terminal 2: HTTP API
cd api
pnpm start:dev

# Terminal 3: arayüz
cd web
pnpm dev
```

`start:dev` izleme modunda çalışır: kod değişince servis kendiliğinden yeniden başlar.

Her şeyin ayakta olduğunu kontrol etmek için:

1. `http://localhost:3000/api/health` adresi `pong` döndürmeli. Bu, `api` ile `workforce-service` arasındaki bağlantıyı doğrular.
2. `http://localhost:5173` adresinde arayüz açılmalı ve sol menüde **Ekipler** ile **Personeller** görünmeli.
3. API'yi elle denemek için Swagger: `http://localhost:3000/docs`.

## Portlar

| Port | Uygulama | Protokol | Adres / not |
|---|---|---|---|
| `5173` | web | HTTP | `http://localhost:5173` |
| `3000` | api | HTTP | API: `http://localhost:3000/api` · Swagger: `http://localhost:3000/docs` |
| `4001` | workforce-service | TCP | Tarayıcıdan açılmaz; sadece `api` bağlanır |
| `5433` | PostgreSQL | TCP | Container içinde `5432`, bilgisayarda `5433` |

PostgreSQL bağlantı bilgileri (DBeaver vb. için):

```text
Host: localhost   Port: 5433   Database: mini_wfm
Username: postgres   Password: postgres
```

## Testler

| Uygulama | Komut | Ne test ediliyor |
|---|---|---|
| `workforce-service` | `pnpm test` | Ekip ve personel iş kuralları (404/409 durumları, ekip–personel ilişkisi, cevap biçimi) |
| `api` | `pnpm test` | DTO doğrulamaları (geçersiz veride 400) ve controller'ın servise doğru mesajı göndermesi |
| `web` | `pnpm lint` ve `pnpm build` | Kod kuralları ve TypeScript tip kontrolü |

```bash
cd workforce-service && pnpm test && cd ..
cd api && pnpm test && cd ..
cd web && pnpm lint && pnpm build && cd ..
```

Birim testleri veritabanına bağlanmaz; servisler sahte nesnelerle değiştirilir. Bu yüzden testleri çalıştırmak için Docker'ın açık olması gerekmez.

## Özellikler

### Ekipler

- Listeleme (arama, aktif/pasif filtresi, sayfalama), oluşturma, düzenleme, aktif/pasif yapma, silme.
- Ekip detay sayfasında **Üyeler** tablosu: Sicil No, Ad Soyad, Telefon ve onaylı **Çıkar** butonu.
- **Üye Ekle** butonu, personel aranıp seçilebilen bir modal açar. Başka ekipteki personeller ekip adıyla etiketlenir ve seçilemez. Pasif ekipte buton devre dışıdır; üzerine gelince nedeni görünür.

### Personeller

- Listeleme (ada göre arama, aktif/pasif filtresi, sayfalama), oluşturma, düzenleme, aktif/pasif yapma, silme.
- Listede ve detayda personelin **Ekip** bilgisi görünür.
- Form doğrulamaları backend ile aynıdır: ad/soyad zorunlu (en fazla 100 karakter), sicil no zorunlu ve benzersiz (en fazla 20 karakter), telefon opsiyonel (`5` ile başlayan 10 rakam).

### Ekip–personel ilişkisi

Her personel **en fazla bir** ekipte olabilir; bir ekibin birden çok personeli olabilir (`workforce_user.team_id` → `team.id`, ManyToOne).

| Endpoint | Açıklama |
|---|---|
| `GET /api/teams/:id` | Ekip detayı, üyeleriyle birlikte (`members`) |
| `POST /api/teams/:id/members` | Personeli ekibe ekler. Gövde: `{ "workforceUserId": 1 }` |
| `DELETE /api/teams/:id/members/:workforceUserId` | Personeli ekipten çıkarır |
| `GET /api/workforce-users`, `GET /api/workforce-users/:id` | Her kayıtta `team: { id, name }` ya da `null` |

İş kuralları:

| Durum | Cevap |
|---|---|
| Ekip veya personel yok | `404` |
| Ekibe eklerken ekip veya personel pasif | `409` |
| Personel zaten bir ekipte | `409`, mesajda hangi ekipte olduğu yazar |
| Çıkarılmak istenen personel o ekipte değil | `404` |
| Üyesi olan bir ekip silinmek isteniyor | `409` |

Tüm hata cevapları `{ "statusCode": number, "message": string }` biçimindedir ve arayüzde mesaj olarak gösterilir.

## Uçtan uca deneme

Arayüzden şu senaryo ile bütün akış denenebilir:

1. **Ekipler** → **Yeni Ekip** ile bir ekip oluşturun.
2. **Personeller** → **Yeni Personel** ile bir personel ekleyin.
3. Ekibin adına tıklayıp detayına girin → **Üye Ekle** → personeli seçin → **Ekle**. Personel **Üyeler** tablosunda, personel listesinde de **Ekip** kolonunda görünür.
4. **Ekipler** listesinde bu ekibi silmeyi deneyin. Ekip silinmez ve "Ekipte 1 personel var. Silmeden önce personelleri ekipten çıkarın" mesajı görünür.
5. Ekip detayında personelin satırındaki **Çıkar** butonuna basıp onaylayın.
6. Ekibi tekrar silin; bu sefer silinir.

## Veritabanı ve migration'lar

Tablolar `workforce` şemasında tutulur ve TypeORM migration'ları ile oluşturulur. `workforce-service` açılırken bekleyen migration'ları otomatik uygular (`migrationsRun: true`).

Entity değiştirildiğinde yeni migration üretmek ve yönetmek için (`workforce-service` klasöründe, veritabanı açıkken):

```bash
pnpm migration:generate src/migrations/MigrasyonAdi   # entity farkından migration üretir
pnpm migration:run                                    # bekleyen migration'ları uygular
pnpm migration:revert                                 # son migration'ı geri alır
```

Container yönetimi (proje kök dizininde):

```bash
docker compose down              # container'ı kaldırır, veriler korunur
docker compose logs -f postgres  # logları izler
```

> `docker compose down -v` volume'ü de siler; **tüm veriler kaybolur**.

## Proje yapısı

```text
mini-wfm/
├── docker-compose.yaml        # PostgreSQL
├── web/
│   └── src/
│       ├── api/               # HTTP istekleri (axios)
│       ├── components/        # form ve üye modalları, üyeler kartı
│       ├── pages/             # ekip/personel liste ve detay sayfaları
│       └── types/
├── api/
│   └── src/
│       ├── teams/             # /api/teams uç noktaları ve DTO'lar
│       ├── workforce-users/   # /api/workforce-users uç noktaları ve DTO'lar
│       ├── health/            # /api/health
│       └── common/filters/    # servis hatalarını HTTP cevabına çeviren filtre
└── workforce-service/
    └── src/
        ├── teams/             # ekip ve üyelik iş kuralları
        ├── workforce-users/   # personel iş kuralları
        └── migrations/
```

## Sık karşılaşılan hatalar

| Belirti | Olası neden ve çözüm |
|---|---|
| Arayüzde "Sunucuya ulaşılamıyor" | `api` çalışmıyor. Terminal 2'de `pnpm start:dev` çalıştırın. |
| API `503 Servise şu anda ulaşılamıyor` dönüyor | `workforce-service` çalışmıyor veya 4001 portunda değil. |
| `workforce-service` açılmıyor, veritabanı bağlantı hatası | Docker Desktop kapalı, container ayakta değil (`docker compose up -d`) ya da `workforce-service/.env` dosyası eksik. |
| `port is already allocated` (5433) | Bilgisayarda başka bir PostgreSQL bu portu kullanıyor; onu durdurun ya da `docker-compose.yaml` ve `.env` içindeki portu değiştirin. |
| Backend değişikliğinden sonra yeni alanlar gelmiyor veya sayfa beyaz kalıyor | Servis izleme modu olmadan (`pnpm start`) başlatılmış ve eski kodla çalışıyor. Durdurup `pnpm start:dev` ile yeniden başlatın. |
| Başarı/hata mesajları ve onay pencereleri görünmüyor | `web/src/main.tsx` dosyasının en üstündeki `@ant-design/v5-patch-for-react-19` import'u silinmiş olabilir. Ant Design 5'in bu bileşenleri React 19'da bu yama olmadan çalışmaz. |
