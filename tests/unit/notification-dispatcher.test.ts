
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

import type { NotificationRepository } from "../../src/modules/notifications/notification.repository.js";
import { NotificationDispatcher } from "../../src/modules/notifications/notification-dispatcher.js";
import type { TelegramClient } from "../../src/modules/notifications/telegram.client.js";

const notification = {
  id: "notification-1",
  jobOfferId: "offer-1",
  jobAnalysisId: "analysis-1",
  message: "Oferta de prueba\nhttps://example.com/jobs/1",
  detectedAt: new Date("2026-10-26T08:00:00Z"),
  createdAt: new Date("2026-10-26T08:00:00Z"),
  score: 85,
  coverage: 90,
  confidenceLevel: "HIGH" as const
};

function createHarness(
  batch: typeof notification[] | null = [notification]
) {
  const repository = {
    markAbandonedSendingUnknown: vi.fn().mockResolvedValue(0),
    reserveBatch: vi.fn().mockResolvedValue(batch),
    markSent: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    markUnknown: vi.fn().mockResolvedValue(undefined)
  };

  const telegram = {
    isConfigured: true,
    sendMessage: vi.fn().mockResolvedValue({
      status: "SENT",
      messageId: 123
    })
  };

  const reportError = vi.fn();

  const dispatcher = new NotificationDispatcher(
    repository as unknown as NotificationRepository,
    telegram as unknown as TelegramClient,
    10_800_000,
    reportError
  );

  return { dispatcher, repository, telegram, reportError };
}

describe("NotificationDispatcher", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("marca los envíos abandonados antes de reservar un lote", async () => {
    const { dispatcher, repository } = createHarness();

    try {
      await dispatcher.start();

      expect(
        repository.markAbandonedSendingUnknown
      ).toHaveBeenCalledOnce();

      expect(
        repository.markAbandonedSendingUnknown.mock.invocationCallOrder[0]
      ).toBeLessThan(
        repository.reserveBatch.mock.invocationCallOrder[0]
      );
    } finally {
      await dispatcher.stop();
    }
  });

  it("envía un solo mensaje y marca el lote como SENT", async () => {
    const { dispatcher, repository, telegram } = createHarness();

    try {
      await dispatcher.start();

      expect(telegram.sendMessage).toHaveBeenCalledOnce();
      expect(telegram.sendMessage).toHaveBeenCalledWith(
        notification.message
      );
      expect(repository.markSent).toHaveBeenCalledWith([
        notification.id
      ]);
      expect(repository.markFailed).not.toHaveBeenCalled();
      expect(repository.markUnknown).not.toHaveBeenCalled();
    } finally {
      await dispatcher.stop();
    }
  });

  it.each([
    {
      status: "FAILED" as const,
      reason: "Telegram rechazó el mensaje",
      method: "markFailed" as const
    },
    {
      status: "UNKNOWN" as const,
      reason: "No se pudo confirmar el envío",
      method: "markUnknown" as const
    }
  ])(
    "registra el resultado $status sin reintentar",
    async ({ status, reason, method }) => {
      const { dispatcher, repository, telegram } = createHarness();

      telegram.sendMessage.mockResolvedValue({
        status,
        reason
      });

      try {
        await dispatcher.start();

        expect(telegram.sendMessage).toHaveBeenCalledOnce();
        expect(repository[method]).toHaveBeenCalledWith(
          [notification.id],
          reason
        );
        expect(repository.markSent).not.toHaveBeenCalled();
      } finally {
        await dispatcher.stop();
      }
    }
  );

  it("no envía nada si todavía no hay un lote disponible", async () => {
    const { dispatcher, repository, telegram } = createHarness(null);

    try {
      await dispatcher.start();

      expect(telegram.sendMessage).not.toHaveBeenCalled();
      expect(repository.markSent).not.toHaveBeenCalled();
      expect(repository.markFailed).not.toHaveBeenCalled();
      expect(repository.markUnknown).not.toHaveBeenCalled();
    } finally {
      await dispatcher.stop();
    }
  });

  it("marca como FAILED un lote que supera el límite de Telegram", async () => {
    const oversized = {
      ...notification,
      message: "x".repeat(4097)
    };

    const { dispatcher, repository, telegram } =
      createHarness([oversized]);

    try {
      await dispatcher.start();

      expect(telegram.sendMessage).not.toHaveBeenCalled();
      expect(repository.markFailed).toHaveBeenCalledWith(
        [oversized.id],
        expect.stringContaining("4096")
      );
    } finally {
      await dispatcher.stop();
    }
  });

  it("marca como UNKNOWN si la llamada de Telegram lanza un error", async () => {
    const { dispatcher, repository, telegram, reportError } =
      createHarness();

    telegram.sendMessage.mockRejectedValue(
      new Error("Network error")
    );

    try {
      await dispatcher.start();

      expect(repository.markUnknown).toHaveBeenCalledWith(
        [notification.id],
        "Network error"
      );
      expect(reportError).toHaveBeenCalled();
    } finally {
      await dispatcher.stop();
    }
  });
});
