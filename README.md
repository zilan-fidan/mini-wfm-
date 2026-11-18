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

`api` ve `workforce-service` ayarlarını kendi klasörlerindeki `.env` dosyasından okur. Örnek dosyaları kopyalamak yeterlidir; değerler `docker-compose.yaml` ve varsayılan portlarla uyumludur:

```bash
cp api/.env.example api/.env
cp workforce-service/.env.example workforce-service/.env
```

`web` için `.env` dosyası gerekmez. Değişkenlerin anlamı için [Ayarlar](#ayarlar) bölümüne bakın.

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

Yeni bir ayar eklerken üç yeri birlikte güncelleyin: şema (`env.validation.ts`), tip (`ApiEnv` / `WorkforceEnv`) ve `.env.example`.

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
