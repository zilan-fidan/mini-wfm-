// MWFM-37: Otomatik rotasyon planı — saf hesaplama katmanı.
// Bu dosya veritabanını, Nest'i ve sistem saatini bilmez: aynı girdi her zaman aynı çıktıyı üretir.
// Hatalı girdide düz Error fırlatır; HTTP/RPC'ye çevirmek servis katmanının işidir (timesheet.types ile aynı düzen).
import { Interval, MS_PER_MINUTE, overlapMinutes } from '../../common/calc/interval';
import { DEFAULT_WORK_RULE_OPTIONS, MS_PER_DAY, ShiftInterval, WorkRuleOptions, checkWorkRules } from './work-rules';


// Vardiya kalıbı: her plan gününe bir kez yerleştirilir.
export type RotationSlot = {
  name: string;
  startTime: string; // "HH:mm" yerel, 00:00–23:59
  endTime: string;   // "HH:mm" yerel, 00:01–24:00; başlangıca eşit/küçükse ertesi güne taşar
  required: number;  // ihtiyaç duyulan personel sayısı
};

export type RotationRequest = {
  startDate: string; // YYYY-MM-DD, yerel takvim günü
  days: number;      // 1–14
  slots: readonly RotationSlot[];
};

export type RotationOptions = {
  workRules: WorkRuleOptions; // MWFM-35 kuralları; değiştirilmeden aynen kullanılır
  sortSlotsByStart: boolean;  // false yalnızca sıralamanın etkisini gösteren testler içindir
};

export const DEFAULT_ROTATION_OPTIONS: RotationOptions = {
  workRules: DEFAULT_WORK_RULE_OPTIONS,
  sortSlotsByStart: true,
};

export const MINUTES_PER_DAY = 24 * 60;
export const MAX_ROTATION_DAYS = 14;

// ---------- Tarih / saat yardımcıları ----------

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

/**
 * "YYYY-MM-DD" metnini o takvim gününün UTC gece yarısına (ms) çevirir.
 *
 * Neden: Takvim aritmetiğini saat diliminden bağımsız yapmak için günler önce UTC gece yarısı olarak temsil edilir;
 * yerel saate kaydırma ayrı bir adımda (resolveSlotInterval) yapılır.
 * Date.UTC geçersiz günleri sessizce düzeltir (2026-02-30 → 2026-03-02); sonuç tekrar metne çevrilip
 * girdiyle karşılaştırılarak bu taşma yakalanır.
 *
 * @returns UTC gece yarısı (ms); biçim hatalı veya gün takvimde yoksa null.
 */
function parseLocalDate(date: string): number | null {
  const match = DATE_PATTERN.exec(date);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const utcMidnight = Date.UTC(year, month - 1, day);
  return new Date(utcMidnight).toISOString().slice(0, 10) === date ? utcMidnight : null;
}

/**
 * Metnin YYYY-MM-DD biçiminde ve takvimde gerçekten var olan bir gün olup olmadığını söyler.
 * Örn. "2028-02-29" → true (artık yıl), "2026-02-29" → false, "2026-11-2" → false.
 */
export function isValidLocalDate(date: string): boolean {
  return parseLocalDate(date) !== null;
}

/**
 * "HH:mm" saatini gece yarısından itibaren geçen dakikaya çevirir ("08:30" → 510).
 *
 * "24:00" günün sonu demektir (1440) ve yalnızca allowEndOfDay=true iken, yani bitiş saati için kabul edilir;
 * başlangıç olarak 24:00 aslında ertesi günün 00:00'ıdır ve reddedilir.
 *
 * @returns 0–1439 (bitişte 1440'a kadar) dakika; biçim veya aralık hatalıysa null.
 */
export function parseTimeOfDay(time: string, { allowEndOfDay = false } = {}): number | null {
  const match = TIME_PATTERN.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours === 24 && minutes === 0) return allowEndOfDay ? MINUTES_PER_DAY : null;
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Planın kapsadığı yerel günleri kronolojik sırayla üretir.
 * ("2026-12-31", 2) → ["2026-12-31", "2027-01-01"]; ay ve yıl geçişleri doğal olarak çalışır.
 *
 * Gün eklemek UTC gece yarıları üzerinde yapıldığı için saat dilimi veya offset sonucu etkilemez.
 *
 * @throws startDate geçersizse.
 */
export function planDates(startDate: string, days: number): string[] {
  const start = parseLocalDate(startDate);
  if (start === null) throw new Error(`Geçersiz tarih: ${startDate}`);
  return Array.from({ length: days }, (_, i) =>
    new Date(start + i * MS_PER_DAY).toISOString().slice(0, 10),
  );
}

