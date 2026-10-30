import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { rawJobInputSchema } from "../schemas/raw-job-input.schema.js";
import type { JobService } from "../../modules/jobs/job.service.js";
import type { Processor } from "../../modules/processing/processor.js";
import { IdempotencyKeyConflictError } from "../../modules/jobs/job.repository.js";

export function registerJobRoutes(app: FastifyInstance, jobService: JobService, processor: Processor): void {
  app.post("/api/jobs", async (request, reply) => {
    const idempotencyKey = request.headers["idempotency-key"];

    if (idempotencyKey === undefined) {
      return reply.code(400).send({
        status: "error",
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "La cabecera Idempotency-Key es obligatoria"
      });
    }

    if (
      typeof idempotencyKey !== "string" ||
      !/^[\x21-\x7E]{1,255}$/.test(idempotencyKey)
    ) {
      return reply.code(400).send({
        status: "error",
        code: "IDEMPOTENCY_KEY_INVALID",
        message:
          "La cabecera Idempotency-Key debe contener entre 1 y 255 caracteres ASCII imprimibles, sin espacios"
      });
    }

    const parsed = rawJobInputSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new ZodError(parsed.error.issues);
    }

    try {
      const result = await jobService.accept(
        parsed.data,
        idempotencyKey
      );

      if (result.created) {
        void processor.processAvailable().catch((error: unknown) => {
          app.log.error(error, "Error al iniciar el procesamiento interno");
        });
      }

      return reply.code(202).send({
        status: "accepted",
        detection_id: result.detectionId
      });
    } catch (error) {
      if (error instanceof IdempotencyKeyConflictError) {
        return reply.code(409).send({
          status: "error",
          code: "IDEMPOTENCY_KEY_REUSED",
          message: "La clave Idempotency-Key ya se utilizó con otro contenido"
        });
      }

      throw error;
    }
  });

}
