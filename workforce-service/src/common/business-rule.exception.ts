import { HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

export class BusinessRuleException extends RpcException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
  ) {
    super({ statusCode, message });
  }
}