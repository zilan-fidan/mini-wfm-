import {IsString,IsNotEmpty, MaxLength,IsOptional,IsEnum,IsISO8601,IsInt,Min,} from 'class-validator';
import { WorkOrderPriority } from '../enums/work-order-priority.enum';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';


export class UpdateWorkOrderDto {
  // Optimistic locking: istemcinin son okuduğu sürüm
  @ApiProperty({ example: 1, description: 'Son okunan version; güncel değilse 409' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;

  // İş emri başlığı
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  // İş emri açıklaması
  @IsOptional()
  @IsString()
  description?: string | null;

  // İş emri önceliği
  @IsOptional()
  @IsEnum(WorkOrderPriority)
  priority?: WorkOrderPriority;

  // İş emrinin bitiş tarihi
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  dueAt?: string;
}
