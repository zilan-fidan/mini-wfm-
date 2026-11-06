
import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';

export interface CorrelationStore {
  correlationId: string;

  // İsteğin başlangıç zamanı
  startedAt: number;

  // Çift log oluşmasını engeller
  handledByInterceptor?: boolean;

  // İsteği gerçekleştiren kullanıcı
  actor?: JwtPayload;
  
}

@Injectable()
export class CorrelationContextService {
  private readonly storage = new AsyncLocalStorage<CorrelationStore>();

  // Her isteğe ait bağımsız async bağlam oluşturur
  run<T>(store: CorrelationStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  // Aktif isteğin bütün bilgilerini döndürür
  getStore(): CorrelationStore | undefined {
    return this.storage.getStore();
  }

  // Correlation ID bilgisini döndürür
  getCorrelationId(): string | undefined {
    return this.storage.getStore()?.correlationId;
  }

  // Actor bilgisini kaydeder
  setActor(actor: JwtPayload): void {
    const store = this.storage.getStore();

    if (store) {
      store.actor = actor;
    }
  }

  // Actor bilgisini döndürür
  getActor(): JwtPayload | undefined {
    return this.storage.getStore()?.actor;
  }


}
