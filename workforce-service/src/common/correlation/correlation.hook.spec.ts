import { ExecutionContext } from '@nestjs/common';
import { defer, lastValueFrom, of, throwError } from 'rxjs';
import { CorrelationContextService } from './correlation-context.service';
import { createCorrelationHook } from './correlation.hook';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('createCorrelationHook', () => {
  let context: CorrelationContextService;
  let hook: ReturnType<typeof createCorrelationHook>;

  const createContext = (metadata?: Record<string, string>) =>
    ({
      switchToRpc: () => ({ getContext: () => ({ getMetadata: () => metadata }) }),
    }) as unknown as ExecutionContext;

  // defer: id, handler'ın gerçekten çalıştığı subscribe anında okunur.
  // Hook run(store, () => next()) şeklinde yanlış yazılırsa bu okuma bağlam dışında kalır.
  const readIdInsideHook = (metadata?: Record<string, string>) =>
    lastValueFrom(
      hook(createContext(metadata), () => defer(() => of(context.getCorrelationId()))),
    );

  beforeEach(() => {
    context = new CorrelationContextService();
    hook = createCorrelationHook(context);
  });

  it('metadata\'daki correlation id handler bağlamında okunur', async () => {
    await expect(readIdInsideHook({ correlationId: 'abc-123' })).resolves.toBe('abc-123');
  });

  it('metadata yoksa UUID üretilir', async () => {
    await expect(readIdInsideHook(undefined)).resolves.toMatch(UUID_PATTERN);
  });

  it.each([
    ['satır sonu içeren', 'abc\nsahte'],
    ['boş', ''],
    ['129 karakter', 'a'.repeat(129)],
  ])('%s correlation id kullanılmaz, UUID üretilir', async (_, value) => {
    await expect(readIdInsideHook({ correlationId: value })).resolves.toMatch(UUID_PATTERN);
  });

  it('metadata\'da correlationId anahtarı yoksa UUID üretilir', async () => {
    await expect(readIdInsideHook({ tenant: 'acme' })).resolves.toMatch(UUID_PATTERN);
  });

  it('akış bitince bağlam kapanır', async () => {
    await readIdInsideHook({ correlationId: 'abc-123' });

    expect(context.getCorrelationId()).toBeUndefined();
  });

  it('handler hatası aynen iletilir', async () => {
    const error = new Error('boom');

    await expect(
      lastValueFrom(hook(createContext(), () => throwError(() => error))),
    ).rejects.toBe(error);
  });
});
