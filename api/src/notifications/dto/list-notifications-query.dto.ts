import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class ListNotificationsQueryDto {
  @ApiProperty({ description: 'Bildirimleri listelenecek personelin ID değeri', example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'workforceUserId tam sayı olmalıdır' })
  @Min(1, { message: 'workforceUserId pozitif olmalıdır' })
  workforceUserId: number;
}
