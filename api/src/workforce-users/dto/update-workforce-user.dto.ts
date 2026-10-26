import { PartialType } from '@nestjs/swagger';
import { CreateWorkforceUserDto } from './create-workforce-user.dto';

export class UpdateWorkforceUserDto extends PartialType(CreateWorkforceUserDto) {}
