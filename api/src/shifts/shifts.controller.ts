import {BadRequestException,Query,Body,Controller,Delete, Get,Inject,Param,ParseIntPipe,Patch,Post,} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {ApiBadRequestResponse,ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse,ApiNotFoundResponse,ApiOkResponse, ApiOperation, ApiParam,ApiTags,ApiUnauthorizedResponse,ApiForbiddenResponse,} from '@nestjs/swagger';
import { defaultIfEmpty, map } from 'rxjs';
import { WORKFORCE_SERVICE } from '../constants';
import { Roles, Role } from '../auth/decorators/roles.decorator';
import { CreateShiftDto } from './dto/create-shift.dto';
import { ListShiftsDto } from './dto/list-shifts.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';

@ApiTags('shifts')
@ApiBearerAuth('access-token')
@Controller('shifts')
export class ShiftsController {
  constructor(
    @Inject(WORKFORCE_SERVICE)
    private readonly client: ClientProxy,
  ) {}

  @Roles(Role.ADMIN, Role.PLANNER, Role.VIEWER)
  @Get()
  @ApiOperation({ summary: 'Tarih aralığıyla kesişen vardiyaları listeler' })
  @ApiOkResponse({ description: 'Başlangıç tarihine göre sıralı, personel ve ekip bilgili liste' })
  @ApiBadRequestResponse({ description: 'Geçersiz filtre veya 31 günü aşan aralık' })
  findAll(@Query() query: ListShiftsDto) {
    const duration = Date.parse(query.to) - Date.parse(query.from);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 31 * 86400000) {
      throw new BadRequestException('Tarih aralığı pozitif olmalı ve 31 günü aşmamalıdır');
    }
    return this.client.send('findAllShifts', query);
  }

  // 1. VARDİYA OLUŞTURMA
  @Roles(Role.ADMIN, Role.PLANNER)
  @Post()
  @ApiOperation({
    summary: 'Yeni vardiya oluşturur',
    description: 'Yetkili roller: ADMIN, PLANNER',
  })
  @ApiCreatedResponse({ description: 'Vardiya oluşturuldu' })
  @ApiBadRequestResponse({
    description: 'Geçersiz tarih veya vardiya süresi',
  })
  @ApiNotFoundResponse({ description: 'Personel bulunamadı' })
  @ApiConflictResponse({
    description: 'Geçmiş tarih, pasif personel veya vardiya çakışması',
  })
  @ApiUnauthorizedResponse({ description: 'Token eksik veya geçersiz' })
  @ApiForbiddenResponse({ description: 'Bu işlem için yetkiniz yok' })
  create(@Body() dto: CreateShiftDto) {
    return this.client.send('createShift', dto);
  }

  // 2. VARDİYA DETAYI
  @Roles(Role.ADMIN, Role.PLANNER, Role.VIEWER)
  @Get(':id')
  @ApiOperation({
    summary: 'Vardiya detayını getirir',
    description: 'Yetkili roller: ADMIN, PLANNER, VIEWER',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Vardiya bulundu' })
  @ApiBadRequestResponse({ description: 'Geçersiz vardiya ID değeri' })
  @ApiNotFoundResponse({ description: 'Vardiya bulunamadı' })
  @ApiUnauthorizedResponse({ description: 'Token eksik veya geçersiz' })
  @ApiForbiddenResponse({ description: 'Bu işlem için yetkiniz yok' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.client.send('findOneShift', id);
  }

  // 3. VARDİYA GÜNCELLEME
  @Roles(Role.ADMIN, Role.PLANNER)
  @Patch(':id')
  @ApiOperation({
    summary: 'Vardiyayı günceller',
    description: 'Yetkili roller: ADMIN, PLANNER',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Vardiya güncellendi' })
  @ApiBadRequestResponse({
    description: 'Geçersiz tarih, süre veya vardiya ID değeri',
  })
  @ApiNotFoundResponse({
    description: 'Vardiya veya personel bulunamadı',
  })
  @ApiConflictResponse({
    description: 'Geçmiş vardiya, pasif personel veya çakışma',
  })
  @ApiUnauthorizedResponse({ description: 'Token eksik veya geçersiz' })
  @ApiForbiddenResponse({ description: 'Bu işlem için yetkiniz yok' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShiftDto,
  ) {
    return this.client.send('updateShift', {
      id,
      data: dto,
    });
  }

  // 4. VARDİYA SİLME
  @Roles(Role.ADMIN, Role.PLANNER)
  @Delete(':id')
  @ApiOperation({
    summary: 'Vardiyayı siler',
    description: 'Yetkili roller: ADMIN, PLANNER',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Vardiya silindi' })
  @ApiBadRequestResponse({ description: 'Geçersiz vardiya ID değeri' })
  @ApiNotFoundResponse({ description: 'Vardiya bulunamadı' })
  @ApiConflictResponse({
    description: 'Geçmişte başlamış vardiya silinemez',
  })
  @ApiUnauthorizedResponse({ description: 'Token eksik veya geçersiz' })
  @ApiForbiddenResponse({ description: 'Bu işlem için yetkiniz yok' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.client.send('removeShift', id).pipe(
      defaultIfEmpty(null),
      map(() => undefined),
    );
  }
}
