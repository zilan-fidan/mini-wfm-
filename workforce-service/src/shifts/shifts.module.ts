import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Shift } from './entities/shift.entity';
import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';

import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';
import { TimesheetService } from './timesheet.service';
import { TimesheetController } from './timesheet.controller';
import { RotationPlanService } from './rotation-plan.service';
import { RotationPlanController } from './rotation-plan.controller';
import { CorrelationModule } from '../common/correlation/correlation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Shift, WorkforceUser]),
    CorrelationModule,
  ],
  controllers: [ShiftsController, TimesheetController, RotationPlanController],
  providers: [ShiftsService, TimesheetService, RotationPlanService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
