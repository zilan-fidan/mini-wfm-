import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { TeamsController } from './teams.controller';
import { CreateTeamShiftsDto } from './dto/create-team-shifts.dto';

describe('Ekip vardiyası API', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const body = { startAt: '2099-01-01T08:00:00Z', endAt: '2099-01-01T16:00:00Z', note: 'Toplu' };

  it('tarih ve notu ekip ID ile RPC servisine gönderir', async () => {
    const dto = await pipe.transform(body, { type: 'body', metatype: CreateTeamShiftsDto });
    const send = jest.fn(() => of([]));
    const controller = new TeamsController({ send } as unknown as ClientProxy);
    controller.createShifts(7, dto);
    expect(send).toHaveBeenCalledWith('createTeamShifts', { teamId: 7, ...body });
  });

  it.each([{ ...body, startAt: 'hatalı' }, { endAt: body.endAt }, { ...body, note: 'a'.repeat(501) }])('geçersiz gövdeyi reddeder', async (invalid) => {
    await expect(pipe.transform(invalid, { type: 'body', metatype: CreateTeamShiftsDto })).rejects.toBeInstanceOf(BadRequestException);
  });
});
