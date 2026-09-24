import { eq } from "drizzle-orm";

import type { RawJobInput } from "../../api/schemas/raw-job-input.schema.js";
import type { Database } from "../../database/client.js";
import { jobDetections, processingRuns, rawJobInputs } from "../../database/schema/index.js";

export class JobRepository {
  constructor(private readonly db: Database) {}

  async createAcceptedJob(input: RawJobInput, ids: { rawInputId: string; processingRunId: string; detectionId: string }) {
    await this.db.transaction(async (transaction) => {
      await transaction.insert(rawJobInputs).values({
        id: ids.rawInputId,
        source: input.source,
        sourceJobId: input.source_job_id,
        title: input.title,
        company: input.company,
        url: input.url,
        description: input.description,
        location: input.location,
        detectedAt: input.detected_at,
        rawMetadata: input.raw_metadata
      });

      await transaction.insert(processingRuns).values({
        id: ids.processingRunId,
        status: "PENDING",
        attempt: 0
      });

      await transaction.insert(jobDetections).values({
        id: ids.detectionId,
        rawInputId: ids.rawInputId,
        processingRunId: ids.processingRunId,
        detectedAt: new Date()
      });
    });
  }

  async hasDetectionForRun(processingRunId: string): Promise<boolean> {
    const detection = await this.db
      .select({ id: jobDetections.id })
      .from(jobDetections)
      .where(eq(jobDetections.processingRunId, processingRunId))
      .limit(1);

    return detection.length === 1;
  }
}
