import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';

export class TeamSummaryQueryDto {
  @ApiProperty({ description: 'Aralık başlangıcı (dahil), ISO 8601', example: '2026-11-01T00:00:00+03:00' })
  @IsISO8601({ strict: true, strictSeparator: true })
  from: string;

  @ApiProperty({ description: 'Aralık bitişi (hariç), ISO 8601; en fazla 31 gün', example: '2026-12-01T00:00:00+03:00' })
  @IsISO8601({ strict: true, strictSeparator: true })
  to: string;
}
