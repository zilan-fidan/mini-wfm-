import dayjs, { type Dayjs } from 'dayjs';

// Backend saat dilimli ISO bekler: 2026-11-12T08:00:00+03:00
export const toIso = (value: Dayjs) => value.format('YYYY-MM-DDTHH:mm:ssZ');

export const formatDateTime = (value: string) => dayjs(value).format('DD.MM.YYYY HH:mm');
export const formatDate = (value: string) => dayjs(value).format('DD.MM.YYYY');
export const formatTime = (value: string) => dayjs(value).format('HH:mm');

// "1 sa 30 dk" yerine okunaklı saat: 7.5 sa
export const formatHours = (hours: number) =>
  `${hours.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} sa`;

export const durationHours = (startAt: string, endAt: string) =>
  dayjs(endAt).diff(dayjs(startAt), 'minute') / 60;
