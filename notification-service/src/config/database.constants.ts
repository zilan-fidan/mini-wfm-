// Aynı veritabanını workforce-service de kullanıyor ve onun migration kayıtları "migrations"
// tablosunda. Ayrı tablo olmazsa iki servis birbirinin migration geçmişini görür.
export const NOTIFICATION_MIGRATIONS_TABLE = 'notification_migrations';
