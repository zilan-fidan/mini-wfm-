import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTeamDto {
  @ApiProperty({
    description: 'Ekibin adı. Benzersiz olmalıdır.',
    example: 'Backend Ekibi',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({
    description: 'Ekibin kısa açıklaması.',
    example: 'API ve servis geliştirmeden sorumlu ekip',
  })
  @IsOptional()
  @IsString()
  description?: string;
}