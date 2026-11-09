// Yanıta yazılan ad; Node gelen header adlarını küçük harfe çevirdiği için okurken lowercase kullanılır
export const CORRELATION_ID_HEADER = 'X-Correlation-Id';
export const CORRELATION_ID_HEADER_LOWER = CORRELATION_ID_HEADER.toLowerCase();

// Gelen değer bu sınırlara uymazsa kullanılmaz: log injection, geçersiz header karakteri ve log şişmesine karşı
export const CORRELATION_ID_MAX_LENGTH = 128;
export const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

// TCP paketinin metadata alanındaki anahtar; workforce-service aynı anahtarla okur
export const CORRELATION_ID_METADATA_KEY = 'correlationId';
