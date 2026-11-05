
import {Controller,Get,Post,Body,Inject,} from '@nestjs/common';
import { WORKFORCE_SERVICE } from '../constants';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CreateAccountDto } from './dto/create-account.dto';


@Controller('accounts')
export class AccountsController {
 constructor(
  @Inject(WORKFORCE_SERVICE)
  private readonly workforceClient: ClientProxy,
) {}

  @Post()
  async createAccount(@Body() dto: CreateAccountDto) {
    return firstValueFrom(
      this.workforceClient.send('createAccount', dto),
    );
  }

  @Get()
  async findAllAccounts() {
    return firstValueFrom(
      this.workforceClient.send('findAllAccounts', {}),
    );
  }
}

