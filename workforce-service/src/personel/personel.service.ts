import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { CreatedWorkforceUserDto } from './dto/create-personel.dto';
import { UpdateWorkforceUserDto } from './dto/update-personel.dto';
import { WorkforceUser } from './entities/workforce-user.entity';
import { FindAllWorkforceUsersDto } from './dto/find-all-personel.dto';

@Injectable()
export class PersonelService {
  constructor(
    @InjectRepository(WorkforceUser)
    private readonly workforceUserRepository: Repository<WorkforceUser>,
  ) {}


  async create(createdWorkforceUserDto: CreatedWorkforceUserDto): Promise<WorkforceUser> {
    const workforceUser = this.workforceUserRepository.create(createdWorkforceUserDto);
    return await this.workforceUserRepository.save(workforceUser);
  }


  async findOne(id: number): Promise<WorkforceUser | null> {
    return await this.workforceUserRepository.findOne({
      where: { id },
    });
  }


  async findByRegistrationNumber(registrationNumber: string): Promise<WorkforceUser | null> {
    return await this.workforceUserRepository.findOne({
      where: { registrationNumber },
    });
  }


  async findAll(query: FindAllWorkforceUsersDto) {
    const { page = 1, limit = 10, search, isActive } = query;

    const where: FindOptionsWhere<WorkforceUser> = {};

    if (search) {
      where.firstname = ILike(`%${search}%`);
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [items, total] = await this.workforceUserRepository.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data: items, total, page, limit };
  }


  async update(workforceUser: WorkforceUser, updateWorkforceUserDto: UpdateWorkforceUserDto): Promise<WorkforceUser> {
    Object.assign(workforceUser, updateWorkforceUserDto);
    return this.workforceUserRepository.save(workforceUser);
  }


  async remove(workforceUser: WorkforceUser): Promise<void> {
    await this.workforceUserRepository.remove(workforceUser);
  }
}
