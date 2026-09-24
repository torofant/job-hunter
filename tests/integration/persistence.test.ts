import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { JobRepository } from "../../src/modules/jobs/job.repository.js";
import { JobService } from "../../src/modules/jobs/job.service.js";
import { processingRuns, rawJobInputs } from "../../src/database/schema/index.js";
import { clearDatabase, createTestDatabase } from "../helpers/database.js";

const input = {
  source: "linkedin",
  title: "Developer",
  company: "Example",
  url: "https://example.com/jobs/1",
  detected_at: new Date("2026-09-24T10:00:00Z")
};

describe("persistencia de la aceptación", () => {
  const connection = createTestDatabase();
  const service = new JobService(new JobRepository(connection.db));

  beforeAll(async () => {
    await connection.db.execute(sql`SELECT 1`);
  });

  beforeEach(async () => {
    await clearDatabase(connection);
  });

  afterAll(async () => {
    await connection.close();
  });

  it("crea RawJobInput, ProcessingRun y JobDetection", async () => {
    const { detectionId } = await service.accept(input);
    const detections = await connection.db.execute<{ count: string }>(sql`SELECT count(*) FROM job_detections`);
    const rawInputs = await connection.db.select().from(rawJobInputs);
    const runs = await connection.db.select().from(processingRuns);

    expect(detectionId).toHaveLength(36);
    expect(detections.rows[0]?.count).toBe("1");
    expect(rawInputs).toHaveLength(1);
    expect(runs).toEqual([
      expect.objectContaining({ status: "PENDING", attempt: 0, lastError: null })
    ]);
  });

  it("revierte la creación completa si falla una inserción", async () => {
    const existing = await service.accept(input);
    const [existingRun] = await connection.db.select().from(processingRuns);

    await expect(
      new JobRepository(connection.db).createAcceptedJob(input, {
        rawInputId: "00000000-0000-0000-0000-000000000010",
        processingRunId: existingRun.id,
        detectionId: "00000000-0000-0000-0000-000000000011"
      })
    ).rejects.toThrow();

    const rawInputs = await connection.db.select().from(rawJobInputs);
    expect(existing.detectionId).toHaveLength(36);
    expect(rawInputs).toHaveLength(1);
  });
});
