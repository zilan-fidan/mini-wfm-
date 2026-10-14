import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { FindAllTeamsDto } from './dto/find-all-teams.dto';


@Controller()
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @MessagePattern('createTeam')
  create(@Payload() createTeamDto: CreateTeamDto) {
    return this.teamsService.create(createTeamDto);
  }

  @MessagePattern('findAllTeams')
  findAll(@Payload() query: FindAllTeamsDto) {
    return this.teamsService.findAll(query);
  }

  @MessagePattern('findOneTeam')
  findOne(@Payload() id: number) {
    return this.teamsService.findOne(id);
  }

  @MessagePattern('updateTeam')
  update(@Payload() payload: { id: number; data: UpdateTeamDto }) {
   return this.teamsService.update(payload.id, payload.data);
  } 

  @MessagePattern('removeTeam')
  remove(@Payload() id: number) {
    return this.teamsService.remove(id);
  }
}
