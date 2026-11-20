// Puantaj performans ölçümü: 1.000 personel × 1 ay, sabit seed.
// Çalıştırma: pnpm bench:timesheet
//
// Veri üretimi ve doğrulama ölçüm DIŞINDADIR; veritabanı kullanılmaz.
// Yalnızca iki hesaplama fonksiyonunun bütün personeller üzerindeki çağrıları ölçülür.
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { calculateTimesheetMinuteByMinute } from '../../src/shifts/calc/timesheet-reference';
import { calculateTimesheetBySplitting } from '../../src/shifts/calc/timesheet-split';
import { TimesheetCalculator, TimesheetMonth } from '../../src/shifts/calc/timesheet.types';
import { generateMonths } from './timesheet-generator';

const SEED = 20261119;
const PEOPLE = 1000;
const MONTH = '2026-10'; // yarım gün + tam gün tatil ve ayı aşan haftalar içerir
const WARMUP_RUNS = 3;
const MEASURED_RUNS = 10;

const data = generateMonths(SEED, PEOPLE, MONTH);
const shiftCount = data.reduce((sum, person) => sum + person.shifts.length, 0);

// Ölçülen iş: bütün personellerin puantajı. Sonuç tutulur ki JIT hesaplamayı atlamasın.
let sink = 0;
const runAll = (calculate: TimesheetCalculator) => {
  for (const person of data) sink += calculate(person.shifts, person.month).totals.total;
};

const measure = (calculate: TimesheetCalculator) => {
  const times: number[] = [];
  for (let i = 0; i < WARMUP_RUNS; i++) runAll(calculate);
  for (let i = 0; i < MEASURED_RUNS; i++) {
    const started = performance.now();
    runAll(calculate);
    times.push(performance.now() - started);
  }
  const sorted = [...times].sort((a, b) => a - b);
  return {
    medianMs: (sorted[4] + sorted[5]) / 2,
    minMs: sorted[0],
    maxMs: sorted.at(-1)!,
    meanMs: times.reduce((a, b) => a + b, 0) / times.length,
  };
};

// Ölçüm dışında: iki sürümün aynı sonucu verdiğinin kısa kontrolü
const maxDiff = (a: TimesheetMonth, b: TimesheetMonth) =>
  Math.max(...Object.keys(a.totals).map((key) => Math.abs(a.totals[key as keyof typeof a.totals] - b.totals[key as keyof typeof b.totals])));
const worstDiff = Math.max(...data.map((p) => maxDiff(calculateTimesheetMinuteByMinute(p.shifts, p.month), calculateTimesheetBySplitting(p.shifts, p.month))));
const workedMinutes = data.reduce((sum, p) => sum + calculateTimesheetBySplitting(p.shifts, p.month).weeks.reduce((s, w) => s + w.total, 0), 0);

const reference = measure(calculateTimesheetMinuteByMinute);
const split = measure(calculateTimesheetBySplitting);
const fmt = (ms: number) => ms.toFixed(1);

console.log(`Koşullar: Node ${process.version}, ${os.cpus()[0]?.model ?? 'bilinmeyen CPU'} (${os.cpus().length} çekirdek), ${os.platform()} ${os.release()}, ${(os.totalmem() / 2 ** 30).toFixed(0)} GB RAM`);
console.log(`Veri: seed=${SEED}, ${PEOPLE} personel × ${MONTH}, ${shiftCount} vardiya, tam haftalarda ${(workedMinutes / 60).toFixed(0)} saat (${workedMinutes.toFixed(0)} dakika)`);
console.log(`Tekrar: ${WARMUP_RUNS} ısınma + ${MEASURED_RUNS} ölçüm (her ölçüm ${PEOPLE} personelin tamamı)`);
console.log(`İki sürüm arası en büyük ay toplamı farkı: ${worstDiff} dakika`);
console.log('');
console.log('| Algoritma | Medyan (ms) | Min (ms) | Maks (ms) | Ortalama (ms) | Personel başına medyan (ms) |');
console.log('|---|---:|---:|---:|---:|---:|');
for (const [name, r] of [['Dakika dakika (referans)', reference], ['Aralık bölme', split]] as const) {
  console.log(`| ${name} | ${fmt(r.medianMs)} | ${fmt(r.minMs)} | ${fmt(r.maxMs)} | ${fmt(r.meanMs)} | ${(r.medianMs / PEOPLE).toFixed(4)} |`);
}
console.log('');
console.log(`Hız farkı (medyan): aralık bölme ${(reference.medianMs / split.medianMs).toFixed(1)} kat daha hızlı`);
if (sink < 0) console.log(sink);
