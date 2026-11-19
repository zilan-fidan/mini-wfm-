import { Type } from 'class-transformer';
import {IsEnum,IsInt,IsOptional,IsString,MaxLength,Min,} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum WorkOrderStatus {
  OPEN = 'OPEN',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class ChangeWorkOrderStatusDto {
  // Optimistic locking: istemcinin son okuduğu sürüm
  @ApiProperty({ example: 1, description: 'Son okunan version; güncel değilse 409' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;

  @ApiProperty({ enum: WorkOrderStatus, example: WorkOrderStatus.ASSIGNED })
  @IsEnum(WorkOrderStatus)
  status: WorkOrderStatus;

  @ApiPropertyOptional({ example: 3, description: 'Atanacak ekibin ID değeri' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teamId?: number;

  @ApiPropertyOptional({ example: 'İş emri iptal edildi', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
