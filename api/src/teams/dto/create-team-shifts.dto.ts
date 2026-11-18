import { OmitType } from '@nestjs/swagger';
import { CreateShiftDto } from '../../shifts/dto/create-shift.dto';

export class CreateTeamShiftsDto extends OmitType(CreateShiftDto, ['workforceUserId'] as const) {}
