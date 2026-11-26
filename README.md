# Mini WFM

Mini WFM, ekiplerin ve personellerin yönetildiği başlangıç seviyesinde bir Workforce Management projesidir. Tek bir Git reposunda dört uygulama bulunur:

| Uygulama | Teknoloji | Görevi |
|---|---|---|
| `web` | React 19, Vite, Ant Design 5, TanStack Query | Tarayıcı arayüzü |
| `api` | NestJS (HTTP) | Dış dünyaya açık REST API, doğrulama, Swagger |
| `workforce-service` | NestJS (TCP microservice), TypeORM | İş kuralları ve veritabanı; iş emri olaylarını RabbitMQ'ya yayınlar |
| `notification-service` | NestJS (RabbitMQ + TCP microservice), TypeORM | Olaylardan bildirim üretir ve bildirimleri listeler |

Docker içinde PostgreSQL ve RabbitMQ kullanılır.

## Mimari

```text
Tarayıcı (5173)
   │  /api/* istekleri Vite proxy ile 3000'e gider
   ▼
  api (HTTP 3000) ── TCP (4001) ──►  workforce-service ──────────►  PostgreSQL (5433)
  doğrulama, Swagger │               iş kuralları, TypeORM   │         workforce şeması
                     │                       │ emit          │         notification şeması
                     │                       ▼               │
                     │               RabbitMQ (5672)         │
                     │               kuyruk: notification_events
                     │                       │ consume (manuel ack)
                     │                       ▼               │
                     └── TCP (4002) ──► notification-service ┘
                         (bildirim okuma)
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

`api` ve `workforce-service` ayarlarını kendi klasörlerindeki `.env` dosyasından okur. Örnek dosyaları kopyalamak yeterlidir; değerler `docker-compose.yaml` ve varsayılan portlarla uyumludur:

```bash
cp api/.env.example api/.env
cp workforce-service/.env.example workforce-service/.env
cp notification-service/.env.example notification-service/.env
```

`web` için `.env` dosyası gerekmez. Değişkenlerin anlamı için [Ayarlar](#ayarlar) bölümüne bakın.

### 4. Bağımlılıkları kurun

Her uygulamanın kendi `package.json` dosyası vardır; üçünde ayrı ayrı kurulum yapılır:

```bash
cd workforce-service && pnpm install && cd ..
cd notification-service && pnpm install && cd ..
cd api && pnpm install && cd ..
cd web && pnpm install && cd ..
```

## Tüm backend'i Docker ile çalıştırma

PostgreSQL, RabbitMQ, `workforce-service`, `notification-service` ve `api` tek komutla açılır (önce [3. adımdaki](#3-ortam-değişkenlerini-hazırlayın) `.env` dosyaları hazır olmalı):

```bash
docker compose --profile app up -d --build
```

- Açılış sırası healthcheck'lerle sağlanır: PostgreSQL ve RabbitMQ `healthy` olmadan `workforce-service` başlamaz; `workforce-service` migration'larını bitirip TCP portunu açınca `notification-service`, ikisi hazır olunca `api` başlar.
- Migration'lar servisler açılırken otomatik çalışır; ilk admin hesabı `workforce-service/.env` içindeki `INITIAL_ADMIN_*` değerleriyle oluşturulur.
- Swagger: http://localhost:3000/docs
- Container'lar birbirine servis adıyla ulaşır (`postgres:5432`, `rabbitmq:5672`, `workforce-service:4001`, `notification-service:4002`). `.env` dosyaları container'a çalışma zamanında verilir; `docker-compose.yaml` içindeki `environment` bölümü buradaki `localhost` adreslerini container adresleriyle ezer. `.env` imaja kopyalanmaz.
- İmajlar multi-stage build ile üretilir: son imajda yalnız derlenmiş `dist/` ve üretim bağımlılıkları bulunur, uygulama root olmayan `node` kullanıcısıyla çalışır.

```bash
docker compose --profile app ps          # durum ve health bilgisi
docker compose --profile app logs -f api # logları izler
docker compose --profile app down        # tümünü kapatır, veriler korunur
```

Yerel geliştirmede yalnız altyapıyı açmak için `docker compose up -d` yeterlidir; `app` profilindeki servisler bu komutla açılmaz. Uygulama container'ları çalışırken yerelde `pnpm start:dev` açarsanız portlar (3000) çakışır; önce `docker compose --profile app stop api workforce-service notification-service` ile durdurun.

## Çalıştırma

**Sıra önemlidir:** `docker compose up -d` (PostgreSQL + RabbitMQ) → `workforce-service` → `notification-service` → `api` → `web`. Her biri için ayrı bir terminal açın.

```bash
# Terminal 1: iş kuralları servisi (açılışta migration'ları çalıştırır)
cd workforce-service
pnpm start:dev

# Terminal 1b: bildirim servisi (açılışta kendi migration'larını çalıştırır; RabbitMQ açık olmalı)
cd notification-service
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
| `4002` | notification-service | TCP | Bildirim okuma; sadece `api` bağlanır. HTTP portu yoktur |
| `5672` | RabbitMQ | AMQP | workforce-service yayınlar, notification-service tüketir |
| `15672` | RabbitMQ yönetim arayüzü | HTTP | `http://localhost:15672` · kullanıcı/parola `wfm` / `wfm` |
| `5433` | PostgreSQL | TCP | Container içinde `5432`, bilgisayarda `5433` |

PostgreSQL bağlantı bilgileri (DBeaver vb. için):

```text
Host: localhost   Port: 5433   Database: mini_wfm
Username: postgres   Password: postgres
```

## Ayarlar

Ayarlar `@nestjs/config` ile okunur ve uygulama açılırken bir Joi şemasıyla doğrulanır (`src/config/env.validation.ts`). Zorunlu bir değer eksikse ya da sayı beklenen yere metin yazılmışsa uygulama **açılmaz** ve hatalı değişkenlerin hepsini tek seferde listeler:

```text
Error: Config validation error:
  - "PORT" must be a number
  - "DB_PASSWORD" is required
```

**api** (`api/.env`)

