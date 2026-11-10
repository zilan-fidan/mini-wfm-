import { RpcException } from '@nestjs/microservices';

type ValidateShiftPeriodOptions = {
  checkPast?: boolean;
};

export function validateShiftPeriod(
  startAt: Date,
  endAt: Date,
  options: ValidateShiftPeriodOptions = {},
): void {
  const start = startAt.getTime();
  const end = endAt.getTime();

  // 1. Tarihlerin geçerli olup olmadığını kontrol et.
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new RpcException({
      statusCode: 400,
      message: 'Geçersiz vardiya tarihi',
    });
  }

  // 2. Bitiş başlangıçtan sonra olmalı.
  if (end <= start) {
    throw new RpcException({
      statusCode: 400,
      message: 'Vardiya bitiş tarihi başlangıçtan sonra olmalıdır',
    });
  }

  // 3. Süre en az 1, en fazla 12 saat olmalı.
  const durationMs = end - start;

  const MIN_DURATION_MS = 60 * 60 * 1000;
  const MAX_DURATION_MS = 12 * 60 * 60 * 1000;

  if (
    durationMs < MIN_DURATION_MS ||
    durationMs > MAX_DURATION_MS
  ) {
    throw new RpcException({
      statusCode: 400,
      message: 'Vardiya süresi 1 ile 12 saat arasında olmalıdır',
    });
  }

  // 4. Yeni vardiya geçmişte başlayamaz.
  if (options.checkPast && start < Date.now()) {
    throw new RpcException({
      statusCode: 409,
      message: 'Geçmişe vardiya oluşturulamaz',
    });
  }
}
