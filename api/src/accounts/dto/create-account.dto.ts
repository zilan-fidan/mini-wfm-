import { IsString,IsNotEmpty,MinLength,MaxLength,IsEnum,} from 'class-validator';

export enum AccountRole {
  ADMIN = 'ADMIN',
  PLANNER = 'PLANNER',
  VIEWER = 'VIEWER',
}

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