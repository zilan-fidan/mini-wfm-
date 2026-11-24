import { Logger } from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';
import type { Channel, Message } from 'amqplib';
import { InvalidEventError } from '../common/events/work-order-events';

// Geçici hatada (ör. veritabanı kapalı) mesaj hemen geri konursa aynı tüketiciye anında
// tekrar gelir ve döngü CPU'yu yakar. Kısa bir bekleme bu döngüyü yavaşlatır.
export const REQUEUE_DELAY_MS = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Manuel ack: mesaj yalnızca `work` başarıyla bittikten sonra kuyruktan silinir.
 *
 * - Başarı            → ack (kuyruktan silinir)
 * - InvalidEventError → nack, requeue=false (kalıcı hata; tekrar denemek işe yaramaz)
 * - Diğer hatalar     → bekle, nack, requeue=true (mesaj kuyruğa döner, yeniden denenir)
 *
 * Servis ack'ten önce çökerse RabbitMQ bağlantı kopunca mesajı kendisi kuyruğa geri koyar.
 */
export async function handleWithManualAck(
  context: RmqContext,
  logger: Logger,
  label: string,
  work: () => Promise<void>,
  requeueDelayMs = REQUEUE_DELAY_MS,
): Promise<void> {
  const channel = context.getChannelRef() as Channel;
  const message = context.getMessage() as Message;

  try {
    await work();
    channel.ack(message);
  } catch (error) {
    if (error instanceof InvalidEventError) {
      logger.error(`${label} geçersiz olay, kuyruktan atılıyor: ${error.message}`);
      channel.nack(message, false, false);
      return;
    }

    logger.error(
      `${label} işlenemedi, ${requeueDelayMs}ms sonra kuyruğa geri konacak`,
      error instanceof Error ? error.stack : String(error),
    );
    await sleep(requeueDelayMs);
    channel.nack(message, false, true);
  }
}
