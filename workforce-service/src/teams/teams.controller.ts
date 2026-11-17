import { Controller, HttpStatus } from '@nestjs/common';
import {MessagePattern,Payload,RpcException,} from '@nestjs/microservices';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { FindAllTeamsDto } from './dto/find-all-teams.dto';
import { toWorkforceUserResponse } from '../workforce-users/workforce-user.response';
import { WorkOrdersService } from '../work-orders/work-orders.service';

@Controller()
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly workOrdersService: WorkOrdersService,
  ) {}

  // EKİP OLUŞTURMA
  @MessagePattern('createTeam')
  async create(@Payload() createTeamDto: CreateTeamDto) {
    const existing = await this.teamsService.findByName(
      createTeamDto.name,
    );

    if (existing) {
      throw new RpcException({
        statusCode: HttpStatus.CONFLICT,
        message: 'Bu isimde bir ekip zaten var',
      });
    }

    return this.teamsService.create(createTeamDto);
  }

  // EKİPLERİ LİSTELEME
  @MessagePattern('findAllTeams')
  findAll(@Payload() query: FindAllTeamsDto) {
    return this.teamsService.findAll(query);
  }

  // TEK EKİP GETİRME
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

  // EKİP GÜNCELLEME
  @MessagePattern('updateTeam')
  async update(
    @Payload() payload: { id: number; data: UpdateTeamDto },
  ) {
    const { id, data } = payload;
    const team = await this.getTeamOrThrow(id);

    if (
      data.name !== undefined &&
      data.name !== team.name
    ) {
      const duplicate = await this.teamsService.findByName(
        data.name,
      );

      if (duplicate && duplicate.id !== id) {
        throw new RpcException({
          statusCode: HttpStatus.CONFLICT,
          message: 'Bu isimde bir ekip zaten var',
        });
      }
    }

    return this.teamsService.update(team, data);
  }

  // EKİP SİLME
  @MessagePattern('removeTeam')
  async remove(@Payload() id: number) {
    const team = await this.getTeamOrThrow(id);
    // Ekipte personel var mı?
    const memberCount = await this.teamsService.countMembers(id);

    if (memberCount > 0) {
      throw new RpcException({
        statusCode: HttpStatus.CONFLICT,
        message:
          `Ekipte ${memberCount} personel var. ` +
          'Silmeden önce personelleri ekipten çıkarın',
      });
    }
    // Açık iş emri var mı?
    const hasOpenWorkOrders =
      await this.workOrdersService.hasOpenWorkOrdersForTeam(id);

    if (hasOpenWorkOrders) {
      throw new RpcException({
        statusCode: HttpStatus.CONFLICT,
        message: 'Açık iş emri bulunan ekip silinemez',
      });
    }
    return this.teamsService.remove(team);
  }

  // EKİBE PERSONEL EKLEME
  @MessagePattern('addTeamMember')
  async addMember(
    @Payload()
    payload: {
      teamId: number;
      workforceUserId: number;
    },
  ) {
    const { teamId, workforceUserId } = payload;
    const team = await this.getTeamOrThrow(teamId);
    const workforceUser =await this.getWorkforceUserOrThrow(workforceUserId);
    // Pasif ekibe personel eklenemez
    if (!team.isActive) {
      throw new RpcException({
        statusCode: HttpStatus.CONFLICT,
        message: 'Pasif bir ekibe personel eklenemez',
      });
    }

    // Pasif personel ekibe eklenemez
    if (!workforceUser.isActive) {
      throw new RpcException({
        statusCode: HttpStatus.CONFLICT,
        message: 'Pasif bir personel ekibe eklenemez',
      });
    }

    // Personel zaten bir ekipte mi?
    if (workforceUser.team) {
      throw this.alreadyInTeamException(
        workforceUser.team.name,
      );
    }

    // Personeli ekibe ekle
    const added = await this.teamsService.addMember(teamId, workforceUserId,);

    if (!added) {
      const current =
        await this.teamsService.findWorkforceUserWithTeam(workforceUserId, );

      throw this.alreadyInTeamException(current?.team?.name ?? 'başka bir', );
    }

    const updated =
      await this.teamsService.findWorkforceUserWithTeam(
        workforceUserId,
      );

    return toWorkforceUserResponse(updated!);
  }

  // EKİPTEN PERSONEL ÇIKARMA
  @MessagePattern('removeTeamMember')
  async removeMember(
    @Payload()
    payload: { teamId: number;workforceUserId: number;},
  ) {
    const { teamId, workforceUserId } = payload;
    await this.getTeamOrThrow(teamId);
    const workforceUser =await this.getWorkforceUserOrThrow(workforceUserId);

    if (workforceUser.teamId !== teamId) {
      throw new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Personel bu ekipte değil',
      });
    }

    return this.teamsService.removeMember(teamId,workforceUserId,);
  }

  // YARDIMCI METOT: EKİP BULMA
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

  // YARDIMCI METOT: PERSONEL BULMA
  private async getWorkforceUserOrThrow(id: number) {
    const workforceUser =await this.teamsService.findWorkforceUserWithTeam(id);

    if (!workforceUser) {
      throw new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Personel bulunamadı',
      });
    }

    return workforceUser;
  }

  // YARDIMCI METOT: PERSONEL ZATEN EKİPTE
  private alreadyInTeamException(teamName: string) {
    return new RpcException({
      statusCode: HttpStatus.CONFLICT,
      message: `Personel zaten "${teamName}" ekibinde`,
    });
  }
}
