import { HttpStatus, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { Team } from './entities/team.entity';

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

  findAll() {
    return `This action returns all teams`;
  }

  update(id: number, updateTeamDto: UpdateTeamDto) {
    return `This action updates a #${id} team`;
  }

  remove(id: number) {
    return `This action removes a #${id} team`;
  }
}