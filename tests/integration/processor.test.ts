import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

import { JobRepository } from "../../src/modules/jobs/job.repository.js";
import { JobService } from "../../src/modules/jobs/job.service.js";
import { processingRuns } from "../../src/database/schema/index.js";
import { Processor } from "../../src/modules/processing/processor.js";
import { ProcessingRepository } from "../../src/modules/processing/processing.repository.js";
import { clearDatabase, createTestDatabase } from "../helpers/database.js";

const input = {
  source: "linkedin",
  title: "Developer",
  company: "Example",
  url: "https://example.com/jobs/1",
  detected_at: new Date("2026-09-24T10:00:00Z")
};

describe("procesador interno", () => {
  const connection = createTestDatabase();
  const jobs = new JobRepository(connection.db);
  const runs = new ProcessingRepository(connection.db);
  const service = new JobService(jobs);
  const processor = new Processor(runs, jobs, 50);

  beforeEach(async () => {
    await clearDatabase(connection);
  });

  afterAll(async () => {
    await connection.close();
  });

  it("completa el procesamiento básico", async () => {
    await service.accept(input);

    await processor.processAvailable();

    const result = await connection.db.select().from(processingRuns);
    expect(result[0]).toEqual(expect.objectContaining({ status: "COMPLETED", attempt: 1 }));
  });

  it("recupera una ejecución PROCESSING abandonada", async () => {
    await service.accept(input);
    const [run] = await connection.db.select().from(processingRuns);
    await connection.db
      .update(processingRuns)
      .set({ status: "PROCESSING", startedAt: new Date(Date.now() - 1_000) })
      .where(eq(processingRuns.id, run.id));

    await processor.processAvailable();

    const [recovered] = await connection.db.select().from(processingRuns);
    expect(recovered).toEqual(expect.objectContaining({ status: "COMPLETED", attempt: 1 }));
  });

  it("marca como FAILED una ejecución abandonada en el tercer intento", async () => {
    await service.accept(input);
    const [run] = await connection.db.select().from(processingRuns);
    await connection.db
      .update(processingRuns)
      .set({
        status: "PROCESSING",
        attempt: 3,
        startedAt: new Date(Date.now() - 1_000),
        lastError: "Error anterior"
      })
      .where(eq(processingRuns.id, run.id));

    await processor.processAvailable();

    const [recovered] = await connection.db.select().from(processingRuns);
    expect(recovered).toEqual(
      expect.objectContaining({
        status: "FAILED",
        attempt: 3,
        lastError: "Error anterior",
        completedAt: expect.any(Date)
      })
    );
  });

  it("salta una ejecución bloqueada con FOR UPDATE SKIP LOCKED", async () => {
    await service.accept(input);
    const [run] = await connection.db.select().from(processingRuns);

    await connection.db.transaction(async (transaction) => {
      await transaction.execute(sql`SET LOCAL statement_timeout = '200ms'`);
      await transaction.execute(sql`SELECT id FROM processing_runs WHERE id = ${run.id} FOR UPDATE`);

      const claimedWhileLocked = await runs.claimNextRun();
      expect(claimedWhileLocked).toBeUndefined();
    });

    const claimedAfterRelease = await runs.claimNextRun();
    expect(claimedAfterRelease).toEqual(expect.objectContaining({ id: run.id, attempt: 1 }));
  });

  it("agota tres intentos inmediatos cuando falta la detección", async () => {
    await connection.db.insert(processingRuns).values({
      id: "00000000-0000-0000-0000-000000000001",
      status: "PENDING",
      attempt: 0
    });

    await processor.processAvailable();

    const [run] = await connection.db.select().from(processingRuns);
    expect(run).toEqual(
      expect.objectContaining({
        status: "FAILED",
        attempt: 3,
        lastError: "No existe una detección para la ejecución de procesamiento"
      })
    );
  });
});
