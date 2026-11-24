import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {ApiBadRequestResponse,ApiBearerAuth,ApiForbiddenResponse, ApiOkResponse,ApiOperation,ApiServiceUnavailableResponse,ApiTags,ApiUnauthorizedResponse,} from '@nestjs/swagger';
import { NOTIFICATION_SERVICE } from '../constants';
import { Role, Roles } from '../auth/decorators/roles.decorator';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';

// Okuma workforce-service'e değil, doğrudan notification-service'e (TCP) gider
@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(
    @Inject(NOTIFICATION_SERVICE)
    private readonly client: ClientProxy,
  ) {}

  @Roles(Role.ADMIN, Role.PLANNER, Role.VIEWER)
  @Get()
  @ApiOperation({
    summary: 'Personelin bildirimlerini listeler',
    description: 'Yetkili roller: ADMIN, PLANNER, VIEWER. En yeni 100 bildirim, yeniden eskiye.',
  })
  @ApiOkResponse({ description: 'Bildirim listesi' })
  @ApiBadRequestResponse({ description: 'workforceUserId eksik veya geçersiz' })
  @ApiUnauthorizedResponse({ description: 'Token eksik veya geçersiz' })
  @ApiForbiddenResponse({ description: 'Bu işlem için yetkiniz yok' })
  @ApiServiceUnavailableResponse({ description: 'notification-service çalışmıyor' })
  findAll(@Query() query: ListNotificationsQueryDto) {
    return this.client.send('findNotifications', { workforceUserId: query.workforceUserId });
  }
}
