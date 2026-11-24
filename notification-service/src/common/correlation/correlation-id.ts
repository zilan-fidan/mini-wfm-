// workforce-service ve api ile aynı biçim kuralı. Olay/metadata dışarıdan geldiği için
// loga yazmadan önce doğrulanır (satır sonu enjeksiyonu vb. engellenir).
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export function safeCorrelationId(value: unknown): string {
  return typeof value === 'string' && CORRELATION_ID_PATTERN.test(value) ? value : '-';
}
