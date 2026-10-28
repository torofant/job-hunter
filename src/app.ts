import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { createAuthentication } from "./api/plugins/authentication.js";
import { registerJobRoutes } from "./api/routes/jobs.js";
import type { Environment } from "./config/env.js";
import { createDatabase, type DatabaseConnection } from "./database/client.js";
import { JobRepository } from "./modules/jobs/job.repository.js";
import { JobService } from "./modules/jobs/job.service.js";
import { Processor } from "./modules/processing/processor.js";
import { ProcessingRepository } from "./modules/processing/processing.repository.js";
import { JobEnrichmentService } from "./modules/jobs/job-enrichment.service.js";
import { UserProfileRepository } from "./modules/jobs/user-profile.repository.js";
import { JobRequirementExtractionService } from "./modules/jobs/requirement-extraction.service.js";
import { NotificationDispatcher } from "./modules/notifications/notification-dispatcher.js";
import { NotificationRepository } from "./modules/notifications/notification.repository.js";
import { TelegramClient } from "./modules/notifications/telegram.client.js";

type AppDependencies = {
  jobEnrichmentService?: JobEnrichmentService;
  requirementExtractionService?: JobRequirementExtractionService;
};

export function createApp(
  environment: Environment,
  connection?: DatabaseConnection,
  dependencies: AppDependencies = {}
): FastifyInstance {
  const database = connection ?? createDatabase(environment.DATABASE_URL);
  const app = Fastify();

  const jobRepository = new JobRepository(database.db);
  const processingRepository = new ProcessingRepository(database.db);
  const userProfileRepository = new UserProfileRepository(database.db);

  const jobEnrichmentService =
    dependencies.jobEnrichmentService ??
    new JobEnrichmentService(environment.ANTHROPIC_API_KEY);

  const requirementExtractionService =
    dependencies.requirementExtractionService ??
    new JobRequirementExtractionService(environment.ANTHROPIC_API_KEY);

  const processor = new Processor(
    processingRepository,
    jobRepository,
    jobEnrichmentService,
    environment.PROCESSING_RECOVERY_TIMEOUT_MS,
    userProfileRepository,
    requirementExtractionService,
    (error: unknown) =>
      app.log.error(error, "Error en el procesador interno")
  );

  const notificationRepository = new NotificationRepository(database.db);

  const telegramClient = new TelegramClient({
    botToken: environment.TELEGRAM_BOT_TOKEN,
    chatId: environment.TELEGRAM_CHAT_ID
  });

  const notificationDispatcher = telegramClient.isConfigured
    ? new NotificationDispatcher(
      notificationRepository,
      telegramClient,
      environment.TELEGRAM_BATCH_WINDOW_MS,
      (error: unknown) =>
        app.log.error(error, "Error en el despachador de notificaciones")
    )
    : undefined;

  if (!telegramClient.isConfigured) {
    app.log.warn(
      "Telegram no está configurado; el envío de notificaciones permanece desactivado"
    );
  }

  const jobService = new JobService(jobRepository);

  app.addHook("preHandler", createAuthentication(environment.API_KEY));

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "VALIDATION_ERROR",
        message: "La entrada no es válida"
      });
    }

    app.log.error(error);
    return reply.code(500).send({
      error: "INTERNAL_ERROR",
      message: "Error interno del servidor"
    });
  });

  registerJobRoutes(app, jobService, processor);

  app.addHook("onReady", async () => {
    processor.start();

    if (notificationDispatcher) {
      await notificationDispatcher.start();
    } else {
      await notificationRepository.markAbandonedSendingUnknown();
    }
  });

  app.addHook("onClose", async () => {
    await processor.stop();

    try {
      await notificationDispatcher?.stop();
    } finally {
      await database.close();
    }
  });

  return app;
}
