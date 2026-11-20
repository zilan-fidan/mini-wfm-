import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {ArrayMaxSize,ArrayMinSize,IsArray, IsBoolean, IsInt,IsISO8601,IsNotEmpty,IsOptional, IsString, Matches, Max, MaxLength,Min, ValidateNested,} from 'class-validator';

// API yalnızca biçimi doğrular. İş kuralları (tekrarlı kalıp adı, 1–12 saat süre, geçmiş tarih,
// çalışma kuralları) workforce-service'tedir; mevcut vardiya uç noktalarıyla aynı ayrım.
const START_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;          // 00:00–23:59
const END_TIME = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;    // 00:00–23:59 veya günün sonu 24:00


export class RotationSlotDto {
  @ApiProperty({ example: 'Sabah', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: '08:00', description: 'Yerel başlangıç saati (HH:mm, 00:00–23:59)' })
  @IsString()
  @Matches(START_TIME, { message: 'startTime HH:mm biçiminde olmalıdır (00:00–23:59)' })
  startTime: string;

  @ApiProperty({
    example: '16:00',
    description: 'Yerel bitiş saati (HH:mm). 24:00 günün sonudur; başlangıca eşit veya küçükse vardiya ertesi güne taşar',
  })
  @IsString()
  @Matches(END_TIME, { message: 'endTime HH:mm biçiminde olmalıdır (00:00–24:00)' })
  endTime: string;

  @ApiProperty({ example: 1, minimum: 1, description: 'İhtiyaç duyulan personel sayısı' })
  @IsInt()
  @Min(1)
  required: number;
}

 // apply isteğe bağlıdır, gönderilmezse önizleme yapılır.
 
export class CreateRotationPlanDto {
  @ApiProperty({ example: '2026-11-02', description: 'Planın ilk yerel günü (YYYY-MM-DD)' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate YYYY-MM-DD biçiminde olmalıdır' })
  @IsISO8601({ strict: true }, { message: 'startDate geçerli bir takvim günü olmalıdır' })
  startDate: string;

  @ApiProperty({ example: 7, minimum: 1, maximum: 14 })
  @IsInt()
  @Min(1)
  @Max(14)
  days: number;

  @ApiProperty({ type: [RotationSlotDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(24)
  @ValidateNested({ each: true })
  @Type(() => RotationSlotDto)
  slots: RotationSlotDto[];

  @ApiPropertyOptional({ example: false, default: false, description: 'false: yalnızca önizleme; true: plan eksiksizse kaydet' })
  @IsOptional()
  @IsBoolean()
  apply?: boolean;
}
