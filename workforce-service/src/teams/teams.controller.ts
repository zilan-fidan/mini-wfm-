import { Controller, HttpStatus } from '@nestjs/common';
import {MessagePattern,Payload,RpcException,} from '@nestjs/microservices';
import { TeamsService } from '../teams/teams.service';
import { CreateTeamDto } from '../teams/dto/create-team.dto';
import { UpdateTeamDto } from '../teams/dto/update-team.dto';
import { FindAllTeamsDto } from '../teams/dto/find-all-teams.dto';
import { toWorkforceUserResponse } from '../workforce-users/workforce-user.response';

@Controller()
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}


  @MessagePattern('createTeam')
  async create(@Payload() createTeamDto: CreateTeamDto) {
    const existing = await this.teamsService.findByName(createTeamDto.name);
   
    if (existing) {
      throw new RpcException({
        statusCode: HttpStatus.CONFLICT,
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
    const team = await this.teamsService.findOneWithMembers(id);

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

    const memberCount = await this.teamsService.countMembers(id);

    if (memberCount > 0) {
      throw new RpcException({
        statusCode: HttpStatus.CONFLICT,
        message: `Ekipte ${memberCount} personel var. Silmeden önce personelleri ekipten çıkarın`,
      });
    }

    return this.teamsService.remove(team);
  }


  @MessagePattern('addTeamMember')
  async addMember(@Payload() payload: { teamId: number; workforceUserId: number }) {
    const { teamId, workforceUserId } = payload;

    const team = await this.getTeamOrThrow(teamId);
    const workforceUser = await this.getWorkforceUserOrThrow(workforceUserId);

    if (!team.isActive) {
      throw new RpcException({
        statusCode: HttpStatus.CONFLICT,
        message: 'Pasif bir ekibe personel eklenemez',
      });
    }

    if (!workforceUser.isActive) {
      throw new RpcException({
        statusCode: HttpStatus.CONFLICT,
        message: 'Pasif bir personel ekibe eklenemez',
      });
    }

    if (workforceUser.team) {
      throw this.alreadyInTeamException(workforceUser.team.name);
    }

    const added = await this.teamsService.addMember(teamId, workforceUserId);

    if (!added) {
      // Kontrolden sonra başka bir istek personeli bir ekibe atamış
      const current = await this.teamsService.findWorkforceUserWithTeam(workforceUserId);
      throw this.alreadyInTeamException(current?.team?.name ?? 'başka bir');
    }

    const updated = await this.teamsService.findWorkforceUserWithTeam(workforceUserId);
    return toWorkforceUserResponse(updated!);
  }


  @MessagePattern('removeTeamMember')
  async removeMember(@Payload() payload: { teamId: number; workforceUserId: number }) {
    const { teamId, workforceUserId } = payload;

    await this.getTeamOrThrow(teamId);
    const workforceUser = await this.getWorkforceUserOrThrow(workforceUserId);

    if (workforceUser.teamId !== teamId) {
      throw new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Personel bu ekipte değil',
      });
    }

    return this.teamsService.removeMember(teamId, workforceUserId);
  }


  private async getTeamOrThrow(id: number) {
    const team = await this.teamsService.findOne(id);

    if (!team) {
      throw new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Ekip bulunamadı',
      });
    }

    return team;
  }


  private async getWorkforceUserOrThrow(id: number) {
    const workforceUser = await this.teamsService.findWorkforceUserWithTeam(id);

    if (!workforceUser) {
      throw new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Personel bulunamadı',
      });
    }

    return workforceUser;
  }


  private alreadyInTeamException(teamName: string) {
    return new RpcException({
      statusCode: HttpStatus.CONFLICT,
      message: `Personel zaten "${teamName}" ekibinde`,
    });
  }
}