import {Body,Controller,Delete,Get,Inject,Param,ParseIntPipe,Patch,Post,} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {ApiBadRequestResponse,ApiConflictResponse,ApiCreatedResponse,ApiNotFoundResponse,ApiOkResponse, ApiOperation,ApiParam,ApiTags} from '@nestjs/swagger';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

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

  @Get(':id')
  @ApiOperation({ summary: 'Ekip detayını getirir' })
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
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.client.send('removeTeam', id);
  }
}