import { randomUUID } from "node:crypto";

import type { RawJobInput } from "../../api/schemas/raw-job-input.schema.js";
import { JobRepository } from "./job.repository.js";

export class JobService {
  constructor(private readonly repository: JobRepository) { }

  async accept(
    input: RawJobInput,
    idempotencyKey: string
  ): Promise<{ detectionId: string; created: boolean }> {
    const ids = {
      rawInputId: randomUUID(),
      processingRunId: randomUUID(),
      detectionId: randomUUID()
    };

    return this.repository.createAcceptedJob(input, ids, idempotencyKey);
  }
}
