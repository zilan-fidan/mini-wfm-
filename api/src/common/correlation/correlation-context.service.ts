import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface CorrelationStore {
  correlationId: string;
  // performance.now() değeri; süre ölçümü isteğin en başından başlar
  startedAt: number;
  // Erişim logunu interceptor yazacaksa true olur; middleware fallback'i çift log yazmasın diye
  handledByInterceptor?: boolean;
}

// Singleton provider: isteklerin birbirinden ayrılmasını DI scope'u değil AsyncLocalStorage sağlar
@Injectable()
export class CorrelationContextService {
  private readonly storage = new AsyncLocalStorage<CorrelationStore>();
 
  // (middleware)callback ve içinden başlayan tüm asenkron işler bu store'u görür
  run<T>(store: CorrelationStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }
// interceptor 
  getStore(): CorrelationStore | undefined {
    return this.storage.getStore();
  }

  //(dispatch hook ) İstek dışında (ör. uygulama açılışı) çağrılırsa undefined döner, hata fırlatmaz
  getCorrelationId(): string | undefined {
    return this.storage.getStore()?.correlationId;
  }
}
