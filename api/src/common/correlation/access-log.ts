import { Logger } from '@nestjs/common';
import { Request, Response } from 'express';

// (satır formatı )Interceptor ve middleware fallback'i aynı formatı kullanır; format tek yerde tutulur
export function writeAccessLog(
  logger: Logger,
  req: Request,
  res: Response,
  startedAt: number,
  correlationId: string,
) {
  const duration = Math.round(performance.now() - startedAt);
  const message = `${req.method} ${req.originalUrl} statusCode=${res.statusCode} duration=${duration}ms correlationId=${correlationId}`;

  if (res.statusCode >= 500) logger.error(message);
  else if (res.statusCode >= 400) logger.warn(message);
  else logger.log(message);
}
