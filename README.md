# Mini WFM

Mini WFM, tek bir Git reposu içerisinde iki ayrı NestJS uygulaması barındıran başlangıç seviyesinde bir Workforce Management projesidir.

## Mevcut Durum

### Geliştirme ortamı

- Node.js LTS, pnpm, Nest CLI, Docker Desktop ve Git kurulmuştur.
- `mini-wfm` ana klasörü altında `api` ve `workforce-service` olmak üzere iki ayrı NestJS projesi bulunmaktadır.
- Her iki projede paket yöneticisi olarak `pnpm` kullanılmaktadır.
- Alt projelerin kendi Git repository'leri yoktur; ikisi de aynı ana repository altında tutulmaktadır.
- `.gitignore` hazırlanmıştır. `node_modules`, `dist`, `.env` ve TypeScript build cache dosyaları Git takibinden çıkarılmıştır.
- PostgreSQL, Docker Compose ile çalıştırılmaktadır (bkz. [PostgreSQL Veritabanını Başlatma](#postgresql-veritabanını-başlatma)).

### WFM-4: api ile workforce-service bağlantısı

- `workforce-service`, HTTP uygulaması olmaktan çıkarılıp `4001` portunu dinleyen bir **TCP microservice**'e dönüştürülmüştür.
- Varsayılan HTTP controller ve service dosyaları (`app.controller.ts`, `app.controller.spec.ts`, `app.service.ts`) kaldırılmıştır.
- `workforce-service` içine `ping` pattern'i eklenmiştir; `pong` döndürür.
- `api` içinde `workforce-service`'e bağlanan bir **TCP client** (`ClientsModule`) tanımlanmıştır.
- `api` içindeki tüm endpoint'ler `/api` önekiyle başlar (global prefix).
- `api` içinde global `ValidationPipe` kurulmuştur:
  - `whitelist: true`: DTO'da tanımlı olmayan alanlar atılır.
  - `transform: true`: Gelen veri DTO sınıfına dönüştürülür.
  - Bunun için `class-validator` ve `class-transformer` kullanılır.
- `api` içinde **Swagger**, `/docs` adresinde açılmıştır.
- `GET /api/health` endpoint'i eklenmiştir. Bu endpoint `workforce-service`'e `ping` mesajı gönderir ve gelen yanıtı (`pong`) döndürür.
- Bağlantı, Swagger üzerinden `GET /api/health` çalıştırılarak doğrulanmıştır: yanıt `pong`.

## Mimari

```text
Tarayıcı / Swagger
        │  HTTP (3000)
        ▼
      api  ──────────────  TCP (4001)  ──────────────►  workforce-service
  (dış dünyaya açık)         "ping"                     (iş mantığı, veritabanı)
        ▲                                                      │
        └──────────────────────  "pong"  ◄─────────────────────┘
```

- **api**: Dış dünyaya açılan HTTP katmanıdır. İşi kendisi yapmaz, `workforce-service`'e mesaj gönderir.
- **workforce-service**: HTTP dinlemez. Yalnızca TCP üzerinden gelen mesajları, `@MessagePattern` ile tanımlanmış pattern'lere göre işler.
- `send(pattern, data)` istek-yanıt modelidir: cevap beklenir. `emit(pattern, data)` ise cevap beklemeyen olay bildirimidir.

## Proje Yapısı

```text
mini-wfm/
├── .git/
├── .gitignore
├── README.md
├── docker-compose.yml
├── api/
│   ├── src/
│   │   ├── main.ts               # global prefix, ValidationPipe, Swagger
│   │   ├── app.module.ts         # ClientsModule (TCP client)
│   │   ├── constants.ts          # WORKFORCE_SERVICE token'ı
│   │   └── health/
│   │       └── health.controller.ts   # GET /api/health
│   ├── package.json
│   └── pnpm-lock.yaml
└── workforce-service/
    ├── src/
    │   ├── main.ts               # TCP microservice (4001)
    │   ├── app.module.ts         # ConfigModule, TypeOrmModule, HealthController
    │   ├── health/
    │   │   └── health.controller.ts   # @MessagePattern('ping')
    │   └── migrations/
    ├── package.json
    └── pnpm-lock.yaml
```

## Servisler

### API

Dış dünyaya açık HTTP API servisidir.

| | |
|---|---|
| Port | `3000` |
| Önek | `/api` |
| Swagger | `http://localhost:3000/docs` |
| Health | `http://localhost:3000/api/health` |

Çalıştırmak için:

```bash
cd ~/mini-wfm/api
pnpm run start:dev
```

### Workforce Service

Workforce işlemleri için oluşturulan TCP microservice'tir. HTTP üzerinden erişilemez; tarayıcıdan `localhost:4001` adresine girmek anlamsızdır.

| | |
|---|---|
| Transport | TCP |
| Port | `4001` |

Desteklenen mesaj pattern'leri:

| Pattern | Yanıt | Açıklama |
|---|---|---|
| `ping` | `pong` | Bağlantı testi |

Çalıştırmak için:

```bash
cd ~/mini-wfm/workforce-service
pnpm run start:dev
```

Başarılı açılışta terminalde `Nest microservice successfully started` görülür.

## Servisleri Birlikte Çalıştırma ve Test Etme

Sıra önemlidir: önce `workforce-service`, sonra `api` başlatılmalıdır. İki ayrı terminal kullanın.

```bash
# Terminal 1
cd ~/mini-wfm/workforce-service
pnpm run start:dev

# Terminal 2
cd ~/mini-wfm/api
pnpm run start:dev
```

Bağlantıyı doğrulamak için:

1. Tarayıcıda `http://localhost:3000/docs` adresini açın.
2. **health** grubunda `GET /api/health` endpoint'ini bulun.
3. **Try it out** → **Execute** adımlarını izleyin.
4. Yanıt `pong` olmalıdır.

### Sık karşılaşılan hatalar

| Hata | Olası neden |
|---|---|
| `ECONNREFUSED 127.0.0.1:4001` | `workforce-service` çalışmıyor veya port 4001 değil |
| `There is no matching message handler defined in the remote service` | `workforce-service` içindeki `HealthController` modülün `controllers` dizisine eklenmemiş veya pattern adı (`'ping'`) iki tarafta farklı |
| Swagger'da istek sonsuza kadar bekliyor | `api` tarafında `firstValueFrom` kullanılmamış; `send()` yalnızca abone olunduğunda mesajı gönderir |
| `Nest can't resolve dependencies of the HealthController` | `ClientsModule.register` içindeki `name` ile `@Inject` edilen token aynı değil |

## Kullanılan Teknolojiler

- Node.js 24 LTS
- pnpm
- NestJS (`@nestjs/microservices`, `@nestjs/swagger`, `@nestjs/config`)
- TypeScript
- class-validator ve class-transformer
- TypeORM ve PostgreSQL
- Swagger (OpenAPI)
- Git ve GitHub
- Docker Desktop
- DBeaver
- Postman

## NestJS Temel Dosyaları

### `main.ts`

NestJS uygulamasının başlangıç noktasıdır.

- `api` içinde `NestFactory.create` ile HTTP uygulaması oluşturulur; global prefix, `ValidationPipe` ve Swagger burada ayarlanır.
- `workforce-service` içinde `NestFactory.createMicroservice` ile TCP microservice oluşturulur.

### `app.module.ts`

Uygulamanın ana modülüdür. Controller, provider ve diğer modüllerin NestJS uygulamasına tanıtıldığı yerdir. Bir controller `controllers` dizisine eklenmediyse Nest onu görmez.

### `*.controller.ts`

- `api` içinde `@Controller` + `@Get` gibi dekoratörlerle gelen **HTTP isteklerini** karşılar.
- `workforce-service` içinde `@MessagePattern` ile gelen **TCP mesajlarını** karşılar.

### `constants.ts` (api)

TCP client'ın token'ını (`WORKFORCE_SERVICE`) tutar. `app.module.ts` ile controller arasında döngüsel import oluşmaması için ayrı bir dosyadadır.

## PostgreSQL Veritabanını Başlatma

PostgreSQL veritabanı Docker Compose ile çalıştırılmaktadır.

Öncelikle proje kök dizinine geçin:

```bash
cd ~/mini-wfm
```

PostgreSQL container'ını arka planda başlatmak için:

```bash
docker compose up -d
```

Container'ın çalıştığını kontrol etmek için:

```bash
docker ps
```

Başarılı durumda `mini-wfm-postgres` container'ı görünmelidir.

PostgreSQL bağlantı bilgileri:

```text
Host: localhost
Port: 5433
Database: mini_wfm
Username: postgres
Password: postgres
```

DBeaver veya başka bir veritabanı aracı ile bu bilgiler kullanılarak bağlantı kurulabilir.

PostgreSQL container'ını durdurmak ve kaldırmak için:

```bash
docker compose down
```

Bu komut container'ı kaldırır ancak Docker volume'ünü silmez. Bu nedenle veritabanı verileri korunur.

Veritabanını tekrar başlatmak için:

```bash
docker compose up -d
```

Container loglarını görmek için:

```bash
docker compose logs -f postgres
```

> Not: `docker compose down -v` komutu volume'leri de siler. Bu komut kullanılırsa PostgreSQL verileri kaybolabilir.

> Not: `workforce-service` açılırken veritabanına bağlanır ve migration'ları çalıştırır. Bu yüzden servisi başlatmadan önce veritabanı container'ının ayakta olduğundan emin olun.