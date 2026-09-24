import { randomUUID } from "node:crypto";

import type { RawJobInput } from "../../api/schemas/raw-job-input.schema.js";
import { JobRepository } from "./job.repository.js";

export class JobService {
  constructor(private readonly repository: JobRepository) {}

  async accept(input: RawJobInput): Promise<{ detectionId: string }> {
    const ids = {
      rawInputId: randomUUID(),
      processingRunId: randomUUID(),
      detectionId: randomUUID()
    };

    await this.repository.createAcceptedJob(input, ids);

    return { detectionId: ids.detectionId };
  }
}
