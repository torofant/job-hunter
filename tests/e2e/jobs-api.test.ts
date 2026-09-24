import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createApp } from "../../src/app.js";
import { jobDetections, processingRuns } from "../../src/database/schema/index.js";
import { clearDatabase, createTestDatabase } from "../helpers/database.js";
import { testEnvironment } from "../helpers/environment.js";

const processingTimeoutMs = 1_000;
const pollingIntervalMs = 10;

describe("POST /api/jobs", () => {
  const connection = createTestDatabase();
  const app = createApp(testEnvironment, connection);

  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(async () => {
    await clearDatabase(connection);
  });

  afterAll(async () => {
    await app.close();
  });

  async function waitForProcessingRun(detectionId: string, expectedStatus: "COMPLETED") {
    const deadline = Date.now() + processingTimeoutMs;

    while (Date.now() < deadline) {
      const [detection] = await connection.db
        .select({ processingRunId: jobDetections.processingRunId })
        .from(jobDetections)
        .where(eq(jobDetections.id, detectionId));

      if (detection) {
        const [run] = await connection.db
          .select()
          .from(processingRuns)
          .where(eq(processingRuns.id, detection.processingRunId));

        if (run?.status === expectedStatus) {
          return run;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollingIntervalMs));
    }

    throw new Error(`El procesamiento ${detectionId} no alcanzó ${expectedStatus} en ${processingTimeoutMs} ms`);
  }

  it("acepta una entrada autenticada y la procesa", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/jobs",
      headers: { authorization: "Bearer test-api-key" },
      payload: {
        source: "linkedin",
        title: "Developer",
        company: "Example",
        url: "https://example.com/jobs/1",
        detected_at: "2026-09-24T10:00:00Z",
        raw_metadata: { alert: "web" }
      }
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({
      status: "accepted",
      detection_id: expect.any(String)
    });

    const detectionId = response.json<{ detection_id: string }>().detection_id;
    const run = await waitForProcessingRun(detectionId, "COMPLETED");
    expect(run.status).toBe("COMPLETED");
  });

  it("rechaza una petición sin Authorization", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {}
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "UNAUTHORIZED", message: "No autorizado" });
  });

  it("rechaza una clave incorrecta", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/jobs",
      headers: { authorization: "Bearer incorrect" },
      payload: {}
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "UNAUTHORIZED", message: "No autorizado" });
  });

  it("rechaza una entrada inválida", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/jobs",
      headers: { authorization: "Bearer test-api-key" },
      payload: { source: "linkedin" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "VALIDATION_ERROR",
      message: "La entrada no es válida"
    });
  });
});
