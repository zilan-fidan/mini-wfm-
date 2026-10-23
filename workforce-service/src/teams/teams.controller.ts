import { Controller, HttpStatus } from '@nestjs/common';
import {MessagePattern,Payload,RpcException,} from '@nestjs/microservices';
import { TeamsService } from '../teams/teams.service';
import { CreateTeamDto } from '../teams/dto/create-team.dto';
import { UpdateTeamDto } from '../teams/dto/update-team.dto';
import { FindAllTeamsDto } from '../teams/dto/find-all-teams.dto';

@Controller()
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}


  @MessagePattern('createTeam')
  async create(@Payload() createTeamDto: CreateTeamDto) {
    const existing = await this.teamsService.findByName(createTeamDto.name);
   
    if (existing) {
      throw new RpcException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Bu isimde bir ekip zaten var',
      });
    }

    return this.teamsService.create(createTeamDto);
  }
    

  @MessagePattern('findAllTeams')
  findAll(@Payload() query: FindAllTeamsDto) {
    return this.teamsService.findAll(query);
  }


  @MessagePattern('findOneTeam')
  async findOne(@Payload() id: number) {
    const team = await this.teamsService.findOne(id);

    if (!team) {
      throw new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Ekip bulunamadı',
      });
    }

    return team;
  }


  @MessagePattern('updateTeam')
  async update(@Payload() payload: { id: number; data: UpdateTeamDto }) {
    const { id, data } = payload;

    const team = await this.teamsService.findOne(id);

    if (!team) {
      throw new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Ekip bulunamadı',
      });
    }

    if (data.name !== undefined && data.name !== team.name) {
      const duplicate = await this.teamsService.findByName(data.name);

      if (duplicate) {
        throw new RpcException({
          statusCode: HttpStatus.CONFLICT,
          message: 'Bu isimde bir ekip zaten var',
        });
      }
    }

    return this.teamsService.update(team, data);
  }

  
  @MessagePattern('removeTeam')
  async remove(@Payload() id: number) {
    const team = await this.teamsService.findOne(id);

    if (!team) {
      throw new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Ekip bulunamadı',
      });
    }

    return this.teamsService.remove(team);
  }
}