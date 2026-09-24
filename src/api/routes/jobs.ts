import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { rawJobInputSchema } from "../schemas/raw-job-input.schema.js";
import type { JobService } from "../../modules/jobs/job.service.js";
import type { Processor } from "../../modules/processing/processor.js";

export function registerJobRoutes(app: FastifyInstance, jobService: JobService, processor: Processor): void {
  app.post("/api/jobs", async (request, reply) => {
    const parsed = rawJobInputSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ZodError(parsed.error.issues);
    }

    const { detectionId } = await jobService.accept(parsed.data);
    void processor.processAvailable().catch((error: unknown) => {
      app.log.error(error, "Error al iniciar el procesamiento interno");
    });

    return reply.code(202).send({ status: "accepted", detection_id: detectionId });
  });
}
