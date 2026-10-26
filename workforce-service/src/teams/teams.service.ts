import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { Team } from './entities/team.entity';
import { FindAllTeamsDto } from './dto/find-all-teams.dto';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
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
}