
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { defaultIfEmpty, map } from 'rxjs';

import { WORKFORCE_SERVICE } from '../constants';
import { Roles, Role } from '../auth/decorators/roles.decorator';

import { CreateWorkforceUserDto } from './dto/create-workforce-user.dto';
import { ListWorkforceUsersQueryDto } from './dto/list-workforce-users-query.dto';
import { UpdateWorkforceUserDto } from './dto/update-workforce-user.dto';

@ApiTags('workforce-users')
@ApiBearerAuth('access-token')
@Controller('workforce-users')
export class WorkforceUsersController {
  constructor(
    @Inject(WORKFORCE_SERVICE)
    private readonly client: ClientProxy,
  ) {}

  // 1. PERSONEL OLUŞTURMA - YALNIZCA ADMIN
  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({
    summary: 'Yeni personel oluşturur',
    description: 'Yetkili roller: ADMIN',
  })
  @ApiCreatedResponse({ description: 'Personel oluşturuldu' })
  @ApiBadRequestResponse({ description: 'Geçersiz veri' })
  @ApiConflictResponse({
    description: 'Bu sicil numarasıyla bir personel zaten var',
  })
  create(@Body() dto: CreateWorkforceUserDto) {
    return this.client.send('createWorkforceUser', dto);
  }

  // 2. PERSONEL LİSTELEME - TÜM ROLLER
  @Roles(Role.ADMIN, Role.PLANNER, Role.VIEWER)
  @Get()
  @ApiOperation({
    summary: 'Personelleri sayfalı olarak listeler',
    description: 'Yetkili roller: ADMIN, PLANNER, VIEWER',
  })
  @ApiOkResponse({ description: 'Personel listesi' })
  @ApiBadRequestResponse({
    description: 'Geçersiz query parametresi',
  })
  findAll(@Query() query: ListWorkforceUsersQueryDto) {
    return this.client.send('findAllWorkforceUsers', query);
  }

  // 3. PERSONEL DETAYI - TÜM ROLLER
  @Roles(Role.ADMIN, Role.PLANNER, Role.VIEWER)
  @Get(':id')
  @ApiOperation({
    summary: 'Personel detayını getirir',
    description: 'Yetkili roller: ADMIN, PLANNER, VIEWER',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Personel bulundu' })
  @ApiBadRequestResponse({ description: 'id sayı değil' })
  @ApiNotFoundResponse({ description: 'Personel bulunamadı' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.client.send('findOneWorkforceUser', id);
  }

  // 4. PERSONEL GÜNCELLEME - YALNIZCA ADMIN
  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({
    summary: 'Personeli kısmen günceller',
    description: 'Yetkili roller: ADMIN',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Personel güncellendi' })
  @ApiBadRequestResponse({
    description: 'Geçersiz veri veya id',
  })
  @ApiNotFoundResponse({ description: 'Personel bulunamadı' })
  @ApiConflictResponse({
    description: 'Bu sicil numarasıyla bir personel zaten var',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkforceUserDto,
  ) {
    return this.client.send('updateWorkforceUser', {
      id,
      data: dto,
    });
  }

  // 5. PERSONEL SİLME - YALNIZCA ADMIN
  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({
    summary: 'Personeli siler',
    description: 'Yetkili roller: ADMIN',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Personel silindi' })
  @ApiBadRequestResponse({ description: 'id sayı değil' })
  @ApiNotFoundResponse({ description: 'Personel bulunamadı' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.client.send('removeWorkforceUser', id).pipe(
      defaultIfEmpty(null),
      map(() => undefined),
    );
  }
}
