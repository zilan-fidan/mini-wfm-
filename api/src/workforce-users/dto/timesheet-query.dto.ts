import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class TimesheetQueryDto {
  @ApiProperty({
    description: 'Puantaj ayı (YYYY-MM). Resmî tatil takvimi 2026 ve 2027 için tanımlıdır.',
    example: '2026-11',
  })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month YYYY-MM biçiminde olmalıdır' })
  month: string;
}
