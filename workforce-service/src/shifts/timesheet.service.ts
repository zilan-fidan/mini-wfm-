import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shift } from './entities/shift.entity';
import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';

// Puantaj için yalnızca veritabanı erişimi. Doğrulama, hesaplama ve hata cevapları controller'dadır.
@Injectable()
export class TimesheetService {
  constructor(
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
    @InjectRepository(WorkforceUser)
    private readonly workforceUserRepository: Repository<WorkforceUser>,
  ) {}

  // Personel kaydı var mı?
  async workforceUserExists(workforceUserId: number): Promise<boolean> {
    return this.workforceUserRepository.exists({ where: { id: workforceUserId } });
  }

  // [from, to) aralığıyla KESİŞEN vardiyalar: aralıktan önce başlayıp içine taşanlar da gelir.
  async findShiftsInRange(workforceUserId: number, from: Date, to: Date): Promise<Shift[]> {
    return this.shiftRepository.createQueryBuilder('shift')
      .select(['shift.id', 'shift.startAt', 'shift.endAt'])
      .where('shift.workforceUserId = :workforceUserId', { workforceUserId })
      .andWhere('shift.startAt < :to', { to })
      .andWhere('shift.endAt > :from', { from })
      .orderBy('shift.startAt', 'ASC')
      .addOrderBy('shift.id', 'ASC')
      .getMany();
  }
}
