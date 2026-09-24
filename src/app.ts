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

export function createApp(environment: Environment, connection?: DatabaseConnection): FastifyInstance {
  const database = connection ?? createDatabase(environment.DATABASE_URL);
  const app = Fastify();
  const jobRepository = new JobRepository(database.db);
  const processingRepository = new ProcessingRepository(database.db);
  const processor = new Processor(
    processingRepository,
    jobRepository,
    environment.PROCESSING_RECOVERY_TIMEOUT_MS,
    (error) => app.log.error(error, "Error en el procesador interno")
  );
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
  });

  app.addHook("onClose", async () => {
    processor.stop();
    await database.close();
  });

  return app;
}
