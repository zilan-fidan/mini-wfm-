import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class AddTeamMemberDto {
  @ApiProperty({ description: 'Ekibe eklenecek personelin id değeri', example: 1 })
  @IsInt()
  @Min(1)
  workforceUserId: number;
}
