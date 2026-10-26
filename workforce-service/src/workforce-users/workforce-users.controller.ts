import { Controller, HttpStatus } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { WorkforceUsersService } from './workforce-users.service';
import { CreateWorkforceUserDto } from './dto/create-workforce-user.dto';
import { UpdateWorkforceUserDto } from './dto/update-workforce-user.dto';
import { FindAllWorkforceUsersDto } from './dto/find-all-workforce-users.dto';

@Controller()
export class WorkforceUsersController {
  constructor(private readonly workforceUsersService: WorkforceUsersService) {}


  @MessagePattern('createWorkforceUser')
  async create(@Payload() createWorkforceUserDto: CreateWorkforceUserDto) {
    const existing = await this.workforceUsersService.findByRegistrationNumber(
      createWorkforceUserDto.registrationNumber,
    );

    if (existing) {
      throw new RpcException({
        statusCode: HttpStatus.CONFLICT,
        message: 'Bu sicil numarasıyla bir personel zaten var',
      });
    }

    return this.workforceUsersService.create(createWorkforceUserDto);
  }


  @MessagePattern('findAllWorkforceUsers')
  findAll(@Payload() query: FindAllWorkforceUsersDto) {
    return this.workforceUsersService.findAll(query);
  }


  @MessagePattern('findOneWorkforceUser')
  async findOne(@Payload() id: number) {
    const workforceUser = await this.workforceUsersService.findOne(id);

    if (!workforceUser) {
      throw new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Personel bulunamadı',
      });
    }

    return workforceUser;
  }


  @MessagePattern('updateWorkforceUser')
  async update(@Payload() payload: { id: number; data: UpdateWorkforceUserDto }) {
    const { id, data } = payload;

    const workforceUser = await this.workforceUsersService.findOne(id);

    if (!workforceUser) {
      throw new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Personel bulunamadı',
      });
    }

    if (
      data.registrationNumber !== undefined &&
      data.registrationNumber !== workforceUser.registrationNumber
    ) {
      const duplicate = await this.workforceUsersService.findByRegistrationNumber(data.registrationNumber);

      if (duplicate) {
        throw new RpcException({
          statusCode: HttpStatus.CONFLICT,
          message: 'Bu sicil numarasıyla bir personel zaten var',
        });
      }
    }

    return this.workforceUsersService.update(workforceUser, data);
  }


  @MessagePattern('removeWorkforceUser')
  async remove(@Payload() id: number) {
    const workforceUser = await this.workforceUsersService.findOne(id);

    if (!workforceUser) {
      throw new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Personel bulunamadı',
      });
    }

    return this.workforceUsersService.remove(workforceUser);
  }
}
