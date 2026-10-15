import { HttpStatus, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
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
    const existing = await this.teamRepository.findOne({
      where: { name: createTeamDto.name },
    });

    if (existing) {
      throw new RpcException({
        statusCode: HttpStatus.CONFLICT,
        message: 'Bu isimde bir ekip zaten var',
      });
    }

    const team = this.teamRepository.create(createTeamDto);
    return this.teamRepository.save(team);
  }

  async findOne(id: number): Promise<Team> {
    const team = await this.teamRepository.findOne({ where: { id } });

    if (!team) {
      throw new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Ekip bulunamadı',
      });
    }

    return team;
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

  async update(id: number, updateTeamDto: UpdateTeamDto): Promise<Team> {
  const team = await this.findOne(id); // ekip yoksa zaten 404 fırlatır

  if (updateTeamDto.name !== undefined && updateTeamDto.name !== team.name) {
    const duplicate = await this.teamRepository.findOne({
      where: { name: updateTeamDto.name },
    });

    if (duplicate) {
      throw new RpcException({
        statusCode: HttpStatus.CONFLICT,
        message: 'Bu isimde bir ekip zaten var',
      });
    }
  }

  Object.assign(team, updateTeamDto);
  return this.teamRepository.save(team);
}

async remove(id: number): Promise<void> {
  const team = await this.findOne(id); // ekip yoksa 404
  await this.teamRepository.remove(team);
}
}