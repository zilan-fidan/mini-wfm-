import {IsString,IsNotEmpty, MaxLength,IsOptional,IsEnum,IsISO8601,} from 'class-validator';
import { WorkOrderPriority } from '../enums/work-order-priority.enum';

export class UpdateWorkOrderDto {
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
