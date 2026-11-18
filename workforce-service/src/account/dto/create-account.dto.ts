import {IsString,IsNotEmpty,MinLength,MaxLength,IsEnum} from 'class-validator';
import { AccountRole } from '../entities/account-role.enum';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsEnum(AccountRole)
  role: AccountRole;
}