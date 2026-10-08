# Mini WFM

Mini WFM, tek bir Git reposu içerisinde iki ayrı NestJS uygulaması barındıran başlangıç seviyesinde bir Workforce Management projesidir.

## Mevcut Durum

Projenin temel geliştirme ortamı hazırlanmıştır.

Şu ana kadar:

- Node.js LTS kurulmuştur.
- pnpm kurulmuştur.
- Nest CLI kurulmuştur.
- Docker Desktop kurulmuştur.
- Git kurulmuş ve proje için tek bir repository oluşturulmuştur.
- `mini-wfm` ana klasörü oluşturulmuştur.
- `api` ve `workforce-service` olmak üzere iki ayrı NestJS projesi oluşturulmuştur.
- Her iki projede paket yöneticisi olarak `pnpm` kullanılmaktadır.
- Alt projelerin kendi Git repository'leri oluşturulmamıştır.
- Her iki proje aynı ana Git repository altında tutulmaktadır.
- `api` servisi `3000` portunda çalışmaktadır.
- `workforce-service` servisi `3001` portunda çalışmaktadır.
- Her iki servis aynı anda çalıştırılıp test edilmiştir.
- `http://localhost:3000` ve `http://localhost:3001` adreslerinde `Hello World!` çıktısı doğrulanmıştır.
- `.gitignore` dosyası hazırlanmıştır.
- `node_modules`, `dist`, `.env` ve TypeScript build cache dosyaları Git takibinden çıkarılmıştır.
- İlk proje kurulumu Git commit'i oluşturulmuştur.

## Proje Yapısı

```text
mini-wfm/
├── .git/
├── .gitignore
├── README.md
├── api/
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── app.controller.ts
│   │   └── app.service.ts
│   ├── package.json
│   └── pnpm-lock.yaml
└── workforce-service/
    ├── src/
    │   ├── main.ts
    │   ├── app.module.ts
    │   ├── app.controller.ts
    │   └── app.service.ts
    ├── package.json
    └── pnpm-lock.yaml
```

## Servisler

### API

Ana HTTP API servisidir.

Port:

```text
3000
```

Çalıştırmak için:

```bash
cd ~/mini-wfm/api
pnpm run start:dev
```

Adres:

```text
http://localhost:3000
```

### Workforce Service

Workforce işlemleri için oluşturulan ikinci NestJS servisidir.

Şimdilik HTTP üzerinden çalışmaktadır. İlerleyen aşamalarda TCP microservice yapısına dönüştürülecektir.

Port:

```text
3001
```

Çalıştırmak için:

```bash
cd ~/mini-wfm/workforce-service
pnpm run start:dev
```

Adres:

```text
http://localhost:3001
```

## Kullanılan Teknolojiler

- Node.js 24 LTS
- npm
- pnpm
- NestJS
- TypeScript
- Git
- GitHub
- Docker Desktop
- DBeaver
- Postman

## NestJS Temel Dosyaları

### `main.ts`

NestJS uygulamasının başlangıç noktasıdır.

`NestFactory` kullanılarak uygulama oluşturulur ve belirlenen port üzerinden çalıştırılır.

### `app.module.ts`

Uygulamanın ana modülüdür.

Controller, service ve diğer modüllerin NestJS uygulamasına tanıtıldığı yerdir.

### `app.controller.ts`

Gelen HTTP isteklerini karşılayan kat