import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { TimesheetService } from './timesheet.service';
import { TimesheetResponse, toTimesheetResponse } from './timesheet.response';
import { calculateTimesheetBySplitting } from './calc/timesheet-split';
import { DEFAULT_TIMESHEET_OPTIONS, isSupportedMonth, isValidMonth, resolveTimesheetPeriod } from './calc/timesheet.types';

export type TimesheetQuery = {
  workforceUserId: number;
  month: string; // YYYY-MM
};

@Controller()
export class TimesheetController {
  constructor(private readonly timesheetService: TimesheetService) {}

  // Personelin aylık puantajı (aralık bölme algoritması).
  @MessagePattern('getWorkforceUserTimesheet')
  async getTimesheet(@Payload() query: TimesheetQuery): Promise<TimesheetResponse> {
    const { workforceUserId, month } = query;

    //  Girdi doğrulaması
    if (!Number.isInteger(workforceUserId) || workforceUserId <= 0) {
      throw new RpcException({ statusCode: 400, message: 'Geçersiz personel ID değeri' });
    }
    if (!isValidMonth(month)) {
      throw new RpcException({ statusCode: 400, message: 'Ay YYYY-MM biçiminde olmalıdır' });
    }
    if (!isSupportedMonth(month)) {
      throw new RpcException({ statusCode: 400, message: 'Bu ay için resmî tatil takvimi tanımlı değil (desteklenen yıllar: 2026–2027)' });
    }

    // Personel var mı?
    if (!(await this.timesheetService.workforceUserExists(workforceUserId))) {
      throw new RpcException({ statusCode: 404, message: 'Personel bulunamadı' });
    }

    // Ayı kapsayan tam haftalarla kesişen vardiyalar okunur ve hesaplanır.
    const period = resolveTimesheetPeriod(month, DEFAULT_TIMESHEET_OPTIONS);
    const shifts = await this.timesheetService.findShiftsInRange(workforceUserId, new Date(period.weeksStart), new Date(period.weeksEnd));
    return toTimesheetResponse(workforceUserId, calculateTimesheetBySplitting(shifts, month, DEFAULT_TIMESHEET_OPTIONS));
  }
}
