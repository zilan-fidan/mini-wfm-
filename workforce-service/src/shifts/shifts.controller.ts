
import { Controller } from '@nestjs/common';
import {
  MessagePattern,
  RpcException,
} from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShiftsService } from './shifts.service';
import { validateShiftPeriod } from './utils/validate-shift-period';

import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';
import { CorrelationContextService } from '../common/correlation/correlation-context.service';

// Yeni vardiya oluşturma verisi
type CreateShiftPayload = {
  workforceUserId: number;
  startAt: string;
  endAt: string;
  note?: string | null;
};

// Vardiya güncelleme verisi
type UpdateShiftPayload = {
  id: number;
  data: {
    workforceUserId?: number;
    startAt?: string;
    endAt?: string;
    note?: string | null;
  };
};

@Controller()
export class ShiftsController {
  constructor(
    private readonly shiftsService: ShiftsService,

    @InjectRepository(WorkforceUser)
    private readonly workforceUserRepository: Repository<WorkforceUser>,

    private readonly correlationContext: CorrelationContextService,
  ) {}

  // =====================================================
  // 1. VARDİYA OLUŞTURMA
  // =====================================================

  @MessagePattern('createShift')
  async createShift(payload: CreateShiftPayload) {
    // Tarihleri Date nesnesine dönüştür
    const startAt = new Date(payload.startAt);
    const endAt = new Date(payload.endAt);

    // Tarih, süre ve geçmiş kontrolü
    validateShiftPeriod(startAt, endAt, {
      checkPast: true,
    });

    // Personel var mı?
    const workforceUser =
      await this.workforceUserRepository.findOne({
        where: { id: payload.workforceUserId },
      });

    if (!workforceUser) {
      throw new RpcException({
        statusCode: 404,
        message: 'Personel bulunamadı',
      });
    }

    // Personel aktif mi?
    if (!workforceUser.isActive) {
      throw new RpcException({
        statusCode: 409,
        message: 'Pasif personele vardiya atanamaz',
      });
    }

    // Aynı personelin çakışan vardiyası var mı?
    const overlappingShift =
      await this.shiftsService.findOverlappingShift(
        payload.workforceUserId,
        startAt,
        endAt,
      );

    if (overlappingShift) {
      throw new RpcException({
        statusCode: 409,
        message:
          `Vardiya çakışması: ` +
          `${overlappingShift.startAt.toISOString()} - ` +
          `${overlappingShift.endAt.toISOString()}`,
      });
    }

    // Vardiyayı oluşturan hesabı actor'dan al
    const actor = this.correlationContext.getActor();

    if (!actor) {
      throw new RpcException({
        statusCode: 401,
        message: 'İşlemi gerçekleştiren hesap doğrulanamadı',
      });
    }

    // Vardiyayı kaydet
    return this.shiftsService.createShift({
      workforceUserId: payload.workforceUserId,
      startAt,
      endAt,
      note: payload.note ?? null,
      createdById: actor.id,
    });
  }

  // =====================================================
  // 2. VARDİYA DETAYINI GETİRME
  // =====================================================

  @MessagePattern('findOneShift')
  async findOneShift(id: number) {
    // ID doğrulaması
    if (!Number.isInteger(id) || id <= 0) {
      throw new RpcException({
        statusCode: 400,
        message: 'Geçerli bir vardiya ID değeri girilmelidir',
      });
    }

    // Vardiyayı veritabanından bul
    const shift = await this.shiftsService.findOneShift(id);

    if (!shift) {
      throw new RpcException({
        statusCode: 404,
        message: 'Vardiya bulunamadı',
      });
    }

    return shift;
  }

  // =====================================================
  // 3. VARDİYA GÜNCELLEME
  // =====================================================

  @MessagePattern('updateShift')
  async updateShift(payload: UpdateShiftPayload) {
    const { id, data } = payload;

    // ID doğrulaması
    if (!Number.isInteger(id) || id <= 0) {
      throw new RpcException({
        statusCode: 400,
        message: 'Geçerli bir vardiya ID değeri girilmelidir',
      });
    }

    // Mevcut vardiyayı bul
    const shift = await this.shiftsService.findOneShift(id);

    if (!shift) {
      throw new RpcException({
        statusCode: 404,
        message: 'Vardiya bulunamadı',
      });
    }

    // Geçmişte başlamış vardiya güncellenemez
    if (shift.startAt.getTime() < Date.now()) {
      throw new RpcException({
        statusCode: 409,
        message: 'Geçmişteki vardiya güncellenemez',
      });
    }

    // Kısmi güncelleme:
    // Gönderilmeyen alanların mevcut değerlerini koru
    const workforceUserId =
      data.workforceUserId ?? shift.workforceUserId;

    const startAt =
      data.startAt !== undefined
        ? new Date(data.startAt)
        : shift.startAt;

    const endAt =
      data.endAt !== undefined
        ? new Date(data.endAt)
        : shift.endAt;

    // Yeni tarih ve süre doğrulaması
    validateShiftPeriod(startAt, endAt, {
      checkPast: true,
    });

    // Personel var mı?
    const workforceUser =
      await this.workforceUserRepository.findOne({
        where: { id: workforceUserId },
      });

    if (!workforceUser) {
      throw new RpcException({
        statusCode: 404,
        message: 'Personel bulunamadı',
      });
    }

    // Personel aktif mi?
    if (!workforceUser.isActive) {
      throw new RpcException({
        statusCode: 409,
        message: 'Pasif personele vardiya atanamaz',
      });
    }

    // Diğer vardiyalarla çakışma kontrolü
    // Son parametre mevcut vardiyayı hariç tutar
    const overlappingShift =
      await this.shiftsService.findOverlappingShift(
        workforceUserId,
        startAt,
        endAt,
        id,
      );

    if (overlappingShift) {
      throw new RpcException({
        statusCode: 409,
        message:
          `Vardiya çakışması: ` +
          `${overlappingShift.startAt.toISOString()} - ` +
          `${overlappingShift.endAt.toISOString()}`,
      });
    }

    // Vardiyayı güncelle
    return this.shiftsService.updateShift(shift, {
      workforceUserId,
      startAt,
      endAt,
      ...(data.note !== undefined
        ? { note: data.note }
        : {}),
    });
  }

@MessagePattern('removeShift')
async removeShift(id: number): Promise<void> {
  // 1. ID doğrulaması
  if (!Number.isInteger(id) || id <= 0) {
    throw new RpcException({
      statusCode: 400,
      message: 'Geçerli bir vardiya ID değeri girilmelidir',
    });
  }

  // 2. Vardiyayı bul
  const shift = await this.shiftsService.findOneShift(id);

  if (!shift) {
    throw new RpcException({
      statusCode: 404,
      message: 'Vardiya bulunamadı',
    });
  }

  // 3. Geçmişte başlamış vardiya silinemez
  if (shift.startAt.getTime() <= Date.now()) {
    throw new RpcException({
      statusCode: 409,
      message: 'Geçmişte başlamış vardiya silinemez',
    });
  }

  // 4. Vardiyayı sil
  await this.shiftsService.removeShift(shift);
}

}
