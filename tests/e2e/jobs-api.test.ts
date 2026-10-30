import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createApp } from "../../src/app.js";
import {
  jobDetections,
  processingRuns,
  userProfiles,
  rawJobInputs,
  idempotencyKeys
} from "../../src/database/schema/index.js";
import { clearDatabase, createTestDatabase } from "../helpers/database.js";
import { testEnvironment } from "../helpers/environment.js";
import type { JobEnrichmentService } from "../../src/modules/jobs/job-enrichment.service.js";
import type { JobRequirementExtractionService } from "../../src/modules/jobs/requirement-extraction.service.js";

const processingTimeoutMs = 1_000;
const pollingIntervalMs = 10;

describe("POST /api/jobs", () => {
  const connection = createTestDatabase();

  const app = createApp(testEnvironment, connection, {
    jobEnrichmentService: {
      enrich: async () => ({
        enrichment: {
          jobFamily: "WEB",
          role: "WEB_DEVELOPER",
          country: "Spain",
          city: "Castellón de la Plana",
          modality: "REMOTE",
          contract: "PERMANENT",
          employmentType: "EMPLOYEE",
          workingHours: "FULL_TIME"
        },
        inputTokens: 100,
        outputTokens: 50,
        model: "claude-haiku-4-5"
      })
    } as unknown as JobEnrichmentService,

    requirementExtractionService: {
      extract: async () => ({
        result: { requirements: [] },
        inputTokens: 100,
        outputTokens: 20,
        model: "claude-haiku-4-5",
        promptVersion: "1.0.0"
      })
    } as unknown as JobRequirementExtractionService
  });

  beforeAll(async () => {
    await connection.db
      .insert(userProfiles)
      .values({
        id: "00000000-0000-4000-8000-000000000001",
        locationPreferences: {
          remoteAllowed: true,
          hybridAllowed: true,
          onsiteAllowed: true,
          hybridMaxCity: null,
          onsiteMaxDistanceKm: null,
          relocationAllowed: false
        },
        employmentPreferences: {
          fullTimeAllowed: true,
          partTimeAllowed: true,
          permanentAllowed: true,
          temporaryAllowed: false,
          internshipAllowed: false,
          scholarshipAllowed: false,
          traineeAllowed: false,
          freelanceAllowed: true,
          selfEmployedAllowed: true
        },
        salaryPreferences: {
          currency: "EUR",
          minimum: 20000,
          desired: 24000
        }
      })
      .onConflictDoUpdate({
        target: userProfiles.id,
        set: {
          locationPreferences: {
            remoteAllowed: true,
            hybridAllowed: true,
            onsiteAllowed: true,
            hybridMaxCity: null,
            onsiteMaxDistanceKm: null,
            relocationAllowed: false
          },
          employmentPreferences: {
            fullTimeAllowed: true,
            partTimeAllowed: true,
            permanentAllowed: true,
            temporaryAllowed: false,
            internshipAllowed: false,
            scholarshipAllowed: false,
            traineeAllowed: false,
            freelanceAllowed: true,
            selfEmployedAllowed: true
          },
          salaryPreferences: {
            currency: "EUR",
            minimum: 20000,
            desired: 24000
          }
        }
      });

    await app.ready();
  });

  beforeEach(async () => {
    await clearDatabase(connection);
  });

  afterAll(async () => {
    await app.close();
  });

  async function waitForProcessingRun(
    detectionId: string,
    expectedStatus: "COMPLETED"
  ) {
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

    throw new Error(
      `El procesamiento ${detectionId} no alcanzó ${expectedStatus} en ${processingTimeoutMs} ms`
    );
  }

  it("acepta una entrada autenticada y la procesa", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/jobs",
      headers: {
        authorization: "Bearer test-api-key",
        "idempotency-key": "e2e-job-acceptance-001"
      },
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
    expect(response.json()).toEqual({
      error: "UNAUTHORIZED",
      message: "No autorizado"
    });
  });

  it("rechaza una clave incorrecta", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/jobs",
      headers: { authorization: "Bearer incorrect" },
      payload: {}
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "UNAUTHORIZED",
      message: "No autorizado"
    });
  });

  it("rechaza una entrada inválida", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/jobs",
      headers: {
        authorization: "Bearer test-api-key",
        "idempotency-key": "e2e-invalid-input-001"
      },
      payload: { source: "linkedin" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "VALIDATION_ERROR",
      message: "La entrada no es válida"
    });
  });

  it("rechaza una entrada sin Idempotency-Key", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/jobs",
      headers: { authorization: "Bearer test-api-key" },
      payload: {
        source: "linkedin",
        title: "Developer",
        company: "Example",
        url: "https://example.com/jobs/no-key",
        detected_at: "2026-09-24T10:00:00Z"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("IDEMPOTENCY_KEY_REQUIRED");
  });

  it("reutiliza la detección cuando se repite la misma clave y contenido", async () => {
    const payload = {
      source: "linkedin",
      title: "Developer",
      company: "Example",
      url: "https://example.com/jobs/retry",
      detected_at: "2026-09-24T10:00:00Z"
    };

    const headers = {
      authorization: "Bearer test-api-key",
      "idempotency-key": "e2e-job-retry-001"
    };

    const first = await app.inject({
      method: "POST",
      url: "/api/jobs",
      headers,
      payload
    });

    const second = await app.inject({
      method: "POST",
      url: "/api/jobs",
      headers,
      payload
    });

    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(202);

    const firstId = first.json<{ detection_id: string }>().detection_id;
    const secondId = second.json<{ detection_id: string }>().detection_id;

    expect(secondId).toBe(firstId);

    const detections = await connection.db
      .select()
      .from(jobDetections);

    const rawInputs = await connection.db
      .select()
      .from(rawJobInputs);

    const keys = await connection.db
      .select()
      .from(idempotencyKeys);

    expect(detections).toHaveLength(1);
    expect(rawInputs).toHaveLength(1);
    expect(keys).toHaveLength(1);
  });

  it("procesa peticiones concurrentes con la misma clave una sola vez", async () => {
    const headers = {
      authorization: "Bearer test-api-key",
      "idempotency-key": "e2e-job-concurrent-001"
    };

    const payload = {
      source: "linkedin",
      title: "Concurrent Developer",
      company: "Example",
      url: "https://example.com/jobs/concurrent",
      detected_at: "2026-09-24T10:00:00Z"
    };

    const [first, second] = await Promise.all([
      app.inject({
        method: "POST",
        url: "/api/jobs",
        headers,
        payload
      }),
      app.inject({
        method: "POST",
        url: "/api/jobs",
        headers,
        payload
      })
    ]);

    expect(first.statusCode, `Primera respuesta: ${first.body}`).toBe(202);
    expect(second.statusCode, `Segunda respuesta: ${second.body}`).toBe(202);

    const firstId = first.json<{ detection_id: string }>().detection_id;
    const secondId = second.json<{ detection_id: string }>().detection_id;

    expect(secondId).toBe(firstId);

    const detections = await connection.db
      .select()
      .from(jobDetections);

    const rawInputs = await connection.db
      .select()
      .from(rawJobInputs);

    const keys = await connection.db
      .select()
      .from(idempotencyKeys);

    expect(detections).toHaveLength(1);
    expect(rawInputs).toHaveLength(1);
    expect(keys).toHaveLength(1);
  });

  it("rechaza la misma clave con contenido diferente", async () => {
    const headers = {
      authorization: "Bearer test-api-key",
      "idempotency-key": "e2e-job-conflict-001"
    };

    const payload = {
      source: "linkedin",
      title: "Developer",
      company: "Example",
      url: "https://example.com/jobs/conflict",
      detected_at: "2026-09-24T10:00:00Z"
    };

    const first = await app.inject({
      method: "POST",
      url: "/api/jobs",
      headers,
      payload
    });

    const second = await app.inject({
      method: "POST",
      url: "/api/jobs",
      headers,
      payload: { ...payload, title: "Senior Developer" }
    });

    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(409);
    expect(second.json().code).toBe("IDEMPOTENCY_KEY_REUSED");

    const detections = await connection.db
      .select()
      .from(jobDetections);

    expect(detections).toHaveLength(1);
  });

  it.each([
    ["clave vacía", ""],
    ["espacios", "invalid key"],
    ["carácter de control", "invalid\nkey"],
    ["caracteres no ASCII", "clavé"],
    ["más de 255 caracteres", "a".repeat(256)]
  ])("rechaza una Idempotency-Key inválida: %s", async (_description, key) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/jobs",
      headers: {
        authorization: "Bearer test-api-key",
        "idempotency-key": key
      },
      payload: {
        source: "linkedin",
        title: "Developer",
        company: "Example",
        url: "https://example.com/jobs/invalid-key",
        detected_at: "2026-09-24T10:00:00Z"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("IDEMPOTENCY_KEY_INVALID");
  });

  it("acepta una Idempotency-Key de 255 caracteres", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/jobs",
      headers: {
        authorization: "Bearer test-api-key",
        "idempotency-key": "a".repeat(255)
      },
      payload: {
        source: "linkedin",
        title: "Developer",
        company: "Example",
        url: "https://example.com/jobs/max-key",
        detected_at: "2026-09-24T10:00:00Z"
      }
    });

    expect(response.statusCode).toBe(202);
  });

  it("reconoce como idénticas las fechas equivalentes y raw_metadata ausente o null", async () => {
    const headers = {
      authorization: "Bearer test-api-key",
      "idempotency-key": "e2e-job-canonical-001"
    };

    const first = await app.inject({
      method: "POST",
      url: "/api/jobs",
      headers,
      payload: {
        source: "linkedin",
        title: "Developer",
        company: "Example",
        url: "https://example.com/jobs/canonical",
        detected_at: "2026-09-24T10:00:00Z"
      }
    });

    const second = await app.inject({
      method: "POST",
      url: "/api/jobs",
      headers,
      payload: {
        detected_at: "2026-09-24T12:00:00+02:00",
        url: "https://example.com/jobs/canonical",
        company: "Example",
        title: "Developer",
        source: "linkedin",
        raw_metadata: null
      }
    });

    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(202);

    expect(
      second.json<{ detection_id: string }>().detection_id
    ).toBe(
      first.json<{ detection_id: string }>().detection_id
    );

    const detections = await connection.db.select().from(jobDetections);
    const rawInputs = await connection.db.select().from(rawJobInputs);
    const keys = await connection.db.select().from(idempotencyKeys);

    expect(detections).toHaveLength(1);
    expect(rawInputs).toHaveLength(1);
    expect(keys).toHaveLength(1);
  });
});