import {Body,Controller,Delete,Get,Inject,Param,ParseIntPipe,Patch,Post,Query,} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {ApiBadRequestResponse,ApiConflictResponse,ApiCreatedResponse,ApiNotFoundResponse,ApiOkResponse, ApiOperation,ApiParam,ApiTags} from '@nestjs/swagger';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { ListTeamsQueryDto } from './dto/list-teams-query.dto';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { defaultIfEmpty, map } from 'rxjs';

@ApiTags('teams')
@Controller('teams')
export class TeamsController {
  constructor(
    @Inject('WORKFORCE_SERVICE') private readonly client: ClientProxy,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Yeni ekip oluşturur' })
  @ApiCreatedResponse({ description: 'Ekip oluşturuldu' })
  @ApiBadRequestResponse({ description: 'Geçersiz veri' })
  @ApiConflictResponse({ description: 'Bu isimde bir ekip zaten var' })
  create(@Body() dto: CreateTeamDto) {return this.client.send('createTeam', dto);}

  @Get()
  @ApiOperation({ summary: 'Ekipleri sayfalı olarak listeler' })
  @ApiOkResponse({ description: 'Ekip listesi' })
  @ApiBadRequestResponse({ description: 'Geçersiz query parametresi' })
  findAll(@Query() query: ListTeamsQueryDto) {
    return this.client.send('findAllTeams', query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ekip detayını üyeleriyle (members) birlikte getirir' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Ekip bulundu' })
  @ApiBadRequestResponse({ description: 'id sayı değil' })
  @ApiNotFoundResponse({ description: 'Ekip bulunamadı' })
  findOne(@Param('id', ParseIntPipe) id: number) {return this.client.send('findOneTeam', id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Ekibi kısmen günceller' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Ekip güncellendi' })
  @ApiBadRequestResponse({ description: 'Geçersiz veri veya id' })
  @ApiNotFoundResponse({ description: 'Ekip bulunamadı' })
  @ApiConflictResponse({ description: 'Bu isimde bir ekip zaten var' })
  update(
   @Param('id', ParseIntPipe) id: number,
   @Body() dto: UpdateTeamDto,
  ) { 
    return this.client.send('updateTeam', { id, data: dto });
   } 

  @Delete(':id')
  @ApiOperation({ summary: 'Ekibi siler' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Ekip silindi' })
  @ApiBadRequestResponse({ description: 'id sayı değil' })
  @ApiNotFoundResponse({ description: 'Ekip bulunamadı' })
  @ApiConflictResponse({ description: 'Üyesi olan ekip silinemez' })
  remove(@Param('id', ParseIntPipe) id: number) {
  return this.client.send('removeTeam', id).pipe(
    defaultIfEmpty(null),
    map(() => undefined),
  );
}

  @Post(':id/members')
  @ApiOperation({ summary: 'Personeli ekibe ekler' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiCreatedResponse({ description: 'Personel ekibe eklendi' })
  @ApiBadRequestResponse({ description: 'Geçersiz veri veya id' })
  @ApiNotFoundResponse({ description: 'Ekip veya personel bulunamadı' })
  @ApiConflictResponse({ description: 'Ekip veya personel pasif ya da personel zaten bir ekipte' })
  addMember(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddTeamMemberDto,
  ) {
    return this.client.send('addTeamMember', {
      teamId: id,
      workforceUserId: dto.workforceUserId,
    });
  }

  @Delete(':id/members/:workforceUserId')
  @ApiOperation({ summary: 'Personeli ekipten çıkarır' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiParam({ name: 'workforceUserId', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Personel ekipten çıkarıldı' })
  @ApiBadRequestResponse({ description: 'id sayı değil' })
  @ApiNotFoundResponse({ description: 'Ekip veya personel bulunamadı ya da personel bu ekipte değil' })
  removeMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('workforceUserId', ParseIntPipe) workforceUserId: number,
  ) {
    return this.client
      .send('removeTeamMember', { teamId: id, workforceUserId })
      .pipe(
        defaultIfEmpty(null),
        map(() => undefined),
      );
  }
}