
import {Controller,Get,Post,Body,Inject,} from '@nestjs/common';
import { WORKFORCE_SERVICE } from '../constants';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CreateAccountDto } from './dto/create-account.dto';
import { Roles, Role } from '../auth/decorators/roles.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('accounts')
@ApiBearerAuth('access-token')
@Controller('accounts')
export class AccountsController {
 constructor(
  @Inject(WORKFORCE_SERVICE)
  private readonly workforceClient: ClientProxy,
) {}

  @Roles(Role.ADMIN)
  @Post()
  async createAccount(@Body() dto: CreateAccountDto) {
    return firstValueFrom(
      this.workforceClient.send('createAccount', dto),
    );
  }

  @Roles(Role.ADMIN)
  @Get()
  async findAllAccounts() {
    return firstValueFrom(
      this.workforceClient.send('findAllAccounts', {}),
    );
  }
}

