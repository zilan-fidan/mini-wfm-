import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { Team } from './entities/team.entity';
import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';
import { WorkOrdersModule } from '../work-orders/work-orders.module';

@Module({
  imports: [TypeOrmModule.forFeature([Team, WorkforceUser]), WorkOrdersModule,],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
