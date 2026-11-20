import { BadRequestException, ParseIntPipe, ValidationPipe } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { WorkforceUsersController } from './workforce-users.controller';
import { TimesheetQueryDto } from './dto/timesheet-query.dto';

describe('Personel aylık puantaj API', () => {
  const send = jest.fn(() => of({}));
  const controller = new WorkforceUsersController({ send } as unknown as ClientProxy);
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const run = async (id: string, query: Record<string, string>) => {
    const parsedId = await new ParseIntPipe().transform(id, { type: 'param', data: 'id' });
    const dto = await pipe.transform(query, { type: 'query', metatype: TimesheetQueryDto });
    return controller.getTimesheet(parsedId, dto);
  };
  beforeEach(() => send.mockClear());

  it('personel ID ve ayı servise iletir', async () => {
    await run('5', { month: '2026-11' });
    expect(send).toHaveBeenCalledWith('getWorkforceUserTimesheet', { workforceUserId: 5, month: '2026-11' });
  });

  it.each<[string, Record<string, string>]>([
    ['1', {}],
    ['1', { month: '2026-13' }],
    ['1', { month: '2026-00' }],
    ['1', { month: '2026-1' }],
    ['1', { month: '2026-11-01' }],
    ['1', { month: 'kasım' }],
    ['abc', { month: '2026-11' }],
    ['0', { month: '2026-11' }],
    ['-3', { month: '2026-11' }],
  ])('geçersiz istek 400: id=%s %j', async (id, query) => {
    await expect(run(id, query)).rejects.toBeInstanceOf(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });
});
