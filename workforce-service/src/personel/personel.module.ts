import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonelController } from './personel.controller';
import { WorkforceUser } from './entities/workforce-user.entity';
import { PersonelService } from './personel.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkforceUser])],
  controllers: [PersonelController],
  providers: [PersonelService],
})
export class PersonelModule {}
