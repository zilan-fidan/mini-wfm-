
import { RpcException } from '@nestjs/microservices';
import { isISO8601 } from 'class-validator';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shift } from './entities/shift.entity';

export type ListShiftsQuery = {
  from: string;
  to: string;
  workforceUserId?: number;
  teamId?: number;
};

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
  ) {}

  async findAllShifts(filters: ListShiftsQuery): Promise<Shift[]> {
    const from = new Date(filters.from);
    const to = new Date(filters.to);
    const duration = to.getTime() - from.getTime();
    if (
      !isISO8601(filters.from, { strict: true, strictSeparator: true }) ||
      !isISO8601(filters.to, { strict: true, strictSeparator: true }) ||
      !Number.isFinite(duration) || duration <= 0 || duration > 31 * 86400000 ||
      [filters.workforceUserId, filters.teamId].some(
        (id) => id !== undefined && (!Number.isInteger(id) || id <= 0),
      )
    ) {
      throw new RpcException({ statusCode: 400, message: 'Geçersiz filtre; tarih aralığı pozitif olmalı ve 31 günü aşmamalıdır' });
    }

    const query = this.shiftRepository.createQueryBuilder('shift')
      .leftJoin('shift.workforceUser', 'person')
      .leftJoin('person.team', 'team')
      .addSelect(['person.id', 'person.firstname', 'person.lastname', 'team.id', 'team.name'])
      .where('shift.startAt < :to', { to })
      .andWhere('shift.endAt > :from', { from })
      .orderBy('shift.startAt', 'ASC')
      .addOrderBy('shift.id', 'ASC');

    if (filters.workforceUserId !== undefined) {
      query.andWhere('shift.workforceUserId = :workforceUserId', { workforceUserId: filters.workforceUserId });
    }
    if (filters.teamId !== undefined) {
      query.andWhere('person.teamId = :teamId', { teamId: filters.teamId });
    }
    return query.getMany();
  }

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
