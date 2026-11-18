import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ListShiftsDto {
  @ApiProperty({ description: 'Aralık başlangıcı (dahil), ISO 8601' })
  @IsISO8601({ strict: true, strictSeparator: true })
  from: string;

  @ApiProperty({ description: 'Aralık bitişi (hariç), ISO 8601; en fazla 31 gün' })
  @IsISO8601({ strict: true, strictSeparator: true })
  to: string;

  @ApiPropertyOptional({ type: Number, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  workforceUserId?: number;

  @ApiPropertyOptional({ type: Number, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teamId?: number;
}
