export type ApiErrorResponse = {
  statusCode: number;
  message: string | string[]; // doğrulama hatalarında dizi gelebilir
  details?: unknown; // çakışan personeller, kural ihlalleri, doldurulamayan slotlar...
};