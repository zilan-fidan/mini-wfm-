import { randomUUID } from 'node:crypto';

export const CORRELATION_ID_MAX_LENGTH = 128;
export const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

// api'nin TCP paketinin metadata alanına yazdığı anahtar
export const CORRELATION_ID_METADATA_KEY = 'correlationId';

export function resolveCorrelationId(value: unknown): string {
  if (
    typeof value === 'string' &&
    value.length <= CORRELATION_ID_MAX_LENGTH &&
    CORRELATION_ID_PATTERN.test(value)
  ) {
    return value;
  }
  return randomUUID();
}