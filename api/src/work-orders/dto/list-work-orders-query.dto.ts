import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { WorkOrderPriority } from '../enums/work-order-priority.enum';
import { WorkOrderStatus } from './change-work-order-status.dto';

// Beyaz liste: sortBy yalnızca bu üç değerden biri olabilir, diğer her şey 400
export enum WorkOrderSortBy {
  CREATED_AT = 'createdAt',
  DUE_AT = 'dueAt',
  PRIORITY = 'priority',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListWorkOrdersQueryDto {
  @ApiPropertyOptional({ description: 'Sayfa numarası', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Sayfa başına kayıt sayısı',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiPropertyOptional({
    description: 'İş emri kodunda veya başlığında büyük/küçük harf duyarsız arama',
    example: 'trafo',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Bir veya birden fazla durum (?status=OPEN&status=ASSIGNED)',
    enum: WorkOrderStatus,
    isArray: true,
    example: [WorkOrderStatus.OPEN, WorkOrderStatus.ASSIGNED],
  })
  @IsOptional()
  // Tek değer gelirse string olur, birden fazla gelirse dizi; ikisini de diziye çeviriyoruz
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsEnum(WorkOrderStatus, { each: true })
  status?: WorkOrderStatus[];

  @ApiPropertyOptional({ description: 'Önceliğe göre filtre', enum: WorkOrderPriority })
  @IsOptional()
  @IsEnum(WorkOrderPriority)
  priority?: WorkOrderPriority;

  @ApiPropertyOptional({ description: 'Ekibe göre filtre', minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teamId?: number;

  @ApiPropertyOptional({
    description: 'true ise yalnızca süresi geçmiş ve kapanmamış iş emirleri',
    example: true,
  })
  @IsOptional()
  // Query string'de her şey metindir: "true"/"false" boolean'a çevrilir, diğerleri IsBoolean'a takılır
  @Transform(({ obj, key }) => {
    const raw = obj[key];
    if (raw === 'true' || raw === true) return true;
    if (raw === 'false' || raw === false) return false;
    return raw;
  })
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional({
    description: 'Sıralama alanı',
    enum: WorkOrderSortBy,
    default: WorkOrderSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(WorkOrderSortBy)
  sortBy: WorkOrderSortBy = WorkOrderSortBy.CREATED_AT;

  @ApiPropertyOptional({
    description: 'Sıralama yönü',
    enum: SortOrder,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder: SortOrder = SortOrder.DESC;
}
