import { Controller, INestMicroservice, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  ClientTCP,
  MessagePattern,
  Payload,
  RpcException,
  Transport,
} from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';
import { CorrelationContextService } from './correlation-context.service';
import { createCorrelationHook } from './correlation.hook';
import { CorrelationModule } from './correlation.module';
import { RpcLoggingInterceptor } from './rpc-logging.interceptor';

const PORT = 4911;

@Controller()
class EchoController {
  constructor(private readonly correlation: CorrelationContextService) {}

  // Handler'ın gördüğü payload ve bağlamdaki id birlikte döner
  @MessagePattern('echo')
  async echo(@Payload() payload: unknown) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { payload, correlationId: this.correlation.getCorrelationId() };
  }

  @MessagePattern('conflict')
  conflict() {
    throw new RpcException({ statusCode: 409, message: 'Çakışma' });
  }
}

@Module({
  imports: [CorrelationModule],
  controllers: [EchoController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: RpcLoggingInterceptor }],
})
class EchoModule {}

// Gerçek TCP soketi üzerinden: api'nin dispatch hook'u → paket metadata'sı → pre-request hook → ALS
describe('Correlation id TCP üzerinden (entegrasyon)', () => {
  let app: INestMicroservice;
  let client: ClientTCP;
  let sendWithId: (pattern: string, data: unknown, id?: string) => Promise<unknown>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [EchoModule] }).compile();
    app = moduleRef.createNestMicroservice({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: PORT },
    });
    app.useLogger(false);
    app.registerPreRequestHook(createCorrelationHook(app.get(CorrelationContextService)));
    await app.listen();

    // api'yi taklit eder: tek client, tek dispatch hook; id client tarafındaki ALS'den okunur
    // (api'deki createCorrelationDispatchHook ile aynı mantık)
    const apiContext = new CorrelationContextService();
    client = new ClientTCP({ host: '127.0.0.1', port: PORT });
    client.setOnDispatchHook((packet) => {
      const correlationId = apiContext.getCorrelationId();
      if (correlationId) packet.metadata = { correlationId };
    });
    sendWithId = (pattern, data, id) => {
      const send = () => firstValueFrom(client.send(pattern, data));
      return id ? apiContext.run({ correlationId: id, startedAt: 0 }, send) : send();
    };
  });

  afterAll(async () => {
    client.close();
    await app.close();
  });

  it('metadata ile gelen id handler bağlamında okunur, payload değişmez', async () => {
    await expect(sendWithId('echo', { name: 'Backend Ekibi' }, 'abc-123')).resolves.toEqual({
      payload: { name: 'Backend Ekibi' },
      correlationId: 'abc-123',
    });
  });

  it('düz sayı payload (findOneTeam gibi) aynen ulaşır', async () => {
    await expect(sendWithId('echo', 5, 'abc-123')).resolves.toEqual({
      payload: 5,
      correlationId: 'abc-123',
    });
  });

  it('metadata yoksa servis kendi UUID\'sini üretir', async () => {
    const result = (await sendWithId('echo', {}, undefined)) as { correlationId: string };

    expect(result.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('iş kuralı hatası api\'ye aynen ulaşır', async () => {
    await expect(sendWithId('conflict', {}, 'abc-123')).rejects.toEqual({
      statusCode: 409,
      message: 'Çakışma',
    });
  });

  it('aynı client üzerinden eşzamanlı mesajların id değerleri karışmaz', async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `istek-${i}`);

    // Hepsi aynı anda, aynı soketten gider; her biri kendi ALS bağlamından id alır
    const results = await Promise.all(ids.map((id) => sendWithId('echo', id, id)));

    results.forEach((result, i) => {
      expect(result).toEqual({ payload: ids[i], correlationId: ids[i] });
    });
  });
});
