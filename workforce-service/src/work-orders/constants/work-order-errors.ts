import { HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

// B21: optimistic locking çakışma mesajı
export const WORK_ORDER_VERSION_CONFLICT_MESSAGE =
  'Kayıt siz düzenlerken değişti, sayfayı yenileyin';

export const workOrderVersionConflict = () =>
  new RpcException({
    statusCode: HttpStatus.CONFLICT,
    message: WORK_ORDER_VERSION_CONFLICT_MESSAGE,
  });

export const workOrderNotFound = () =>
  new RpcException({
    statusCode: HttpStatus.NOT_FOUND,
    message: 'İş emri bulunamadı',
  });
