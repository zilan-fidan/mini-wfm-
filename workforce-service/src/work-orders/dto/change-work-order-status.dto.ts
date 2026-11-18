import {IsEnum, IsInt, IsOptional, IsString,MaxLength, Min,} from 'class-validator';
import { Type } from 'class-transformer';

export enum WorkOrderStatus {
  OPEN = 'OPEN',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class ChangeWorkOrderStatusDto {
  @IsEnum(WorkOrderStatus)
  status: WorkOrderStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teamId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
