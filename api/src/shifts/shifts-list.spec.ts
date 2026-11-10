import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { ShiftsController } from './shifts.controller';
import { ListShiftsDto } from './dto/list-shifts.dto';

describe('Vardiya listesi query doğrulaması', () => {
  const send = jest.fn(() => of([]));
  const controller = new ShiftsController({ send } as unknown as ClientProxy);
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const run = async (query: Record<string, string>) => {
    const dto = await pipe.transform(query, { type: 'query', metatype: ListShiftsDto });
    return controller.findAll(dto);
  };
  beforeEach(() => send.mockClear());

  it('filtreleri sayıya dönüştürür ve birlikte iletir', async () => {
    await run({ from: '2026-11-12T00:00:00+03:00', to: '2026-11-13T00:00:00+03:00', workforceUserId: '1', teamId: '2' });
    expect(send).toHaveBeenCalledWith('findAllShifts', expect.objectContaining({ workforceUserId: 1, teamId: 2 }));
  });

  it.each<Record<string, string>>([
    {},
    { from: '2026-11-01' },
    { from: 'invalid', to: '2026-11-02' },
    { from: '2026-02-30', to: '2026-03-02' },
    { from: '2026-11-01', to: '2026-12-11' },
    { from: '2026-11-02', to: '2026-11-01' },
    { from: '2026-11-01', to: '2026-11-01' },
    { from: '2026-11-01', to: '2026-11-02', teamId: '0' },
    { from: '2026-11-01', to: '2026-11-02', workforceUserId: '1.5' },
  ])('geçersiz sorguyu 400 ile reddeder: %j', async (query) => {
    await expect(run(query)).rejects.toBeInstanceOf(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });

  it('tam 31 günü kabul eder', async () => {
    await run({ from: '2026-11-01', to: '2026-12-02' });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
