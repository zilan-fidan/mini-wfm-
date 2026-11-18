
import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsShiftDate } from './shift-date.validator';

export class CreateShiftDto {
  @ApiProperty({
    example: 1,
    description: 'Vardiya atanacak personelin ID değeri',
  })
  @IsInt()
  @Min(1)
  workforceUserId: number;

  @ApiProperty({
    example: '2026-11-12T08:00:00+03:00',
    description: 'Vardiya başlangıcı (ISO 8601, saat dilimi içermeli)',
  })
  @IsShiftDate()
  @IsString()
  @IsNotEmpty()
  @IsISO8601({ strict: true, strictSeparator: true })
  startAt: string;

  @ApiProperty({
    example: '2026-11-12T16:00:00+03:00',
    description: 'Vardiya bitişi (ISO 8601, saat dilimi içermeli)',
  })
  @IsShiftDate()
  @IsString()
  @IsNotEmpty()
  @IsISO8601({ strict: true, strictSeparator: true })
  endAt: string;

  @ApiPropertyOptional({
    example: 'Sabah vardiyası',
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}
