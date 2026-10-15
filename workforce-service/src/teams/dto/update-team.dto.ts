import { PartialType } from '@nestjs/mapped-types';
import { CreateTeamDto } from './create-team.dto';

export class UpdateTeamDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}
