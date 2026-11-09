import { ClientTCP, ReadPacket } from '@nestjs/microservices';
import { CorrelationContextService } from './correlation-context.service';
import { createCorrelationDispatchHook } from './correlation-dispatch.hook';

describe('createCorrelationDispatchHook', () => {
  let correlation: CorrelationContextService;
  let hook: (packet: ReadPacket) => void;

  const createPacket = (): ReadPacket => ({
    pattern: 'createTeam',
    data: { name: 'Backend Ekibi' },
  });

  beforeEach(() => {
    correlation = new CorrelationContextService();
    hook = createCorrelationDispatchHook(correlation);
  });

  it('istek bağlamındaki correlation id paketin metadata alanına yazılır', () => {
    const packet = createPacket();

    correlation.run({ correlationId: 'abc-123', startedAt: 0 }, () => hook(packet));

    expect(packet.metadata).toEqual({ correlationId: 'abc-123' });
  });

  it('pattern ve iş verisi değişmez', () => {
    const packet = createPacket();

    correlation.run({ correlationId: 'abc-123', startedAt: 0 }, () => hook(packet));

    expect(packet.pattern).toBe('createTeam');
    expect(packet.data).toEqual({ name: 'Backend Ekibi' });
  });

  it('paketteki mevcut metadata korunur', () => {
    const packet = { ...createPacket(), metadata: { tenant: 'acme' } };

    correlation.run({ correlationId: 'abc-123', startedAt: 0 }, () => hook(packet));

    expect(packet.metadata).toEqual({ tenant: 'acme', correlationId: 'abc-123' });
  });

  it('istek bağlamı yoksa metadata eklenmez', () => {
    const packet = createPacket();

    hook(packet);

    expect(packet.metadata).toBeUndefined();
  });

  it('ClientTCP hook\'u her giden pakette çağırır (Nest entegrasyonu)', () => {
    const client = new ClientTCP({});
    client.setOnDispatchHook(hook);

    // createPacket protected: send() içinde paket bu metotla üretilir
    const packet = correlation.run({ correlationId: 'abc-123', startedAt: 0 }, () =>
      (client as unknown as { createPacket: (p: unknown, d: unknown) => ReadPacket })
        .createPacket('findOneTeam', 5),
    );

    expect(packet).toEqual({
      pattern: 'findOneTeam',
      data: 5,
      metadata: { correlationId: 'abc-123' },
    });
  });
});
