import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, IsNull, Repository } from 'typeorm';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { Team } from './entities/team.entity';
import { FindAllTeamsDto } from './dto/find-all-teams.dto';
import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(WorkforceUser)
    private readonly workforceUserRepository: Repository<WorkforceUser>,
  ) {}


  async create(createTeamDto: CreateTeamDto): Promise<Team> {
    const team = this.teamRepository.create(createTeamDto);
    return await this.teamRepository.save(team);
  }


  async findOne(id: number): Promise<Team | null> {
    return await this.teamRepository.findOne({
      where: { id },
    });
  }


  async findByName(name: string): Promise<Team | null> {
    return await this.teamRepository.findOne({
      where: { name },
    });
  }


  async findAll(query: FindAllTeamsDto) {
    const { page = 1, limit = 10, search, isActive } = query;

    const where: FindOptionsWhere<Team> = {};

    if (search) {
      where.name = ILike(`%${search}%`);
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [items, total] = await this.teamRepository.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data: items, total, page, limit };
  }


  async update(team: Team, updateTeamDto: UpdateTeamDto): Promise<Team> {
    Object.assign(team, updateTeamDto);
    return this.teamRepository.save(team);
  }

  
  async remove(team: Team): Promise<void> {
    await this.teamRepository.remove(team);
  }


  async findOneWithMembers(id: number): Promise<Team | null> {
    return await this.teamRepository.findOne({
      where: { id },
      relations: { members: true },
      order: { members: { firstname: 'ASC', lastname: 'ASC', id: 'ASC' } },
    });
  }


  async countMembers(teamId: number): Promise<number> {
    return await this.workforceUserRepository.count({ where: { teamId } });
  }


  // Personeli ekibiyle birlikte getirir (zaten bir ekipteyse ekip adı mesajda lazım)
  async findWorkforceUserWithTeam(id: number): Promise<WorkforceUser | null> {
    return await this.workforceUserRepository.findOne({
      where: { id },
      relations: { team: true },
    });
  }


  // Sadece ekipsiz personeli atar; aynı anda iki istek gelirse yalnızca biri kazanır
  async addMember(teamId: number, workforceUserId: number): Promise<boolean> {
    const result = await this.workforceUserRepository.update(
      { id: workforceUserId, teamId: IsNull() },
      { teamId },
    );
    return (result.affected ?? 0) > 0;
  }


  async removeMember(teamId: number, workforceUserId: number): Promise<void> {
    await this.workforceUserRepository.update(
      { id: workforceUserId, teamId },
      { teamId: null },
    );
  }
}