| Değişken | Zorunlu | Tip | Varsayılan | Açıklama |
|---|---|---|---|---|
| `NODE_ENV` | hayır | `development` / `production` / `test` | `development` | Çalışma ortamı |
| `PORT` | hayır | port numarası | `3000` | api'nin HTTP portu |
| `WORKFORCE_SERVICE_HOST` | **evet** | host adı | — | workforce-service adresi |
| `WORKFORCE_SERVICE_PORT` | **evet** | port numarası | — | workforce-service TCP portu |
| `NOTIFICATION_SERVICE_HOST` | **evet** | host adı | — | notification-service adresi |
| `NOTIFICATION_SERVICE_PORT` | **evet** | port numarası | — | notification-service TCP portu |

**workforce-service** (`workforce-service/.env`)

| Değişken | Zorunlu | Tip | Varsayılan | Açıklama |
|---|---|---|---|---|
| `NODE_ENV` | hayır | `development` / `production` / `test` | `development` | Çalışma ortamı |
| `PORT` | hayır | port numarası | `4001` | Dinlenen TCP portu; api'deki `WORKFORCE_SERVICE_PORT` ile aynı olmalı |
| `DB_HOST` | **evet** | metin | — | PostgreSQL adresi |
| `DB_PORT` | hayır | port numarası | `5432` | PostgreSQL portu (Docker ile `5433`) |
| `DB_USERNAME` | **evet** | metin | — | |
| `DB_PASSWORD` | **evet** | metin | — | |
| `DB_DATABASE` | **evet** | metin | — | |
| `RABBITMQ_URL` | **evet** | `amqp://` / `amqps://` adresi | — | ör. `amqp://wfm:wfm@localhost:5672` |
| `RABBITMQ_QUEUE` | hayır | metin | `notification_events` | notification-service ile aynı olmalı |
| `RABBITMQ_PUBLISH_TIMEOUT_MS` | hayır | 100–60000 | `3000` | Olay yayını bu süreyi aşarsa vazgeçilir ve hata loglanır |
| `OVERDUE_CHECK_CRON` | hayır | cron ifadesi | `*/15 * * * *` | Geciken iş emri kontrolünün aralığı. Geliştirmede `* * * * *` (her dakika). Geçersiz ifadede servis açılmaz |

**notification-service** (`notification-service/.env`)

| Değişken | Zorunlu | Tip | Varsayılan | Açıklama |
|---|---|---|---|---|
| `NODE_ENV` | hayır | `development` / `production` / `test` | `development` | Çalışma ortamı |
| `PORT` | hayır | port numarası | `4002` | TCP portu; api'deki `NOTIFICATION_SERVICE_PORT` ile aynı olmalı |
| `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | **evet** | metin | — | workforce-service ile aynı veritabanı, ayrı `notification` şeması |
| `DB_PORT` | hayır | port numarası | `5432` | Docker ile `5433` |
| `RABBITMQ_URL` | **evet** | `amqp://` / `amqps://` adresi | — | |
| `RABBITMQ_QUEUE` | hayır | metin | `notification_events` | workforce-service ile aynı olmalı |
| `RABBITMQ_PREFETCH` | hayır | 1–1000 | `10` | Ack'lenmemiş en fazla kaç mesaj aynı anda bu servise verilir |

Yeni bir ayar eklerken üç yeri birlikte güncelleyin: şema (`env.validation.ts`), tip (`ApiEnv` / `WorkforceEnv` / `NotificationEnv`) ve `.env.example`.

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

Tüm hata cevapları `{ "statusCode": number, "message": string, "details"?: unknown }` biçimindedir ve arayüzde mesaj olarak gösterilir.

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
├── docker-compose.yaml        # PostgreSQL + RabbitMQ; "app" profili: api + servisler
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
├── workforce-service/
│   └── src/
│       ├── teams/             # ekip ve üyelik iş kuralları
│       ├── workforce-users/   # personel iş kuralları
│       ├── events/            # RabbitMQ olay sözleşmesi ve yayıncı
│       └── migrations/
└── notification-service/
    └── src/
        ├── common/events/     # olay sözleşmesi (workforce-service ile aynı)
        ├── notifications/     # olay tüketicisi (manuel ack), TCP okuma, bildirim kaydı
        └── migrations/        # notification şeması
