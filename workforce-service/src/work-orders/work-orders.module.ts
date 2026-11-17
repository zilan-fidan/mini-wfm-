import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkOrder } from './entities/work-order.entity';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrdersController } from './work-orders.controller';
import { Team } from '../teams/entities/team.entity';
import { CorrelationModule } from '../common/correlation/correlation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkOrder,
      Team,
    ]),
    CorrelationModule,
  ],
  controllers: [WorkOrdersController],
  providers: [WorkOrdersService],
  exports: [WorkOrdersService],
})
export class WorkOrdersModule {}
