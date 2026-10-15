export type ApiErrorResponse = {
  statusCode: number;
  message: string | string[]; // doğrulama hatalarında dizi gelebilir
};