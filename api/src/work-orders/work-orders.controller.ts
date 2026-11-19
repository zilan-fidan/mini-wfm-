import {Body, Controller,Get,Inject,Param, ParseIntPipe,Patch,Post,Query,} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBadRequestResponse,ApiBearerAuth, ApiConflictResponse,ApiCreatedResponse,ApiForbiddenResponse,ApiNotFoundResponse,ApiOkResponse,ApiOperation, ApiParam, ApiTags, ApiUnauthorizedResponse,} from '@nestjs/swagger';
import { WORKFORCE_SERVICE } from '../constants';
import {Roles, Role,} from '../auth/decorators/roles.decorator';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { ChangeWorkOrderStatusDto } from './dto/change-work-order-status.dto';
import { ListWorkOrdersQueryDto } from './dto/list-work-orders-query.dto';

@ApiTags('work-orders')
@ApiBearerAuth('access-token')
@Controller('work-orders')
export class WorkOrdersController {
  constructor(
    @Inject(WORKFORCE_SERVICE)
    private readonly client: ClientProxy,
  ) {}

  // ==========================================
  // 1. İŞ EMRİ OLUŞTURMA
  // ==========================================

  @Roles(Role.ADMIN, Role.PLANNER)
  @Post()
  @ApiOperation({summary: 'Yeni iş emri oluşturur',description: 'Yetkili roller: ADMIN, PLANNER',})
  @ApiCreatedResponse({description: 'İş emri oluşturuldu',})
  @ApiBadRequestResponse({description: 'Geçersiz veri veya geçmiş bitiş tarihi',})
  @ApiNotFoundResponse({ description: 'Ekip bulunamadı',})
  @ApiUnauthorizedResponse({ description: 'Token eksik veya geçersiz',})
  @ApiForbiddenResponse({ description: 'Bu işlem için yetkiniz yok',})
  create(@Body() dto: CreateWorkOrderDto) {
    return this.client.send('createWorkOrder', dto);
  }

  // ==========================================
  // İŞ EMRİ LİSTESİ
  // ==========================================

  @Roles(Role.ADMIN, Role.PLANNER, Role.VIEWER)
  @Get()
  @ApiOperation({
    summary: 'İş emirlerini filtreli, sıralı ve sayfalı listeler',
    description:
      'Yetkili roller: ADMIN, PLANNER, VIEWER. ' +
      'status birden fazla verilebilir (?status=OPEN&status=ASSIGNED). ' +
      'priority sıralaması önem sırasına göredir (URGENT > HIGH > MEDIUM > LOW). ' +
      'Varsayılan sıralama: createdAt desc.',
  })
  @ApiOkResponse({ description: 'İş emri listesi; her kayıtta team (id, name) ve isOverdue bulunur' })
  @ApiBadRequestResponse({ description: 'Geçersiz query parametresi (ör. izin verilmeyen sortBy)' })
  @ApiUnauthorizedResponse({ description: 'Token eksik veya geçersiz' })
  @ApiForbiddenResponse({ description: 'Bu işlem için yetkiniz yok' })
  findAll(@Query() query: ListWorkOrdersQueryDto) {
    return this.client.send('findAllWorkOrders', query);
  }

  // ==========================================
  // 2. İŞ EMRİ DETAYI
  // ==========================================

  @Roles(Role.ADMIN, Role.PLANNER, Role.VIEWER)
  @Get(':id')
  @ApiOperation({summary: 'İş emri detayını getirir', description: 'Yetkili roller: ADMIN, PLANNER, VIEWER',})
  @ApiParam({ name: 'id', type: Number,example: 1,})
  @ApiOkResponse({description: 'İş emri bulundu',})
  @ApiBadRequestResponse({ description: 'Geçersiz iş emri ID değeri',})
  @ApiNotFoundResponse({description: 'İş emri bulunamadı',})
  @ApiUnauthorizedResponse({ description: 'Token eksik veya geçersiz',})
  @ApiForbiddenResponse({ description: 'Bu işlem için yetkiniz yok',})
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.client.send('findOneWorkOrder', id);
  }

  // ==========================================
  // 3. İŞ EMRİ GÜNCELLEME
  // ==========================================

  @Roles(Role.ADMIN, Role.PLANNER)
  @Patch(':id')
  @ApiOperation({
    summary: 'İş emrinin temel bilgilerini günceller',
    description:
      'Yetkili roller: ADMIN, PLANNER. ' +
      'Yalnızca title, description, priority ve dueAt güncellenebilir.',
  })
  @ApiParam({ name: 'id',type: Number,example: 1,})
  @ApiOkResponse({ description: 'İş emri güncellendi',})
  @ApiBadRequestResponse({ description: 'Geçersiz veri veya geçmiş bitiş tarihi',})
  @ApiNotFoundResponse({description: 'İş emri bulunamadı',})
  @ApiConflictResponse({ description: 'Kapanmış iş emri güncellenemez veya version güncel değil' })
  @ApiUnauthorizedResponse({ description: 'Token eksik veya geçersiz',})
  @ApiForbiddenResponse({ description: 'Bu işlem için yetkiniz yok',})
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkOrderDto,
  ) {
    return this.client.send('updateWorkOrder', {
      id,
      version: dto.version,
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && {
          description: dto.description,
        }),
        ...(dto.priority !== undefined && {
          priority: dto.priority,
        }),
        ...(dto.dueAt !== undefined && { dueAt: dto.dueAt }),
      },
    });
  }

@Patch(':id/status')
@Roles(Role.ADMIN, Role.PLANNER)
@ApiOperation({ summary: 'İş emrinin durumunu değiştirir',})
@ApiOkResponse({description: 'İş emrinin durumu başarıyla güncellendi',})
@ApiBadRequestResponse({description: 'Geçersiz durum, ekip ID veya iptal nedeni',})
@ApiConflictResponse({ description: 'İzin verilmeyen durum geçişi veya version güncel değil' })
@ApiForbiddenResponse({description: 'Bu durum geçişi için yetki yok',})
changeStatus(
  @Param('id', ParseIntPipe) id: number,
  @Body() dto: ChangeWorkOrderStatusDto,
) {
  return this.client.send('changeWorkOrderStatus', {
    id,
    version: dto.version,
    status: dto.status,
    teamId: dto.teamId,
    reason: dto.reason,
  });
}

@Get(':id/history')
@Roles(Role.ADMIN, Role.PLANNER, Role.VIEWER)
@ApiOperation({ summary: 'İş emrinin durum geçmişini listeler',})
@ApiOkResponse({description: 'Durum geçmişi eskiden yeniye sıralı döner'})
@ApiNotFoundResponse({description: 'İş emri bulunamadı',})
findHistory(
  @Param('id', ParseIntPipe) id: number,
) {
  return this.client.send('findWorkOrderHistory', id);
}

}
  