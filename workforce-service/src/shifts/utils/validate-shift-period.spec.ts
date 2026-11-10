
import { RpcException } from '@nestjs/microservices';
import { validateShiftPeriod } from './validate-shift-period';

describe('validateShiftPeriod', () => {
  // Her testte sabit bir gelecek tarih kullanıyoruz.
  const startAt = new Date('2099-01-01T08:00:00Z');

  it('Bitiş başlangıçtan önceyse 400 vermeli', () => {
    const endAt = new Date('2099-01-01T07:00:00Z');

    expect(() =>
      validateShiftPeriod(startAt, endAt),
    ).toThrow(RpcException);

    expect(() =>
      validateShiftPeriod(startAt, endAt),
    ).toThrow('Vardiya bitiş tarihi başlangıçtan sonra olmalıdır');
  });

  it('Başlangıç ve bitiş aynıysa 400 vermeli', () => {
    expect(() =>
      validateShiftPeriod(startAt, startAt),
    ).toThrow(RpcException);
  });

  it('30 dakikalık vardiyayı reddetmeli', () => {
    const endAt = new Date('2099-01-01T08:30:00Z');

    expect(() =>
      validateShiftPeriod(startAt, endAt),
    ).toThrow('Vardiya süresi 1 ile 12 saat arasında olmalıdır');
  });

  it('13 saatlik vardiyayı reddetmeli', () => {
    const endAt = new Date('2099-01-01T21:00:00Z');

    expect(() =>
      validateShiftPeriod(startAt, endAt),
    ).toThrow('Vardiya süresi 1 ile 12 saat arasında olmalıdır');
  });

  it('Tam 1 saatlik vardiyayı kabul etmeli', () => {
    const endAt = new Date('2099-01-01T09:00:00Z');

    expect(() =>
      validateShiftPeriod(startAt, endAt),
    ).not.toThrow();
  });

  it('Tam 12 saatlik vardiyayı kabul etmeli', () => {
    const endAt = new Date('2099-01-01T20:00:00Z');

    expect(() =>
      validateShiftPeriod(startAt, endAt),
    ).not.toThrow();
  });

  it('Geçersiz tarihi reddetmeli', () => {
    const invalidDate = new Date('invalid-date');

    expect(() =>
      validateShiftPeriod(invalidDate, startAt),
    ).toThrow('Geçersiz vardiya tarihi');
  });

  it('Geçmişe vardiya oluşturmayı reddetmeli', () => {
    const pastStart = new Date('2020-01-01T08:00:00Z');
    const pastEnd = new Date('2020-01-01T16:00:00Z');

    expect(() =>
      validateShiftPeriod(pastStart, pastEnd, {
        checkPast: true,
      }),
    ).toThrow('Geçmişe vardiya oluşturulamaz');
  });
});
