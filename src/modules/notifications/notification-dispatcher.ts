
import type { NotificationRepository } from "./notification.repository.js";
import type { TelegramClient } from "./telegram.client.js";

const DISPATCH_INTERVAL_MS = 1_000;
const TELEGRAM_MAX_MESSAGE_LENGTH = 4_096;
const MESSAGE_SEPARATOR = "\n\n──────────\n\n";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Error desconocido durante el envío de notificaciones";
}

export class NotificationDispatcher {
  private timer: NodeJS.Timeout | undefined;
  private activeRun: Promise<void> | undefined;
  private started = false;

  constructor(
    private readonly repository: NotificationRepository,
    private readonly telegram: TelegramClient,
    private readonly batchWindowMs: number,
    private readonly reportError: (error: unknown) => void = () => undefined
  ) {
    if (!Number.isInteger(batchWindowMs) || batchWindowMs <= 0) {
      throw new Error("batchWindowMs debe ser un entero positivo");
    }
  }

  async start(): Promise<void> {
    if (this.started) return;

    // No reintentamos automáticamente los envíos interrumpidos.
    await this.repository.markAbandonedSendingUnknown();

    this.started = true;

    // Procesa inmediatamente cualquier lote que ya esté listo.
    await this.runSafely();

    this.timer = setInterval(() => {
      void this.runSafely();
    }, DISPATCH_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    this.started = false;

    // Espera a que termine la operación activa antes de cerrar la DB.
    await this.activeRun;
  }

  private runSafely(): Promise<void> {
    if (this.activeRun) return this.activeRun;

    this.activeRun = this.dispatchOnce()
      .catch((error: unknown) => {
        this.reportError(error);
      })
      .finally(() => {
        this.activeRun = undefined;
      });

    return this.activeRun;
  }

  private async dispatchOnce(): Promise<void> {
    const batch = await this.repository.reserveBatch(this.batchWindowMs);

    if (!batch || batch.length === 0) return;

    const ids = batch.map((notification) => notification.id);
    const message = batch
      .map((notification) => notification.message)
      .join(MESSAGE_SEPARATOR);

    try {
      if (message.length > TELEGRAM_MAX_MESSAGE_LENGTH) {
        await this.repository.markFailed(
          ids,
          `El mensaje del lote supera el límite de ${TELEGRAM_MAX_MESSAGE_LENGTH} caracteres de Telegram`
        );
        return;
      }

      const result = await this.telegram.sendMessage(message);

      if (result.status === "SENT") {
        await this.repository.markSent(ids);
      } else if (result.status === "FAILED") {
        await this.repository.markFailed(ids, result.reason);
      } else {
        await this.repository.markUnknown(ids, result.reason);
      }
    } catch (error) {
      // Si no podemos confirmar el resultado, nunca reenviamos el lote.
      try {
        await this.repository.markUnknown(ids, errorMessage(error));
      } catch (stateError) {
        this.reportError(stateError);
      }

      this.reportError(error);
    }
  }
}