/**
 * Kalıbın, ait olduğu günün 00:00'ından itibaren başlangıç ve bitiş dakikasını hesaplar.
 *
 * Bitiş başlangıçtan büyük değilse vardiya gece yarısını geçiyor demektir ve bitişe bir gün (1440 dk) eklenir:
 * 16:00–24:00 → { 960, 1440 } (aynı gün), 22:00–06:00 → { 1320, 1800 } (ertesi güne taşar).
 * Kalıpları başlangıç saatine göre sıralamak için de kullanılır.
 *
 * @throws Saatlerden biri geçersizse.
 */
export function slotMinutes(slot: RotationSlot): { start: number; end: number } {
  const start = parseTimeOfDay(slot.startTime);
  const end = parseTimeOfDay(slot.endTime, { allowEndOfDay: true });
  if (start === null || end === null) {
    throw new Error(`Geçersiz vardiya saati: ${slot.name} ${slot.startTime}–${slot.endTime}`);
  }
  return { start, end: end > start ? end : end + MINUTES_PER_DAY };
}

/**
 * Bir kalıbı verilen yerel güne yerleştirir ve checkWorkRules'un beklediği UTC Date aralığına çevirir.
 *
 * Yerel 00:00 = UTC gece yarısı − offset (Türkiye +180 dk → önceki gün 21:00Z); kalıbın dakikaları buna eklenir.
 * Offset MWFM-35'in WorkRuleOptions.utcOffsetMinutes alanından okunur; böylece kural kontrolüyle aynı
 * "hangi gün" varsayımı kullanılır. Örn. ("2026-11-02", Akşam 16:00–24:00) → 13:00Z – 21:00Z.
 *
 * @throws Tarih veya kalıp saatleri geçersizse.
 */
export function resolveSlotInterval(
  date: string,
  slot: RotationSlot,
  options: WorkRuleOptions = DEFAULT_WORK_RULE_OPTIONS,
): Interval {
  const utcMidnight = parseLocalDate(date);
  if (utcMidnight === null) throw new Error(`Geçersiz tarih: ${date}`);
  const localMidnight = utcMidnight - options.utcOffsetMinutes * MS_PER_MINUTE;
  const { start, end } = slotMinutes(slot);
  return {
    startAt: new Date(localMidnight + start * MS_PER_MINUTE),
    endAt: new Date(localMidnight + end * MS_PER_MINUTE),
  };
}

// ---------- Girdi doğrulama ----------

/**
 * Rotasyon isteğinin iş kurallarına uygunluğunu kontrol eder ve İLK hatanın mesajını döndürür.
 *
 * Kontroller: startDate geçerli gün; days 1–14 tam sayı; en az bir kalıp; kalıp adı boş değil ve tekrar etmiyor
 * (atamalar ve unfilled kayıtları tarih + ad ile tanımlanır); saatler geçerli; required pozitif tam sayı.
 * Controller bu mesajı 400'e çevirir. buildRotationPlan da aynı fonksiyonu çağırır; böylece saf fonksiyon
 * tek başına (örn. testte) hatalı girdiyle çağrıldığında sessizce yanlış plan üretmez.
 *
 * @returns Hata mesajı; istek geçerliyse null.
 */
export function validateRotationRequest(request: RotationRequest): string | null {
  if (!isValidLocalDate(request.startDate)) return 'startDate YYYY-MM-DD biçiminde geçerli bir tarih olmalıdır';
  if (!Number.isInteger(request.days) || request.days < 1 || request.days > MAX_ROTATION_DAYS) {
    return `days 1 ile ${MAX_ROTATION_DAYS} arasında bir tam sayı olmalıdır`;
  }
  if (request.slots.length === 0) return 'En az bir vardiya kalıbı gönderilmelidir';
  const names = new Set<string>();
  for (const slot of request.slots) {
    if (slot.name.trim() === '') return 'Vardiya adı boş olamaz';
    // unfilled ve atamalar (tarih, ad) ile tanımlanır; aynı ad belirsizlik yaratır.
    if (names.has(slot.name)) return `Vardiya adı tekrar ediyor: ${slot.name}`;
    names.add(slot.name);
    if (parseTimeOfDay(slot.startTime) === null || parseTimeOfDay(slot.endTime, { allowEndOfDay: true }) === null) {
      return `Geçersiz vardiya saati: ${slot.name}`;
    }
    if (!Number.isInteger(slot.required) || slot.required < 1) {
      return `required pozitif bir tam sayı olmalıdır: ${slot.name}`;
    }
  }
  return null;
}

export type RotationMember = {
  id: number;
  registrationNumber: string; // sicil no — eşitlikte deterministik sıralama anahtarı
  firstname: string;
  lastname: string;
};

// Personelin veritabanındaki mevcut vardiyası (plan dışı).
export type ExistingShift = ShiftInterval & { workforceUserId: number };

