import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkforceUsersController } from './workforce-users.controller';
import { WorkforceUser } from './entities/workforce-user.entity';
import { WorkforceUsersService } from './workforce-users.service';
import { ShiftsModule } from '../shifts/shifts.module';

@Module({
  imports: [TypeOrmModule.forFeature([WorkforceUser]),ShiftsModule,],
  controllers: [WorkforceUsersController],
  providers: [WorkforceUsersService],
})
export class WorkforceUsersModule {}
