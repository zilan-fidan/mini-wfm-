import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkOrder } from './entities/work-order.entity';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrdersController } from './work-orders.controller';
import { TeamSuggestionsController } from './team-suggestions.controller';
import { TeamSuggestionsService } from './team-suggestions.service';
import { Team } from '../teams/entities/team.entity';
import { CorrelationModule } from '../common/correlation/correlation.module';
import { WorkOrderStatusHistory } from './entities/work-order-status-history.entity';
import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';
import { EventsModule } from '../events/events.module';
import { OverdueWorkOrdersService } from './overdue/overdue-work-orders.service';
import { OverdueCheckJob } from './overdue/overdue-check.job';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkOrder,
      WorkOrderStatusHistory,
      Team,
      WorkforceUser,
    ]),
    CorrelationModule,
    EventsModule,
  ],
  controllers: [WorkOrdersController, TeamSuggestionsController],
  providers: [WorkOrdersService, TeamSuggestionsService, OverdueWorkOrdersService, OverdueCheckJob],
  exports: [WorkOrdersService],
})
export class WorkOrdersModule {}
