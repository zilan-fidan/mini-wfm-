import { CorrelationContextService } from './correlation-context.service';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('CorrelationContextService', () => {
  let service: CorrelationContextService;

  beforeEach(() => {
    service = new CorrelationContextService();
  });

  it('bağlam dışında undefined döner', () => {
    expect(service.getCorrelationId()).toBeUndefined();
  });

  it('run içinde verilen correlation id okunur', () => {
    service.run({ correlationId: 'abc-123', startedAt: 0 }, () => {
      expect(service.getCorrelationId()).toBe('abc-123');
    });
  });

  it('await sonrasında da aynı id okunur', async () => {
    await service.run({ correlationId: 'abc-123', startedAt: 0 }, async () => {
      await delay(5);
      expect(service.getCorrelationId()).toBe('abc-123');
    });
  });

  it('eşzamanlı isteklerin id değerleri birbirine karışmaz', async () => {
    const read = (id: string, ms: number) =>
      service.run({ correlationId: id, startedAt: 0 }, async () => {
        await delay(ms);
        return service.getCorrelationId();
      });

    // Önce başlayan daha geç biter; global değişkenle tutulsaydı ikisi de aynı değeri okurdu
    const [first, second] = await Promise.all([
      read('istek-1', 30),
      read('istek-2', 10),
    ]);

    expect(first).toBe('istek-1');
    expect(second).toBe('istek-2');
  });

  it('callback dönüş değerini aynen döndürür ve run bitince bağlam kapanır', () => {
    const result = service.run({ correlationId: 'abc-123', startedAt: 0 }, () => 42);

    expect(result).toBe(42);
    expect(service.getCorrelationId()).toBeUndefined();
  });
});