```

## Sık karşılaşılan hatalar

| Belirti | Olası neden ve çözüm |
|---|---|
| Arayüzde "Sunucuya ulaşılamıyor" | `api` çalışmıyor. Terminal 2'de `pnpm start:dev` çalıştırın. |
| API `503 Servise şu anda ulaşılamıyor` dönüyor | `workforce-service` çalışmıyor veya 4001 portunda değil. |
| Açılışta `Config validation error` | `.env` dosyası yok ya da listelenen değişkenler eksik/hatalı. `.env.example` ile karşılaştırın. |
| `workforce-service` açılmıyor, veritabanı bağlantı hatası | Docker Desktop kapalı ya da container ayakta değil (`docker compose up -d`). |
| `port is already allocated` (5433) | Bilgisayarda başka bir PostgreSQL bu portu kullanıyor; onu durdurun ya da `docker-compose.yaml` ve `.env` içindeki portu değiştirin. |
| Backend değişikliğinden sonra yeni alanlar gelmiyor veya sayfa beyaz kalıyor | Servis izleme modu olmadan (`pnpm start`) başlatılmış ve eski kodla çalışıyor. Durdurup `pnpm start:dev` ile yeniden başlatın. |
| Başarı/hata mesajları ve onay pencereleri görünmüyor | `web/src/main.tsx` dosyasının en üstündeki `@ant-design/v5-patch-for-react-19` import'u silinmiş olabilir. Ant Design 5'in bu bileşenleri React 19'da bu yama olmadan çalışmaz. |


### Takvim vardiya listesi

`GET /api/shifts?from=2026-11-12T00:00:00%2B03:00&to=2026-11-14T00:00:00%2B03:00`

ADMIN, PLANNER ve VIEWER rolleri listeyi okuyabilir. `from` ve `to` zorunlu ISO 8601 tarihleridir;
`from < to` olmalı ve aralık en fazla 31 × 24 saat olmalıdır (aksi halde 400).
Saat dilimini açıkça belirtin; URL içindeki `+` işaretini `%2B` olarak kodlayın.
İsteğe bağlı pozitif `workforceUserId` ve `teamId` filtreleri birlikte kullanılabilir.
Liste sayfalı değildir, `startAt` artan sıradadır. Her vardiyanın `workforceUser`
alanında `id`, `firstname`, `lastname` ve `team: { id, name }` bulunur; ekipsiz personelde `team: null` döner.
Personel ve ekip tek SQL sorgusunda join ile yüklenir.

Aralık `[from, to)` şeklindedir: `startAt < to AND endAt > from`.
Örneğin 12 Kasım 23:00–13 Kasım 07:00 vardiyası iki günün ayrı sorgusunda da görünür.
Tam `from` anında biten veya tam `to` anında başlayan vardiyalar dahil edilmez.

**Ekip filtresi sınırlaması:** `teamId` personelin şu anki ekibine göre çalışır.
Personel başka ekibe taşındığında geçmiş vardiyalar da yeni ekibinin altında listelenir;
vardiyanın oluşturulduğu tarihteki ekip bilgisi saklanmaz.

Doğrulama:

- API query testleri: `cd api && npm test -- --runInBand src/shifts/shifts-list.spec.ts`
- PostgreSQL entegrasyonu: `cd workforce-service && npm test -- --runInBand src/shifts/shifts-list.integration.spec.ts`

Entegrasyon testi varsayılan olarak Docker Compose veritabanına (`127.0.0.1:5433/mini_wfm`)
bağlanır; farklı test veritabanı için `SHIFTS_TEST_DATABASE_URL` kullanılır.
Test kendi benzersiz şemasını oluşturup sonunda kaldırır; bağlantı kullanıcısının şema oluşturma yetkisi gerekir.


### Ekibin aktif üyelerine toplu vardiya

`POST /api/teams/:id/shifts` (ADMIN, PLANNER)

```json
{
  "startAt": "2099-01-01T08:00:00+03:00",
  "endAt": "2099-01-01T16:00:00+03:00",
  "note": "Ekip vardiyası"
}
```

Mevcut vardiya kuralları geçerlidir: tarihler saat dilimi içermeli, başlangıç geçmişte olmamalı,
süre 1–12 saat olmalıdır. Başarıda 201 ile oluşturulan vardiyaların listesi döner.
`createdById` doğrulanmış actor bağlamından alınır; gövdeden kabul edilmez.
Ekip yoksa 404; ekip pasifse veya aktif üyesi yoksa 409 döner. Pasif üyeler işleme alınmaz.
Aktif üyelerden herhangi birinin vardiyası kesişiyorsa hiçbir yeni vardiya yazılmaz.
Çakışan tüm personeller birer kez listelenir:

```json
{
  "statusCode": 409,
  "message": "Bazı personellerin vardiyaları çakışıyor",
  "details": [
    { "workforceUserId": 1, "registrationNumber": "001", "firstname": "Ada", "lastname": "Yılmaz" },
    { "workforceUserId": 2, "registrationNumber": "002", "firstname": "Ali", "lastname": "Demir" }
  ]
}
```

`details` opsiyoneldir; verilmediğinde eski `{ statusCode, message }` yanıtı korunur.

**Transaction nasıl çalışır?** Ekip ve aktif üyeler okunur, tüm üyelerin çakışmaları tek sorguda
kontrol edilir ve kayıtlar aynı transaction manager üzerinden alınan repository ile yazılır.
Callback başarıyla biterse commit; hata fırlatırsa rollback olur. Ekip ve aktif üye satırlarına
alınan yazma kilitleri transaction bitene kadar tutulur; aynı ekibe eşzamanlı toplu istekler sıraya girer.
Tekil oluşturma, toplu oluşturma ve güncelleme yollarının tümü aynı personel satırlarında
`pessimistic_write` kilidi kullanır. Transaction'lar açıkça `READ COMMITTED` seviyesindedir:
kilidi bekleyen işlem, kilidi aldıktan sonra çakışma sorgusunda önceki işlemin commit ettiği vardiyayı görür.
Personel birden fazlaysa kilitler ID artan sırada alınır. Güncellemede önce vardiyanın güncel hali
kilitlenerek okunur, sonra eski/yeni personeller sıralı kilitlenir; çakışma kontrolü kendi vardiyasını dışlar.
Kontrol ve kayıt arasında transaction sona ermez. Controller kontrolleri ön kontroldür;
kesin kontroller transaction içindeki servis metodunda yeniden yapılır.
Güncellemede yalnızca gönderilen alanlar aktarılır; gönderilmeyenler kilitli güncel kayıttan korunur.
Bu garanti uygulamanın bu servis yolları içindir; doğrudan SQL yazan başka bir işlem de aynı
kilit protokolüne uymalıdır. Veritabanına tüm kaynaklardan yazmayı korumak için ayrıca bir
PostgreSQL exclusion constraint gerekir.

**Mentora anlatım:** Transaction olmadan üyeleri sırayla kaydetseydik ilk iki kayıt başarılı olup
üçüncüde hata oluştuğunda ilk iki kayıt veritabanında kalabilirdi. Önceden çakışma kontrolü yapmak,
kayıt sırasında oluşabilecek veritabanı hatalarına karşı yeterli değildir. Transaction, bütün
kayıtları tek iş birimi yapar: son kayıtta hata olsa bile tamamı geri alınır. Bu nedenle callback
içinde normal repository yerine transaction manager'ın repository'leri kullanılır.

Testler:

- `cd api && npm test -- --runInBand src/teams/team-shifts.spec.ts src/common/filters/all-exceptions.filter.spec.ts`
- `cd workforce-service && npm test -- --runInBand src/shifts/team-shifts.spec.ts`
- PostgreSQL: `cd workforce-service && npm test -- --runInBand src/shifts/shifts-list.integration.spec.ts`

PostgreSQL testi birden fazla çakışan üyeyi, hiçbir yeni kayıt yazılmamasını, kayıt hatasında rollback'i,
pasif üyelerin dışlanmasını ve eşzamanlı toplu istekleri kapsar. Önceki bölümdeki test bağlantısını kullanır.


Ortak kilitleme birim testleri:
`cd workforce-service && npm test -- --runInBand src/shifts/shift-locking.spec.ts`

PostgreSQL entegrasyon dosyası ayrıca tekil–tekil, tekil–toplu, güncelleme–oluşturma,
güncelleme–güncelleme ve personel değiştirme–oluşturma yarışlarını kapsar.

## MWFM-31 — İş Emri Durum Yönetimi ve Geçmiş Kaydı

### Durum makinesi (B19)

İş emirlerinin izin verilen durum geçişleri merkezi olarak
`workforce-service/src/work-orders/constants/work-order-transitions.ts` dosyasında tanımlanır.

| Mevcut durum | Yeni durum | Ek kural |
|---|---|---|
| `OPEN` | `ASSIGNED` | Aktif ekip ve en az bir aktif üye zorunludur. |
| `OPEN` | `CANCELLED` | İptal nedeni zorunludur. |
| `ASSIGNED` | `IN_PROGRESS` | Ek koşul yoktur. |
| `ASSIGNED` | `OPEN` | Ekip ataması kaldırılır. |
| `ASSIGNED` | `CANCELLED` | İptal nedeni zorunludur. |
| `IN_PROGRESS` | `COMPLETED` | Ek koşul yoktur. |
| `IN_PROGRESS` | `CANCELLED` | İptal nedeni ve ADMIN yetkisi zorunludur. |

Tabloda bulunmayan geçişler `409 Conflict` hatasıyla engellenir. `OPEN → ASSIGNED`
geçişinde ekip bulunamazsa `404`; ekip pasifse veya aktif üyesi yoksa `409` döner.

### Audit log ve transaction

Her durum değişikliği `workforce.work_order_status_history` tablosuna kaydedilir. Geçmiş kaydı:

- İş emri ID'sini,
- önceki ve yeni durumu,
- ilgili ekip ID'sini,
- değişiklik nedenini,
- işlemi yapan hesabın ID'sini,
- işlem zamanını

içerir.

İş emrinin güncellenmesi ve geçmiş kaydının eklenmesi aynı PostgreSQL transaction'ı içinde
gerçekleştirilir. Geçmiş kaydı oluşturulamazsa durum değişikliği de rollback edilir. Yeni bir iş emri
oluşturulduğunda ilk geçmiş kaydı `null → OPEN` olarak aynı transaction içinde oluşturulur.

### Ekip pasifleştirme ve personel çıkarma kararı

**Durum: Mentor onayı bekleniyor.**

Karar verilmesi gereken konu, aktif iş emri bulunan bir ekibin pasifleştirilmesine veya ekipteki son
aktif personelin çıkarılmasına izin verilip verilmeyeceğidir.

Önerilen yaklaşım: `OPEN`, `ASSIGNED` veya `IN_PROGRESS` durumunda iş emri atanmış bir ekip
pasifleştirilememeli; bu ekibin son aktif personelinin çıkarılması ya da pasifleştirilmesi de
engellenmelidir. Böylece devam eden bir iş emri sorumlu ekipsiz veya aktif personelsiz kalmaz.
Kural mentor değerlendirmesinden sonra kesinleştirilerek ilgili ekip ve personel işlemlerine
uygulanacaktır.

### Yeni bir iş emri durumu ekleme

Yeni durum eklenirken şu bileşenler birlikte güncellenmelidir:

1. `work-order-status.enum.ts`: Yeni durum tanımlanır.
2. `work-order-transitions.ts`: İzin verilen geçişler, ek kurallar ve Türkçe durum karşılığı eklenir.
3. PostgreSQL migration: Veritabanındaki enum tipi güncellenir.
4. API Gateway `ChangeWorkOrderStatusDto`: Yeni durum API enum'una eklenir.
5. Unit testler: Yeni izinli ve izinsiz geçişler test edilir.
6. Swagger dokümantasyonu: Yeni durumun API üzerinden doğru gösterildiği kontrol edilir.

### API endpoint'leri

| Metot | Endpoint | Açıklama |
|---|---|---|
| `PATCH` | `/api/work-orders/:id/status` | İş emrinin durumunu değiştirir. |
| `GET` | `/api/work-orders/:id/history` | Durum geçmişini eskiden yeniye listeler. |

Durum geçmişi sonuçlarında işlemi yapan hesabın kullanıcı adı ile işlem zamanı da bulunur.

## WFM-36 — Personel Bazlı Aylık Puantaj

`GET /api/workforce-users/:id/timesheet?month=2026-11` (ADMIN, PLANNER, VIEWER)

`id` pozitif tamsayı, `month` `YYYY-MM` olmalıdır; resmî tatil takvimi yalnızca 2026 ve 2027 için
tanımlı olduğundan diğer yıllar 400 döner. Personel yoksa 404.

### Hesaplama kuralları

Bütün aralıklar `[startAt, endAt)`; yerel saat UTC+180 dakika (`DEFAULT_WORK_RULE_OPTIONS.utcOffsetMinutes`).

| Kategori | Kural |
|---|---|
| Toplam | Vardiyaların istenen ay içinde kalan süresi |
| Gece | Yerel 20.00–06.00 |
| Resmî tatil | `shifts/calc/holidays.ts`; yarım gün tatiller 13.00'te başlar |
| Hafta sonu | Cumartesi–pazar; tatile denk gelen süre yalnızca tatil sayılır |
| Fazla mesai | Pazartesi 00.00'da başlayan haftada zaman sırasıyla biriken çalışmanın 45 saati aşan kısmı |

Gece ve fazla mesai diğer kategorilerle örtüşebilir; kategori toplamı toplam süreye eşit olmak zorunda değildir.
Süreler dakika olarak, yuvarlanmadan hesaplanır; yalnızca yanıtta saate çevrilip bir ondalığa yuvarlanır.
Her satır (gün, hafta, ay) kendi dakikasından yuvarlanır; yuvarlanmış günlük değerler toplanmaz.

### Yanıt

```json
{
  "workforceUserId": 1,
  "month": "2026-10",
  "days": [{ "date": "2026-10-28", "totalHours": 8, "nightHours": 0, "holidayHours": 3, "weekendHours": 0, "overtimeHours": 0 }],
  "weeks": [{ "weekStart": "2026-10-26", "totalHours": 24, "overtimeHours": 0, "monthTotalHours": 18, "monthOvertimeHours": 0 }],
  "totals": { "totalHours": 18, "nightHours": 8, "holidayHours": 3, "weekendHours": 4, "overtimeHours": 0 }
}
```

- `days`: ayın bütün günleri; vardiyasız günler sıfırdır.
- `weeks`: ayı kapsayan tam haftalar (pazartesi). `totalHours` / `overtimeHours` **tam haftaya** aittir
  (ay dışındaki günler dahil). `monthTotalHours` / `monthOvertimeHours` aynı haftanın **istenen ay içindeki**
  bölümüdür. Fazla mesai her zaman tam haftanın birikimine göre belirlenir.
- `totals`: yalnızca istenen ay içinde kalan süre.

Servis, ayı kapsayan tam haftalarla **kesişen** bütün vardiyaları okur (`startAt < haftalarSonu AND endAt > haftalarBaşı`);
önceki pazar başlayıp pazartesiye taşan vardiyalar da gelir.

### İki algoritma

| Dosya | Yöntem | Kullanım |
|---|---|---|
| `shifts/calc/timesheet-reference.ts` | Dakika dakika referans | Yalnızca test ve performans karşılaştırması |
| `shifts/calc/timesheet-split.ts` | Aralık bölme (gün, 06.00, 20.00, tatil, ay sınırları ve haftalık 45 saat eşiği) | Serviste |

Kategori mantığı iki dosyada bağımsız yazılmıştır (referans: tarih metni ve `Date` alanları;
bölme: milisaniye aritmetiği ve tatil aralıkları). Ortak olan yalnızca tipler, tatil verisi ve dönem sınırlarıdır.

**Belirsizliklerde seçilen davranış:**

- **Çakışan vardiyalar:** Proje çakışmayı yazma sırasında engeller (`assertNoOverlap`), ancak doğrudan SQL ile
  oluşabilir. Puantajda aynı an **bir kez** sayılır (vardiyaların birleşimi).
- **Dakika altı hassasiyet:** API saniye ve milisaniyeli tarihleri kabul eder. Puantaj bunları yuvarlamaz;
  süreler kesirli dakika olabilir (ör. 19:59:30–20:00:45 → toplam 1,25, gece 0,75 dakika).

### Testler

```bash
cd workforce-service
npm test -- --runInBand src/shifts/calc/timesheet.spec.ts            # örnekler, sınırlar, 200 aylık karşılaştırma
npm test -- --runInBand src/shifts/timesheet.service.spec.ts
npm test -- --runInBand src/shifts/timesheet.integration.spec.ts     # PostgreSQL
cd ../api && npm test -- --runInBand src/workforce-users/timesheet.spec.ts
```

Karşılaştırma testi sabit seed (`20261119`) ile 200 aylık vardiya listesi üretir (`test/timesheet/timesheet-generator.ts`)
ve iki algoritmanın günlük, haftalık ve aylık dakika değerlerini yuvarlamadan karşılaştırır (tolerans 1e-6 dakika).
Entegrasyon testi örnek vardiyaları normal `createShift` yolundan yazar; çalışma kuralları açıktır,
yalnızca `Date.now` 1 Ekim 2026'ya sabitlenir.

### Performans

`cd workforce-service && pnpm bench:timesheet` — seed `20261119`, 1.000 personel × Ekim 2026
(26.095 vardiya), 3 ısınma + 10 ölçüm. Veri üretimi ve veritabanı ölçüme dahil değildir.

Ölçüm koşulları: Node v24.21.0, Apple M4 (10 çekirdek), macOS (Darwin 25.6.0), 24 GB RAM, 2026-11-19.

| Algoritma | Medyan | Min | Maks | Personel başına |
|---|---:|---:|---:|---:|
| Dakika dakika (referans) | 10.185,6 ms | 10.104,1 ms | 10.479,5 ms | 10,19 ms |
| Aralık bölme | 32,8 ms | 32,0 ms | 33,2 ms | 0,033 ms |

Aralık bölme medyanda yaklaşık **311 kat** daha hızlıdır.

## WFM-39 — Bildirimler: RabbitMQ ile asenkron haberleşme

workforce-service iş emri durumu değişince olay yayınlar ve cevabını beklemez. notification-service
olayı kuyruktan alır ve bildirim yazar. İki servis birbirinin ayakta olmasına bağlı değildir.

### Olaylar

Kuyruk: `notification_events` (durable). Mesajlar persistent gönderilir; AMQP `message_id` = `eventId`,
`correlation_id` = isteğin correlation id'si. Sözleşme iki yerde aynı tutulur:
`workforce-service/src/events/work-order-events.ts` ve `notification-service/src/common/events/work-order-events.ts`.

| Olay | Ne zaman | Gövde |
|---|---|---|
| `workOrderStatusChanged` | Her durum değişikliğinde | `workOrder { id, code, title, version }`, `fromStatus`, `toStatus`, `teamId`, `reason`, `changedById` |
| `workOrderAssigned` | Ayrıca `OPEN → ASSIGNED` geçişinde | `workOrder { …, priority, dueAt }`, `team { id, name }`, `members [{ id, firstname, lastname }]`, `assignedById` |

Her olayda ayrıca `eventId` (UUID, her olay için ayrı), `eventVersion`, `occurredAt` ve `correlationId` bulunur (P8).
`members` atama ile **aynı transaction içinde** okunan aktif üyelerdir; notification-service workforce-service'e geri sormaz.

### Yayın: transaction'dan sonra (B22)

`WorkOrdersService.changeWorkOrderStatus` olayları transaction içinde yalnızca hazırlar, commit'ten sonra
`WorkOrderEventsPublisher.publish` ile yayınlar. Transaction hata verirse (`409`, FK hatası vb.) olay çıkmaz.
Önce yayınlayıp sonra commit etseydik rollback olan bir atama için bildirim gidebilirdi.

### RabbitMQ kapalıyken (B23)

`publish` beklenmez ve hata fırlatmaz. RabbitMQ'ya ulaşılamıyorsa iş emri işlemi yine `200` döner,
workforce-service loguna şu yazılır:

```text
ERROR [WorkOrderEventsPublisher] workOrderAssigned eventId=… correlationId=… workOrderId=7 yayınlanamadı, olay kayboldu (RabbitMQ'ya ulaşılamıyor): connect ECONNREFUSED 127.0.0.1:5672
```

RabbitMQ'ya bağlantı ilk olayda kurulur; servis RabbitMQ kapalıyken de açılır. RabbitMQ geri gelince
sonraki olaylar kendiliğinden yayınlanır. Bağlantı asılı kalırsa `RABBITMQ_PUBLISH_TIMEOUT_MS` sonunda vazgeçilir.

**Bedeli:** RabbitMQ kapalıyken yayınlanan olaylar **kaybolur**; o atamaların bildirimleri hiç oluşmaz ve
kendiliğinden düzelmez. Kullanılabilirliği (iş emri her zaman atanabilir) tutarlılığa (her atamanın
bildirimi olur) tercih ettik. Kaybı önlemenin yolu **transactional outbox**: olay iş emriyle aynı transaction
içinde bir tabloya yazılır, ayrı bir işlem bu tabloyu RabbitMQ'ya taşır. Bu görevde uygulanmadı.

### Tüketim: manuel ack ve tekrar gelen olay (P8)

notification-service `noAck: false` ile dinler. Mesaj yalnızca bildirim kaydı başarıyla yazıldıktan sonra
ack'lenir (`notifications/manual-ack.ts`):

| Durum | Davranış |
|---|---|
| Kayıt yazıldı (ya da olay zaten işlenmişti) | `ack` → kuyruktan silinir |
| Veritabanı hatası vb. | 1 sn bekle, `nack(requeue=true)` → kuyruğa döner, yeniden denenir |
| Geçersiz olay (eksik `eventId`, bozuk gövde) | `nack(requeue=false)` → atılır, loglanır |
| Servis ack'ten önce çöktü | RabbitMQ mesajı kendisi kuyruğa geri koyar |

RabbitMQ "en az bir kez" teslim eder; aynı olay iki kez gelebilir. `notification` tablosunda
`(event_id, workforce_user_id)` tekil kısıtı vardır ve kayıt `INSERT … ON CONFLICT DO NOTHING` ile yazılır.
İkinci teslimatta hiçbir satır eklenmez, mesaj yine ack'lenir. Kontrolü veritabanı yaptığı için iki tüketici
aynı olayı aynı anda işlese de bildirim bir kez oluşur.

> `eventId` tablo genelinde değil **personel başına** tekildir: bir `workOrderAssigned` olayı ekibin her aktif
> üyesi için ayrı satır üretir, bu satırların hepsi aynı `eventId`'yi taşır.

`workOrderStatusChanged` şimdilik bildirim üretmez; loglanır ve ack'lenir.

### notification-service

- HTTP portu açmaz. Bir Nest uygulamasına iki microservice bağlanır: RabbitMQ (olaylar) ve TCP `4002`
  (okuma). Handler'lar transport ile sınırlıdır (`@EventPattern(…, Transport.RMQ)`,
  `@MessagePattern(…, Transport.TCP)`); kuyruktan okuma isteği, TCP'den olay gönderilemez.
- Kendi `notification` şeması ve migration'ı vardır. Migration kayıtları `notification_migrations`
  tablosunda tutulur (workforce-service'in `migrations` tablosuyla karışmasın diye).
- Loglarda her olay için `eventId` ve `correlationId` görünür:

```text
LOG [NotificationEventsController] workOrderAssigned eventId=… correlationId=adim1-kuyruk workOrderId=3 teamId=30 members=2 created=2 duplicate=0
```

### Okuma

`GET /api/notifications?workforceUserId=1` (ADMIN, PLANNER, VIEWER). api bu isteği workforce-service'e değil,
notification-service'e TCP ile gönderir. En yeni 100 bildirim, yeniden eskiye döner. `workforceUserId`
pozitif tamsayı değilse `400`, notification-service kapalıysa `503`.

### Nasıl denenir?

1. `docker compose up -d`, workforce-service ve api çalışıyor; **notification-service durdurulmuş**.
2. Aktif üyesi olan bir ekibe bir iş emri atayın (`PATCH /api/work-orders/:id/status`, `status: ASSIGNED`).
3. `http://localhost:15672` → **Queues** → `notification_events`: `Ready` sütununda 2 mesaj bekler
   (`workOrderStatusChanged` + `workOrderAssigned`).
4. notification-service'i başlatın: mesajlar işlenir, kuyruk boşalır, loglarda `created=<üye sayısı>` görünür.
   `GET /api/notifications?workforceUserId=<üye id>` bildirimi döner.
5. `docker compose stop rabbitmq` ve yeni bir atama yapın: atama `200` döner, workforce-service logunda
   `yayınlanamadı, olay kayboldu` hatası görünür. `docker compose start rabbitmq` ile geri açın.

### Testler

```bash
cd notification-service && pnpm test     # idempotency (PostgreSQL), manuel ack, TCP okuma, ayarlar
cd workforce-service && npm test -- --runInBand src/events src/work-orders/work-orders.service.spec.ts src/work-orders/work-orders-version.integration.spec.ts
cd api && npm test -- --runInBand src/notifications
```

| Kabul kriteri | Test |
|---|---|
| Aynı olay iki kez işlense de bildirim bir kez oluşur | `notifications.integration.spec.ts` (art arda, eşzamanlı ve iki teslimat + ack) |
| Bildirim yazılmadan mesaj silinmez | `notification-events.controller.spec.ts` |
| Geri alınan işlem için olay yayınlanmaz | `work-orders-version.integration.spec.ts` (gerçek FK hatası → rollback), `work-orders.service.spec.ts` |
| RabbitMQ kapalıyken atama çalışır | `work-order-events.publisher.spec.ts` |
| Correlation id olayla taşınır | `work-order-events.publisher.spec.ts`, `notification-events.controller.spec.ts` |

PostgreSQL testi varsayılan olarak `127.0.0.1:5433/mini_wfm`'e bağlanır, kendi şemasını oluşturup siler;
farklı veritabanı için `NOTIFICATIONS_TEST_DATABASE_URL`.

### Mentora anlatım: `send` ile `emit` farkı

| | `send` (`@MessagePattern`) | `emit` (`@EventPattern`) |
|---|---|---|
| Model | İstek–cevap | Olay (ateşle ve unut) |
| Gönderen | Cevabı bekler; karşı taraf kapalıysa hata/zaman aşımı alır | Cevap beklemez; yalnızca mesajın broker'a teslimini bilir |
| Karşı taraf | Tek bir alıcı, cevap üretmek zorunda | Sıfır, bir ya da çok tüketici olabilir; cevap üretmez |
| Bağlılık | Zamansal bağlılık: iki servis aynı anda ayakta olmalı | Kuyruk araya girer; tüketici kapalıysa mesaj bekler |
| Bu projede | api → workforce-service / notification-service (TCP) | workforce-service → RabbitMQ → notification-service |

Bildirim için `send` kullansaydık iş emri ataması notification-service'in cevabını bekler, o servis kapalıyken
atama da başarısız olurdu. `emit` ile atama bildirimden bağımsızdır; bedeli, bildirimin "hemen" değil
"sonunda" oluşması (eventual consistency) ve yukarıda anlatılan B23 kaybıdır.

## Geciken iş emirlerinin zamanlanmış kontrolü

workforce-service, kimse istek atmadan `OVERDUE_CHECK_CRON` aralığında (varsayılan 15 dakika) çalışan bir iş
içerir (`work-orders/overdue/`). Süresi geçmiş (`due_at <= şimdi`) ve kapanmamış (`OPEN`, `ASSIGNED`,
`IN_PROGRESS`) her iş emri için **bir kez** `workOrderOverdue` olayı yayınlar. notification-service bu olayla
iş emrinin ekibindeki aktif üyelere "İş emri gecikti" bildirimi yazar.

- Aralık ayardan gelir; bu yüzden `@Cron()` dekoratörü yerine iş açılışta `SchedulerRegistry` ile kaydedilir.
  Geliştirmede `.env` içinde `OVERDUE_CHECK_CRON=* * * * *` yapın.
- Her çalışma sonucu loglar (hiç kayıt yoksa da):

```text
LOG [OverdueCheckJob] Geciken iş emri kontrolü: 1 iş emri bulundu, 1 olay yayınlandı correlationId=overdue-check-… duration=28ms
```

### Bir iş emri için tek olay: `overdue_notified_at`

Migration `AddOverdueNotifiedAtToWorkOrder1795500000000`, `work_order` tablosuna `overdue_notified_at` kolonunu
ve yalnızca bekleyen kayıtları içeren kısmi bir index ekler. İş, kayıtları tek bir SQL ifadesiyle sahiplenir:

```sql
WITH due AS (
  SELECT id FROM workforce.work_order
  WHERE overdue_notified_at IS NULL AND status IN ('OPEN','ASSIGNED','IN_PROGRESS') AND due_at <= $1
  ORDER BY due_at, id LIMIT 500
  FOR UPDATE SKIP LOCKED
)
UPDATE workforce.work_order wo SET overdue_notified_at = $1 FROM due WHERE wo.id = due.id
RETURNING …
```

- Sahiplenilen kayıt sonraki çalışmalarda gelmez (`overdue_notified_at IS NULL` koşulu).
- Olaylar sahiplenme commit edildikten **sonra** yayınlanır (B22). Olaydaki ekip ve aktif üye listesi aynı
  transaction'da okunur.
- Sahiplenme `version` ve `updated_at` değerlerine dokunmaz. Bu bir sistem işaretidir; kullanıcının elindeki
  sürümü eskitip `409` almasına yol açmamalı. Bu yüzden TypeORM'un update builder'ı (version'ı artırır) yerine
  ham SQL kullanılır.
- `PATCH /api/work-orders/:id` ile `dueAt` ileri bir tarihe alınırsa `overdue_notified_at` aynı UPDATE'te
  `NULL` olur; yeni süre de geçerse tekrar bildirilir. Başka alanların güncellenmesi işareti değiştirmez.
- Bir çalışmada en fazla 500 kayıt alınır, kalanlar sonraki çalışmaya kalır. Bir çalışma aralıktan uzun sürerse
  aynı kopyada sıradaki tetikleme atlanır (üst üste binmez).

**Yayın başarısız olursa** (RabbitMQ kapalı): o kaydın sahiplenmesi geri alınır ve sonraki çalışmada yeniden
denenir. İş emri isteklerinden farklı olarak burada olay kaybolmaz, çünkü işaret yayın başarısız olunca geri
alınıyor. `eventId` iş emri ve `dueAt`'ten türetilir (UUID biçiminde SHA-256 özeti), yani yeniden denemede aynı
kimlik gider. Yayın aslında ulaşmış ama zaman aşımına düşmüşse notification-service ikinci olayı tanır ve
bildirimi tekrar yazmaz. `dueAt` değişince eventId de değişir, böylece yeni gecikme ayrı bir bildirim olur.

Kalan risk: sahiplenme commit edildikten hemen sonra, yayından önce süreç çökerse o olay kaybolur (işaret dolu
kalır). Bunu kapatmanın yolu yine transactional outbox.

### Nasıl denenir?

1. `workforce-service/.env` içinde `OVERDUE_CHECK_CRON=* * * * *` yapın, servisleri başlatın.
2. Bitiş tarihi 2–3 dakika sonra olan bir iş emri oluşturun ve aktif üyesi olan bir ekibe atayın.
3. Süre dolduktan sonraki ilk çalışmada logda `1 iş emri bulundu, 1 olay yayınlandı` görünür; notification-service
   logunda `workOrderOverdue … created=<üye sayısı>`. `GET /api/notifications?workforceUserId=<üye id>` bildirimi döner.
4. Sonraki çalışmalarda `0 iş emri bulundu` yazar; yeni bildirim oluşmaz.

### Testler

```bash
cd workforce-service
npm test -- --runInBand src/work-orders/overdue   # PostgreSQL entegrasyonu + zamanlanmış iş
npm test -- --runInBand src/config
cd ../notification-service && pnpm test
```

| Kabul kriteri | Test |
|---|---|
| Geciken her iş emri için tek olay | `overdue-work-orders.integration.spec.ts` (tekrar çalışma, iki kopya aynı anda) |
| Kapanmış iş emirleri için olay yok | `overdue-work-orders.integration.spec.ts` |
| Her çalışmada bulunan sayı loglanıyor | `overdue-check.job.spec.ts` |

### Mentorla konuşulacak: servisin birden fazla kopyası çalışsaydı?

Zamanlayıcı her kopyanın kendi içinde çalışır. 3 kopya varsa iş her 15 dakikada 3 kez tetiklenir.

- **Korumasız olsaydı:** Üç kopya da aynı geciken iş emirlerini bulur, her biri olay yayınlardı; her üye aynı
  gecikme için 3 bildirim alırdı. "Önce SELECT, sonra UPDATE" yazılsaydı da sorun kalırdı: kopyalar aynı satırları
  aynı anda okuyup ikisi de "henüz bildirilmemiş" görürdü.
- **Bu çözümde:** Sahiplenme tek ifadedir ve `FOR UPDATE SKIP LOCKED` kullanır. Bir kopyanın kilitlediği satırı
  diğer kopya beklemeden atlar; her iş emri tam olarak bir kopyaya düşer. Entegrasyon testi iki eşzamanlı
  çalışmayla bunu doğrular. İkinci güvenlik ağı: eventId sabit olduğu için aynı olay iki kez gitse bile
  notification-service bildirimi bir kez yazar.
- **Hâlâ kalanlar:**
  - Bütün kopyalar her aralıkta sorgu çalıştırır; işi biri yapar, diğerleri boş döner (gereksiz yük, ama küçük).
  - Kopyaların saatleri farklıysa "şimdi" değeri birkaç saniye kayabilir; sonuç değişmez, yalnızca zamanlama.
  - "Önceki çalışma sürüyor, atla" koruması kopya başınadır, kopyalar arası değildir; burada bu sorun değil,
    çünkü kopyalar arasında satır kilitleri koruyor.
- **Alternatifler:**
  - PostgreSQL advisory lock (`pg_try_advisory_lock`): yalnızca kilidi alan kopya işi çalıştırır.
  - Zamanlanmış işi ayrı, tek kopya çalışan bir worker sürecine taşımak.
  - Kubernetes CronJob gibi platformun zamanlayıcısı ya da lider seçimi.


## WFM-41 — Ekip Özet Raporu

`GET /api/reports/team-summary?from=&to=` (ADMIN, PLANNER, VIEWER). Aralık `[from, to)`, en fazla 31 gün. Her ekip için bir satır döner; hiç verisi olmayan ekipler de 0 değerleriyle listededir.

```json
{
  "from": "2026-11-01T00:00:00.000Z",
  "to": "2026-11-08T00:00:00.000Z",
  "teams": [
    {
      "teamId": 1,
      "teamName": "Alfa",
      "activeMemberCount": 2,
      "workOrders": { "OPEN": 1, "ASSIGNED": 2, "IN_PROGRESS": 1, "COMPLETED": 1, "CANCELLED": 1, "overdue": 3 },
      "shiftHours": 19
    }
  ]
}
```

### Kurallar

| Alan | Nasıl hesaplanır |
|---|---|
| `activeMemberCount` | Ekipteki `is_active = true` personel sayısı |
| `workOrders.<DURUM>` | `due_at` değeri `[from, to)` içinde olan ve ekibe atanmış iş emirleri, duruma göre |
| `workOrders.overdue` | Aynı iş emirlerinden `due_at < şimdi` ve COMPLETED/CANCELLED olmayanlar (listedeki `isOverdue` ile aynı kural) |
| `shiftHours` | Ekip üyelerinin aralıkla kesişen vardiyaları; yalnızca aralık içindeki kısım: `LEAST(end_at, to) - GREATEST(start_at, from)`. Pasif üyelerin çalıştığı saatler de sayılır. 2 basamağa yuvarlanır |

### Tek sorgu

Rapor, ekip sayısından bağımsız olarak **tek bir SQL sorgusuyla** üretilir ([team-summary.service.ts](workforce-service/src/reports/team-summary.service.ts)). Üye, iş emri ve vardiya sayıları ayrı CTE'lerde kendi başlarına `GROUP BY team_id` ile toplanır, sonra `team` tablosuna `LEFT JOIN` edilir:

- Üç tabloyu doğrudan join'leyip sonra gruplamak satırları çoğaltırdı (3 üye × 4 iş emri = 12 satır, sayılar şişer).
- `LEFT JOIN` + `COALESCE(..., 0)`: verisi olmayan ekip de listeye girer.
- Durum sayıları tek taramada koşullu sayma ile alınır: `COUNT(*) FILTER (WHERE status = 'OPEN')`.

### Elle kontrol (DBeaver)

```sql
-- Bir ekibin durum sayıları
SELECT status, COUNT(*) FROM workforce.work_order
WHERE team_id = 1 AND due_at >= '2026-11-01T00:00:00Z' AND due_at < '2026-11-08T00:00:00Z'
GROUP BY status;

-- Geciken
SELECT COUNT(*) FROM workforce.work_order
WHERE team_id = 1 AND due_at >= '2026-11-01T00:00:00Z' AND due_at < '2026-11-08T00:00:00Z'
  AND due_at < now() AND status NOT IN ('COMPLETED', 'CANCELLED');

-- Aralık içindeki vardiya saati
SELECT SUM(EXTRACT(EPOCH FROM LEAST(s.end_at, '2026-11-08T00:00:00Z') - GREATEST(s.start_at, '2026-11-01T00:00:00Z'))) / 3600
FROM workforce.shift s JOIN workforce.workforce_user wu ON wu.id = s.workforce_user_id
WHERE wu.team_id = 1 AND s.start_at < '2026-11-08T00:00:00Z' AND s.end_at > '2026-11-01T00:00:00Z';
```

workforce-service'te TypeORM `logging: 'all'` açık olduğundan, rapor isteği sırasında logda tek bir `query:` satırı görünür.

### Testler

[team-summary.integration.spec.ts](workforce-service/src/reports/team-summary.integration.spec.ts) gerçek PostgreSQL'de, ayrı bir şemada bilinen bir veri seti kurar ve şunları kontrol eder: durum ve geciken sayıları, aralık sınırları (`from` dahil, `to` hariç), kısmen aralığa giren vardiyaların kırpılması, verisi olmayan ekibin 0 ile gelmesi, 3 ekipte de 23 ekipte de tek sorgu çalışması ve geçersiz aralıkların reddedilmesi. API'deki query doğrulaması [team-summary.spec.ts](api/src/reports/team-summary.spec.ts) dosyasında test edilir.
