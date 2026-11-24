import { Logger } from '@nestjs/common';
import { RpcException, TcpContext } from '@nestjs/microservices';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController (TCP okuma)', () => {
  const service = { findByWorkforceUser: jest.fn().mockResolvedValue([{ id: 1 }]) };
  const controller = new NotificationsController(service as unknown as NotificationsService);
  const context = new TcpContext([{} as never, 'findNotifications', { correlationId: 'abc-123' }] as never);

  beforeEach(() => jest.spyOn(Logger.prototype, 'log').mockImplementation());
  afterEach(() => jest.restoreAllMocks());

  it('personelin bildirimlerini döner ve correlation id loglanır', async () => {
    await expect(controller.findNotifications({ workforceUserId: 5 }, context)).resolves.toEqual([{ id: 1 }]);
    expect(service.findByWorkforceUser).toHaveBeenCalledWith(5);
  });

  it.each([0, -1, 1.5, '5', undefined])('geçersiz workforceUserId (%p) için 400', async (value) => {
    const error = await controller.findNotifications({ workforceUserId: value }, context).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RpcException);
    expect((error as RpcException).getError()).toMatchObject({ statusCode: 400 });
  });
});