type MemberRef = Pick<RotationMember, 'registrationNumber' | 'firstname' | 'lastname'> & { workforceUserId: number };

export type RotationAssignment = MemberRef & Interval & {
  date: string;     // kalıbın ait olduğu yerel gün (YYYY-MM-DD)
  slotName: string;
};

export type UnfilledSlot = Interval & {
  date: string;
  slotName: string;
  required: number;
  assigned: number;
  missing: number;
};

// Yalnızca BU plandaki çalışma; mevcut vardiyalar dahil değildir.
export type MemberWorkload = MemberRef & {
  minutes: number;
  shiftCount: number;
};

export type RotationPlan = {
  assignments: RotationAssignment[];
  workloads: MemberWorkload[];     // tüm aktif üyeler, hiç vardiya almayanlar dahil; sicil sırasıyla
  unfilled: UnfilledSlot[];
  fairnessGapMinutes: number;      // en çok − en az plan dakikası
};

/**
 * İki metni kod birimine göre karşılaştırır (sort için -1 / 0 / 1).
 * localeCompare yerine kullanılır, çünkü localeCompare ortamın diline göre farklı sonuç verebilir;
 * bu karşılaştırma her makinede aynıdır ve planın deterministik olmasını sağlar.
 */
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Üyelerin sabit sırası: önce sicil numarası, eşitse id.
 * Hem girdi sırasından bağımsız işlem sırası hem de iş yükü eşitliğinde son karar için kullanılır.
 */
const compareMembers = (a: RotationMember, b: RotationMember) =>
  compareText(a.registrationNumber, b.registrationNumber) || a.id - b.id;

/**
 * Kalıpları başlangıç saatine göre artan sıralanmış bir KOPYA olarak döndürür (girdi dizisi değişmez).
 * Eşitlikte bitiş saatine, sonra ada bakılır. Örn. [Sabah 08, Akşam 16, Gece 00] → [Gece, Sabah, Akşam].
 *
 * Neden: Greedy planlayıcı kararlarını zaman çizelgesi sırasıyla vermelidir; aksi hâlde 00:00'da başlayan
 * Gece vardiyası günün en sonunda planlanır ve dinlenme kuralları yüzünden çıkmaza girer (Test 3).
 */
export function sortSlotsByStart(slots: readonly RotationSlot[]): RotationSlot[] {
  return [...slots].sort((a, b) => {
    const x = slotMinutes(a);
    const y = slotMinutes(b);
    return x.start - y.start || x.end - y.end || compareText(a.name, b.name);
  });
}

/** Aralığın süresini dakika olarak verir; plan içi iş yükünü (adalet) biriktirmek için kullanılır. */
const durationMinutes = (interval: Interval) =>
  (interval.endAt.getTime() - interval.startAt.getTime()) / MS_PER_MINUTE;

/**
 * Aralığın yeni Date nesneleriyle bağımsız bir kopyasını oluşturur.
 * Date değiştirilebilir (mutable) olduğundan atamalar, plan durumu ve unfilled aynı nesneyi paylaşmaz;
 * birinin değişmesi diğerini bozamaz.
 */
const copyInterval = (interval: Interval): Interval => ({
  startAt: new Date(interval.startAt.getTime()),
  endAt: new Date(interval.endAt.getTime()),
});

/** Üyeden çıktıda gösterilecek kimlik alanlarını seçer (id → workforceUserId); fazladan entity alanı taşınmaz. */
const toMemberRef = (member: RotationMember): MemberRef => ({
  workforceUserId: member.id,
  registrationNumber: member.registrationNumber,
  firstname: member.firstname,
  lastname: member.lastname,
});

/**
 * Ekip için greedy (açgözlü) rotasyon planı oluşturur. Saf fonksiyondur: girdileri değiştirmez,
 * veritabanı, sistem saati veya rastgelelik kullanmaz; aynı girdi her zaman aynı planı verir.
 *
 * Algoritma:
 *  1. Günleri kronolojik, her günün kalıplarını başlangıç saatine göre dolaşır.
 *  2. Her kalıp için aday = aktif üyeler; mevcut veya plan içi vardiyasıyla çakışan ve
 *     MWFM-35 checkWorkRules ile REST / WEEKLY_LIMIT / CONSECUTIVE_DAYS ihlal eden adaylar elenir.
 *  3. Kalanlar plan içi çalışma dakikasına göre artan, eşitlikte sicil no ve id ile sıralanır;
 *     ilk `required` kişi seçilir ve plan durumu güncellenir (sonraki kontroller bu atamayı görür).
 *  4. Yeterli aday yoksa eksik sayı unfilled'a yazılır; önceki seçimlere geri dönülmez, sıradaki kalıba geçilir.
 *
 * @param members        Ekibin aktif üyeleri (girdi sırası önemsizdir).
 * @param existingShifts Üyelerin plan dışındaki mevcut vardiyaları (plan aralığı ± kural penceresi).
 * @param request        Başlangıç günü, gün sayısı ve kalıplar.
 * @param options        Çalışma kuralları ve kalıp sıralamasının açık/kapalı olması.
 * @returns Atamalar, tüm üyelerin plan içi iş yükü, doldurulamayan vardiyalar ve adalet farkı (dakika).
 * @throws İstek validateRotationRequest'ten geçmiyorsa.
 */
