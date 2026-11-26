import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { ReportsController } from './reports.controller';
import { TeamSummaryQueryDto } from './dto/team-summary-query.dto';

describe('Ekip özet raporu API', () => {
  const send = jest.fn(() => of({}));
  const controller = new ReportsController({ send } as unknown as ClientProxy);
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const run = async (query: Record<string, string>) => {
    const dto = await pipe.transform(query, { type: 'query', metatype: TeamSummaryQueryDto });
    return controller.getTeamSummary(dto);
  };
  beforeEach(() => send.mockClear());

  it('aralığı servise iletir', async () => {
    await run({ from: '2026-11-01T00:00:00+03:00', to: '2026-11-08T00:00:00+03:00' });
    expect(send).toHaveBeenCalledWith('getTeamSummaryReport', {
      from: '2026-11-01T00:00:00+03:00',
      to: '2026-11-08T00:00:00+03:00',
    });
  });

  it('tam 31 günü kabul eder', async () => {
    await run({ from: '2026-11-01', to: '2026-12-02' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each<Record<string, string>>([
    {},
    { from: '2026-11-01' },
    { to: '2026-11-02' },
    { from: 'dün', to: '2026-11-02' },
    { from: '2026-02-30', to: '2026-03-02' },
    { from: '2026-11-02', to: '2026-11-01' },
    { from: '2026-11-01', to: '2026-11-01' },
    { from: '2026-11-01', to: '2026-12-03' },
  ])('geçersiz sorguyu 400 ile reddeder: %j', async (query) => {
    await expect(run(query)).rejects.toBeInstanceOf(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });
});
