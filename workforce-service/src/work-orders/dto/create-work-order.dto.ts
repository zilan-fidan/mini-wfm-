
import {IsString,IsNotEmpty,MaxLength,IsOptional,IsEnum,IsInt, Min,IsISO8601,} from 'class-validator';
import { Type } from 'class-transformer';
import { WorkOrderPriority } from '../enums/work-order-priority.enum';

export class CreateWorkOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(WorkOrderPriority)
  priority?: WorkOrderPriority;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teamId?: number | null;

  @IsString()
  @IsNotEmpty()
  @IsISO8601({ strict: true, strictSeparator: true })
  dueAt: string;
}
