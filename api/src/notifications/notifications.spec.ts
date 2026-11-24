import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { ROLES_KEY, Role } from '../auth/decorators/roles.decorator';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationsController } from './notifications.controller';

describe('Bildirim listesi API', () => {
  const send = jest.fn(() => of([]));
  const controller = new NotificationsController({ send } as unknown as ClientProxy);
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const run = async (query: Record<string, string>) => {
    const dto = await pipe.transform(query, { type: 'query', metatype: ListNotificationsQueryDto });
    return controller.findAll(dto);
  };

  beforeEach(() => send.mockClear());

  it('workforceUserId sayıya çevrilip notification-service\'e gönderilir', async () => {
    await run({ workforceUserId: '5' });
    expect(send).toHaveBeenCalledWith('findNotifications', { workforceUserId: 5 });
  });

  it.each([{}, { workforceUserId: 'abc' }, { workforceUserId: '0' }, { workforceUserId: '-1' }, { workforceUserId: '1.5' }])(
    'geçersiz sorgu 400: %j',
    async (query) => {
      await expect(run(query as Record<string, string>)).rejects.toBeInstanceOf(BadRequestException);
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('ADMIN, PLANNER ve VIEWER okuyabilir', () => {
    expect(Reflect.getMetadata(ROLES_KEY, NotificationsController.prototype.findAll)).toEqual([
      Role.ADMIN,
      Role.PLANNER,
      Role.VIEWER,
    ]);
  });
});
