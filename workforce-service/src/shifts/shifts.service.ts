
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Shift } from './entities/shift.entity';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
  ) {}

  // Yeni vardiyayı veritabanına kaydeder.
  async createShift(data: Partial<Shift>): Promise<Shift> {
    const shift = this.shiftRepository.create(data);
    return this.shiftRepository.save(shift);
  }

  // Vardiyayı ID üzerinden bulur.
  async findOneShift(id: number): Promise<Shift | null> {
    return this.shiftRepository.findOne({
      where: { id },
    });
  }

  // Vardiyayı veritabanında günceller.
  async updateShift(
    shift: Shift,
    data: Partial<Shift>,
  ): Promise<Shift> {
    const updatedShift = this.shiftRepository.merge(shift, data);
    return this.shiftRepository.save(updatedShift);
  }

  // Vardiyayı veritabanından siler.
  async removeShift(shift: Shift): Promise<void> {
    await this.shiftRepository.remove(shift);
  }


async findOverlappingShift(
  workforceUserId: number,
  startAt: Date,
  endAt: Date,
  excludeShiftId?: number,
): Promise<Shift | null> {
  const query = this.shiftRepository
    .createQueryBuilder('shift')
    .where('shift.workforceUserId = :workforceUserId', {
      workforceUserId,
    })
    .andWhere('shift.startAt < :endAt', { endAt })
    .andWhere('shift.endAt > :startAt', { startAt });

  // Güncelleme sırasında vardiyanın kendisini hariç tut.
  if (excludeShiftId !== undefined) {
    query.andWhere('shift.id != :excludeShiftId', {
      excludeShiftId,
    });
  }

  return query.getOne();
}
async hasShiftsForWorkforceUser(
  workforceUserId: number,
): Promise<boolean> {
  return this.shiftRepository.exists({
    where: { workforceUserId },
  });
}
}
