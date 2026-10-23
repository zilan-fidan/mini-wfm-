import { Controller, HttpStatus } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { PersonelService } from './personel.service';
import { CreatedWorkforceUserDto } from './dto/create-personel.dto';
import { UpdateWorkforceUserDto } from './dto/update-personel.dto';
import { FindAllWorkforceUsersDto } from './dto/find-all-personel.dto';

@Controller()
export class PersonelController {
  constructor(private readonly personelService: PersonelService) {}


  @MessagePattern('createWorkforceUser')
  async create(@Payload() createdWorkforceUserDto: CreatedWorkforceUserDto) {
    const existing = await this.personelService.findByRegistrationNumber(
      createdWorkforceUserDto.registrationNumber,
    );

    if (existing) {
      throw new RpcException({
        statusCode: HttpStatus.CONFLICT,
        message: 'Bu sicil numarasıyla bir personel zaten var',
      });
    }

    return this.personelService.create(createdWorkforceUserDto);
  }


  @MessagePattern('findAllWorkforceUsers')
  findAll(@Payload() query: FindAllWorkforceUsersDto) {
    return this.personelService.findAll(query);
  }


  @MessagePattern('findOneWorkforceUser')
  async findOne(@Payload() id: number) {
    const workforceUser = await this.personelService.findOne(id);

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

    const workforceUser = await this.personelService.findOne(id);

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
      const duplicate = await this.personelService.findByRegistrationNumber(data.registrationNumber);

      if (duplicate) {
        throw new RpcException({
          statusCode: HttpStatus.CONFLICT,
          message: 'Bu sicil numarasıyla bir personel zaten var',
        });
      }
    }

    return this.personelService.update(workforceUser, data);
  }


  @MessagePattern('removeWorkforceUser')
  async remove(@Payload() id: number) {
    const workforceUser = await this.personelService.findOne(id);

    if (!workforceUser) {
      throw new RpcException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Personel bulunamadı',
      });
    }

    return this.personelService.remove(workforceUser);
  }
}
