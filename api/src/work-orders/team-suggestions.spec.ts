import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { WorkOrdersController } from './work-orders.controller';
import { ROLES_KEY, Role } from '../auth/decorators/roles.decorator';

describe('Ekip önerisi API', () => {
  it('ID ile suggestTeamsForWorkOrder RPC desenine gönderir', () => {
    const send = jest.fn(() => of({}));
    new WorkOrdersController({ send } as unknown as ClientProxy).suggestTeams(7);
    expect(send).toHaveBeenCalledWith('suggestTeamsForWorkOrder', 7);
  });

  it('yalnızca ADMIN ve PLANNER çağırabilir', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, WorkOrdersController.prototype.suggestTeams);
    expect(roles).toEqual([Role.ADMIN, Role.PLANNER]);
  });
});