export function buildRotationPlan(
  members: readonly RotationMember[],
  existingShifts: readonly ExistingShift[],
  request: RotationRequest,
  options: RotationOptions = DEFAULT_ROTATION_OPTIONS,
): RotationPlan {
  const error = validateRotationRequest(request);
  if (error) throw new Error(error);

  // Girdi sırası sonucu etkilemesin: üyeler her zaman sicil sırasıyla ele alınır.
  const orderedMembers = [...members].sort(compareMembers);
  const slots = options.sortSlotsByStart ? sortSlotsByStart(request.slots) : [...request.slots];

  // Personel başına mevcut vardiyalar (yalnızca okunur) ve plan durumu.
  // Plan durumu her atamada YENİ dizi/değerle güncellenir; girdilere dokunulmaz.
  const existingByMember = new Map<number, ShiftInterval[]>(orderedMembers.map((m) => [m.id, []]));
  for (const shift of existingShifts) {
    existingByMember.get(shift.workforceUserId)?.push(shift);
  }
  const plannedByMember = new Map<number, ShiftInterval[]>(orderedMembers.map((m) => [m.id, []]));
  const minutesByMember = new Map<number, number>(orderedMembers.map((m) => [m.id, 0]));

  const assignments: RotationAssignment[] = [];
  const unfilled: UnfilledSlot[] = [];

  /**
   * Üye bu vardiyaya atanabilir mi? Üyenin mevcut + plan içi vardiyaları birlikte değerlendirilir:
   * önce aynı saatte başka vardiyası var mı (çakışma), sonra MWFM-35 checkWorkRules ihlal veriyor mu.
   * Yeni vardiya plan içi iki vardiyanın arasına düşerse REST iki komşuya da bakar.
   */
  const isEligible = (member: RotationMember, interval: Interval): boolean => {
    const known = [...existingByMember.get(member.id)!, ...plannedByMember.get(member.id)!];
    if (known.some((shift) => overlapMinutes(shift, interval) > 0)) return false;
    return checkWorkRules(known, [interval], options.workRules).length === 0;
  };

  /**
   * Adalet sıralaması: bu planda o ana kadar daha az çalışmış üye öne geçer.
   * Dakikalar eşitse compareMembers (sicil no, sonra id) ile deterministik karar verilir.
   */
  const byWorkload = (a: RotationMember, b: RotationMember) =>
    minutesByMember.get(a.id)! - minutesByMember.get(b.id)! || compareMembers(a, b);

  for (const date of planDates(request.startDate, request.days)) {
    for (const slot of slots) {
      const interval = resolveSlotInterval(date, slot, options.workRules);
      const chosen = orderedMembers
        .filter((member) => isEligible(member, interval))
        .sort(byWorkload)
        .slice(0, slot.required);

      for (const member of chosen) {
        // Her kişiye ayrı kopya: Date nesneleri atamalar arasında paylaşılmaz.
        const shift = copyInterval(interval);
        plannedByMember.set(member.id, [...plannedByMember.get(member.id)!, shift]);
        minutesByMember.set(member.id, minutesByMember.get(member.id)! + durationMinutes(shift));
        assignments.push({ date, slotName: slot.name, ...toMemberRef(member), ...copyInterval(shift) });
      }

      // Yetersiz aday: eksik sayı kaydedilir, geri dönülmez; sıradaki kalıba geçilir.
      if (chosen.length < slot.required) {
        unfilled.push({
          date,
          slotName: slot.name,
          ...copyInterval(interval),
          required: slot.required,
          assigned: chosen.length,
          missing: slot.required - chosen.length,
        });
      }
    }
  }

  const workloads = orderedMembers.map((member) => ({
    ...toMemberRef(member),
    minutes: minutesByMember.get(member.id)!,
    shiftCount: plannedByMember.get(member.id)!.length,
  }));
  const minutes = workloads.map((workload) => workload.minutes);

  return {
    assignments,
    workloads,
    unfilled,
    fairnessGapMinutes: minutes.length > 0 ? Math.max(...minutes) - Math.min(...minutes) : 0,
  };
}
