import { overlapMinutes } from './interval';

// Testte saat dilimi karışmasın diye UTC (Z) kullanıyoruz.
const range = (start: string, end: string) => ({
  startAt: new Date(`2026-01-05T${start}:00Z`),
  endAt: new Date(`2026-01-05T${end}:00Z`),
});

describe('overlapMinutes', () => {
  it.each([
    ['kısmi kesişim', range('08:00', '12:00'), range('10:00', '14:00'), 120],
    ['biri ötekini içeriyor', range('08:00', '16:00'), range('10:00', '11:30'), 90],
    ['aynı aralık', range('08:00', '16:00'), range('08:00', '16:00'), 480],
    ['uç uca değiyor (yarı açık)', range('08:00', '12:00'), range('12:00', '14:00'), 0],
    ['tamamen ayrık', range('08:00', '10:00'), range('12:00', '14:00'), 0],
  ])('%s → %d dakika', (_name, a, b, expected) => {
    expect(overlapMinutes(a, b)).toBe(expected);
    // Sıra önemsiz olmalı: (a, b) ile (b, a) aynı sonucu verir
    expect(overlapMinutes(b, a)).toBe(expected);
  });
});
