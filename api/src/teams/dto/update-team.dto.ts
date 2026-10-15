import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateTeamDto } from './create-team.dto';

export class UpdateTeamDto extends PartialType(CreateTeamDto) {
  @ApiPropertyOptional({
    description: 'Ekibin aktif olup olmadığı.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}