import { and, eq, gte, lt, sql } from "drizzle-orm";

import type { Database } from "../../database/client.js";
import { processingRuns } from "../../database/schema/index.js";

export type ClaimedProcessingRun = {
  id: string;
  attempt: number;
};

export class ProcessingRepository {
  constructor(private readonly db: Database) {}

  async recoverAbandonedRuns(timeoutMs: number): Promise<void> {
    const cutoff = new Date(Date.now() - timeoutMs);
    const abandonedRun = and(eq(processingRuns.status, "PROCESSING"), lt(processingRuns.startedAt, cutoff));

    await this.db
      .update(processingRuns)
      .set({ status: "FAILED", completedAt: new Date() })
      .where(and(abandonedRun, gte(processingRuns.attempt, 3)));

    await this.db
      .update(processingRuns)
      .set({ status: "PENDING", startedAt: null })
      .where(and(abandonedRun, lt(processingRuns.attempt, 3)));
  }

  async claimNextRun(): Promise<ClaimedProcessingRun | undefined> {
    return this.db.transaction(async (transaction) => {
      const result = await transaction.execute<{ id: string; attempt: number }>(sql`
        WITH next_run AS (
          SELECT id
          FROM processing_runs
          WHERE status = 'PENDING' AND attempt < 3
          ORDER BY id
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE processing_runs
        SET status = 'PROCESSING',
            started_at = NOW(),
            attempt = attempt + 1
        WHERE id = (SELECT id FROM next_run)
        RETURNING id, attempt
      `);

      return result.rows[0];
    });
  }

  async completeRun(id: string): Promise<void> {
    await this.db
      .update(processingRuns)
      .set({ status: "COMPLETED", completedAt: new Date(), lastError: null })
      .where(eq(processingRuns.id, id));
  }

  async retryOrFailRun(id: string, attempt: number, error: string): Promise<void> {
    await this.db
      .update(processingRuns)
      .set({
        status: attempt >= 3 ? "FAILED" : "PENDING",
        completedAt: attempt >= 3 ? new Date() : null,
        startedAt: attempt >= 3 ? sql`started_at` : null,
        lastError: error
      })
      .where(eq(processingRuns.id, id));
  }
}
