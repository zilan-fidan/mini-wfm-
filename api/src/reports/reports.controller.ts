import { BadRequestException, Controller, Get, Inject, Query } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {ApiBadRequestResponse,ApiBearerAuth,ApiForbiddenResponse,ApiOkResponse,ApiOperation,ApiTags,ApiUnauthorizedResponse,} from '@nestjs/swagger';
import { WORKFORCE_SERVICE } from '../constants';
import { Role, Roles } from '../auth/decorators/roles.decorator';
import { TeamSummaryQueryDto } from './dto/team-summary-query.dto';

const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;

@ApiTags('reports')
@ApiBearerAuth('access-token')
@Controller('reports')
export class ReportsController {
  constructor(
    @Inject(WORKFORCE_SERVICE)
    private readonly client: ClientProxy,
  ) {}

  @Roles(Role.ADMIN, Role.PLANNER, Role.VIEWER)
  @Get('team-summary')
  @ApiOperation({
    summary: 'Ekip bazlı özet rapor',
    description:
      'Yetkili roller: ADMIN, PLANNER, VIEWER. Her ekip için bir satır döner (verisi olmayan ekipler 0 ile). ' +
      'İş emirleri: dueAt değeri [from, to) aralığında olanlar, durumlara göre sayılır; geciken = dueAt geçmiş ve kapanmamış. ' +
      'Vardiya saati: ekip üyelerinin vardiyalarının yalnızca aralık içinde kalan kısmı.',
  })
  @ApiOkResponse({ description: '{ from, to, teams: [{ teamId, teamName, activeMemberCount, workOrders, shiftHours }] }' })
  @ApiBadRequestResponse({ description: 'Geçersiz tarih veya 31 günü aşan aralık' })
  @ApiUnauthorizedResponse({ description: 'Token eksik veya geçersiz' })
  @ApiForbiddenResponse({ description: 'Bu işlem için yetkiniz yok' })
  getTeamSummary(@Query() query: TeamSummaryQueryDto) {
    const duration = Date.parse(query.to) - Date.parse(query.from);
    if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_RANGE_MS) {
      throw new BadRequestException('Tarih aralığı pozitif olmalı ve 31 günü aşmamalıdır');
    }
    return this.client.send('getTeamSummaryReport', { from: query.from, to: query.to });
  }
}
