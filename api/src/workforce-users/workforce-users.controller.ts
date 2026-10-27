import { Body, Controller, Delete, Get, Inject, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { WORKFORCE_SERVICE } from '../constants';
import { ClientProxy } from "@nestjs/microservices";
import { ApiBadRequestResponse, ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { defaultIfEmpty, map } from 'rxjs';
import { CreateWorkforceUserDto } from "./dto/create-workforce-user.dto";
import { ListWorkforceUsersQueryDto } from "./dto/list-workforce-users-query.dto";
import { UpdateWorkforceUserDto } from "./dto/update-workforce-user.dto";

@ApiTags('workforce-users')
@Controller('workforce-users')
export class WorkforceUsersController {
  constructor(@Inject(WORKFORCE_SERVICE) private readonly client: ClientProxy) {}

  @Post()
  @ApiOperation({ summary: 'Yeni personel oluşturur' })
  @ApiCreatedResponse({ description: 'Personel oluşturuldu' })
  @ApiBadRequestResponse({ description: 'Geçersiz veri' })
  @ApiConflictResponse({ description: 'Bu sicil numarasıyla bir personel zaten var' })
  create(@Body() dto: CreateWorkforceUserDto) {
    return this.client.send('createWorkforceUser', dto);
  }

  @Get()
  @ApiOperation({ summary: 'Personelleri sayfalı olarak listeler' })
  @ApiOkResponse({ description: 'Personel listesi' })
  @ApiBadRequestResponse({ description: 'Geçersiz query parametresi' })
  findAll(@Query() query: ListWorkforceUsersQueryDto) {
    return this.client.send('findAllWorkforceUsers', query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Personel detayını getirir' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Personel bulundu' })
  @ApiBadRequestResponse({ description: 'id sayı değil' })
  @ApiNotFoundResponse({ description: 'Personel bulunamadı' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.client.send('findOneWorkforceUser', id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Personeli kısmen günceller' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Personel güncellendi' })
  @ApiBadRequestResponse({ description: 'Geçersiz veri veya id' })
  @ApiNotFoundResponse({ description: 'Personel bulunamadı' })
  @ApiConflictResponse({ description: 'Bu sicil numarasıyla bir personel zaten var' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkforceUserDto,
  ) {
    return this.client.send('updateWorkforceUser', { id, data: dto });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Personeli siler' })
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
