import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { TeamSummaryService } from './team-summary.service';

@Module({
  controllers: [ReportsController],
  providers: [TeamSummaryService],
})
export class ReportsModule {}
