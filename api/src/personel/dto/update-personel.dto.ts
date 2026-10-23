import { PartialType } from '@nestjs/swagger';
import { CreatedWorkforceUserDto } from './create-personel.dto';

export class UpdateWorkforceUserDto extends PartialType(CreatedWorkforceUserDto) {}
