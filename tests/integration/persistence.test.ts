import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";

import { JobRepository } from "../../src/modules/jobs/job.repository.js";
import { JobService } from "../../src/modules/jobs/job.service.js";
import { clearDatabase, createTestDatabase } from "../helpers/database.js";
import { randomUUID } from "node:crypto";
import {
  jobAnalyses,
  jobOffers,
  notifications,
  processingRuns,
  rawJobInputs,
  requirements,
  requirementMatches
} from "../../src/database/schema/index.js";
import type { Requirement } from "../../src/modules/jobs/requirement.js";
import type { RequirementMatch } from "../../src/modules/jobs/requirement-match.js";
import { buildMatchingSummary } from "../../src/modules/jobs/matching-summary.js";

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

  it("crea un JobOffer nuevo", async () => {
    const jobOfferId = randomUUID();

    await connection.db.insert(jobOffers).values({
      id: jobOfferId,
      source: "linkedin",
      sourceJobId: "job-123",
      normalizedUrl: "https://example.com/jobs/job-123",
      title: "Desarrollador Web",
      company: "Example",
      jobFamily: "WEB",
      role: "WEB_DEVELOPER",
      country: "España",
      city: "Castellón de la Plana",
      modality: "ONSITE",
      distanceKm: 5,
      contract: "PERMANENT",
      employmentType: "EMPLOYEE",
      workingHours: "FULL_TIME"
    });

    const result = await connection.db
      .select()
      .from(jobOffers);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: jobOfferId,
      source: "linkedin",
      sourceJobId: "job-123",
      normalizedUrl: "https://example.com/jobs/job-123",
      title: "Desarrollador Web"
    });
  });

  it("permite que dos detecciones apunten al mismo JobOffer", async () => {
    const jobOfferId = randomUUID();

    await connection.db.insert(jobOffers).values({
      id: jobOfferId,
      source: "linkedin",
      sourceJobId: "job-123",
      normalizedUrl: "https://example.com/jobs/job-123",
      title: "Desarrollador Web",
      company: "Example",
      jobFamily: "WEB",
      role: "WEB_DEVELOPER",
      country: "España",
      city: "Castellón de la Plana",
      modality: "REMOTE",
      distanceKm: null,
      contract: "PERMANENT",
      employmentType: "EMPLOYEE",
      workingHours: "FULL_TIME"
    });

    const detectionIds = [
      randomUUID(),
      randomUUID()
    ];

    // Aquí utilizaremos los IDs de RawJobInput y ProcessingRun
    // que ya emplea el helper existente para crear detecciones.
  });

  it("reutiliza un JobOffer existente por source + sourceJobId", async () => {
    const jobOfferId = randomUUID();

    await connection.db.insert(jobOffers).values({
      id: jobOfferId,
      source: "linkedin",
      sourceJobId: "job-123",
      normalizedUrl: "https://example.com/jobs/job-123",
      title: "Desarrollador Web",
      company: "Example",
      jobFamily: "WEB",
      role: "WEB_DEVELOPER",
      country: "España",
      city: "Castellón de la Plana",
      modality: "REMOTE",
      distanceKm: null,
      contract: "PERMANENT",
      employmentType: "EMPLOYEE",
      workingHours: "FULL_TIME"
    });

    const result = await connection.db
      .select()
      .from(jobOffers)
      .where(
        and(
          eq(jobOffers.source, "linkedin"),
          eq(jobOffers.sourceJobId, "job-123")
        )
      );

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(jobOfferId);
  });

  it("reutiliza un JobOffer existente por source + sourceJobId", async () => {
    const repository = new JobRepository(connection.db);
    const jobOfferId = randomUUID();

    await connection.db.insert(jobOffers).values({
      id: jobOfferId,
      source: "linkedin",
      sourceJobId: "job-123",
      normalizedUrl: "https://example.com/jobs/job-123",
      title: "Desarrollador Web",
      company: "Example",
      jobFamily: "WEB",
      role: "WEB_DEVELOPER",
      country: "España",
      city: "Castellón de la Plana",
      modality: "REMOTE",
      distanceKm: null,
      contract: "PERMANENT",
      employmentType: "EMPLOYEE",
      workingHours: "FULL_TIME"
    });

    const result = await repository.findOrCreateJobOffer({
      id: randomUUID(),
      source: "linkedin",
      sourceJobId: "job-123",
      normalizedUrl: "https://example.com/jobs/otra-url",
      title: "Otro título",
      company: "Otra empresa",
      jobFamily: "SOFTWARE",
      role: "SOFTWARE_DEVELOPER",
      country: "España",
      city: "Valencia",
      modality: "ONSITE",
      distanceKm: 60,
      contract: "PERMANENT",
      employmentType: "EMPLOYEE",
      workingHours: "FULL_TIME"
    });

    expect(result.id).toBe(jobOfferId);
  });

  it("reutiliza un JobOffer existente por normalizedUrl", async () => {
    const repository = new JobRepository(connection.db);
    const jobOfferId = randomUUID();

    await connection.db.insert(jobOffers).values({
      id: jobOfferId,
      source: "linkedin",
      sourceJobId: "job-123",
      normalizedUrl: "https://example.com/jobs/job-123",
      title: "Desarrollador Web",
      company: "Example",
      jobFamily: "WEB",
      role: "WEB_DEVELOPER",
      country: "España",
      city: "Castellón de la Plana",
      modality: "REMOTE",
      distanceKm: null,
      contract: "PERMANENT",
      employmentType: "EMPLOYEE",
      workingHours: "FULL_TIME"
    });

    const result = await repository.findOrCreateJobOffer({
      id: randomUUID(),
      source: "infojobs",
      sourceJobId: "different-job-id",
      normalizedUrl: "https://example.com/jobs/job-123",
      title: "Otro título",
      company: "Otra empresa",
      jobFamily: "SOFTWARE",
      role: "SOFTWARE_DEVELOPER",
      country: "España",
      city: "Valencia",
      modality: "ONSITE",
      distanceKm: 60,
      contract: "PERMANENT",
      employmentType: "EMPLOYEE",
      workingHours: "FULL_TIME"
    });

    expect(result.id).toBe(jobOfferId);
  });

  it("crea un nuevo JobOffer cuando no existe una coincidencia", async () => {
    const repository = new JobRepository(connection.db);

    const result = await repository.findOrCreateJobOffer({
      id: randomUUID(),
      source: "linkedin",
      sourceJobId: "job-new",
      normalizedUrl: "https://example.com/jobs/job-new",
      title: "Backend Developer",
      company: "Example",
      jobFamily: "SOFTWARE",
      role: "BACKEND_DEVELOPER",
      country: "España",
      city: "Castellón de la Plana",
      modality: "REMOTE",
      distanceKm: null,
      contract: "PERMANENT",
      employmentType: "EMPLOYEE",
      workingHours: "FULL_TIME"
    });

    const stored = await connection.db
      .select()
      .from(jobOffers)
      .where(eq(jobOffers.id, result.id));

    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      id: result.id,
      source: "linkedin",
      sourceJobId: "job-new",
      normalizedUrl: "https://example.com/jobs/job-new",
      title: "Backend Developer"
    });
  });

  it("actualiza un JobOffer existente sin borrar datos con null", async () => {
    const repository = new JobRepository(connection.db);
    const jobOfferId = randomUUID();

    await connection.db.insert(jobOffers).values({
      id: jobOfferId,
      source: "linkedin",
      sourceJobId: "job-123",
      normalizedUrl: "https://example.com/jobs/job-123",
      title: "Desarrollador Web",
      company: "Empresa X",
      jobFamily: "WEB",
      role: "WEB_DEVELOPER",
      country: "España",
      city: "Castellón",
      modality: "REMOTE",
      distanceKm: null,
      contract: "PERMANENT",
      employmentType: "EMPLOYEE",
      workingHours: "FULL_TIME"
    });

    const result = await repository.findOrCreateJobOffer({
      id: randomUUID(),
      source: "linkedin",
      sourceJobId: "job-123",
      normalizedUrl: "https://example.com/jobs/job-123",
      title: "Desarrollador Web Full Stack",
      company: "Empresa X",
      jobFamily: "SOFTWARE",
      role: "FULL_STACK_DEVELOPER",
      country: "España",
      city: null,
      modality: "HYBRID",
      distanceKm: 12,
      contract: "PERMANENT",
      employmentType: "EMPLOYEE",
      workingHours: "FULL_TIME"
    });

    expect(result.id).toBe(jobOfferId);

    const stored = await connection.db
      .select()
      .from(jobOffers)
      .where(eq(jobOffers.id, jobOfferId));

    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      id: jobOfferId,
      title: "Desarrollador Web Full Stack",
      jobFamily: "SOFTWARE",
      role: "FULL_STACK_DEVELOPER",
      city: "Castellón",
      modality: "HYBRID",
      distanceKm: 12
    });
  });

  it("persiste el uso de IA asociado a una detección", async () => {
    const repository = new JobRepository(connection.db);

    const { detectionId } = await service.accept(input);

    const result = await repository.createAIUsage({
      detectionId,
      provider: "anthropic",
      model: "claude-haiku-4-5",
      purpose: "ENRICHMENT",
      promptVersion: "1.0.0",
      inputTokens: 100,
      outputTokens: 50,
      estimatedCost: null
    });

    expect(result).toMatchObject({
      detectionId,
      provider: "anthropic",
      model: "claude-haiku-4-5",
      purpose: "ENRICHMENT",
      promptVersion: "1.0.0",
      inputTokens: 100,
      outputTokens: 50,
      estimatedCost: null
    });
  });

  it("recupera una detección y su RawJobInput por processingRunId", async () => {
    const repository = new JobRepository(connection.db);

    const { detectionId } = await service.accept(input);

    const runs = await connection.db.select().from(processingRuns);
    const run = runs[0];

    expect(run).toBeDefined();

    const result = await repository.getDetectionForRun(run.id);

    expect(result).toBeDefined();
    expect(result?.detectionId).toBe(detectionId);

    expect(result?.rawInput).toMatchObject({
      source: input.source,
      title: input.title,
      company: input.company,
      url: input.url,
      detected_at: input.detected_at
    });
  });

  it("persiste los requisitos, las coincidencias y el resumen en una transacción", async () => {
    const repository = new JobRepository(connection.db);

    // Creamos el ProcessingRun necesario para el análisis.
    await service.accept(input);
    const [run] = await connection.db.select().from(processingRuns);

    const jobOfferId = randomUUID();
    const jobAnalysisId = randomUUID();

    await connection.db.insert(jobOffers).values({
      id: jobOfferId,
      source: "linkedin",
      sourceJobId: "job-analysis-1",
      normalizedUrl: "https://example.com/jobs/job-analysis-1",
      title: "Desarrollador Web",
      company: "Example",
      jobFamily: "WEB",
      role: "WEB_DEVELOPER",
      country: "España",
      city: "Castellón de la Plana",
      modality: "REMOTE",
      distanceKm: null,
      contract: "PERMANENT",
      employmentType: "EMPLOYEE",
      workingHours: "FULL_TIME"
    });

    await connection.db.insert(jobAnalyses).values({
      id: jobAnalysisId,
      jobOfferId,
      processingRunId: run.id,
      version: 1,
      matchingSummary: null,
      requirementExtractionStatus: "PENDING",
      createdAt: new Date()
    });

    const requirement: Requirement = {
      id: randomUUID(),
      category: "technology",
      type: "single",
      importance: "required",
      data: { technology: "JavaScript" }
    };

    const match: RequirementMatch = {
      requirementId: requirement.id,
      result: "MATCH",
      evidence: { source: "technology_profile" }
    };

    const matchingSummary = buildMatchingSummary([
      { requirement, match }
    ]);

    await repository.persistCompletedJobAnalysis({
      jobAnalysisId,
      requirements: [requirement],
      matches: [match],
      matchingSummary,
      score: 85,
      coverage: 90,
      coverageBreakdown: {
        job_type: 100,
        technologies: 50,
        experience: null,
        location: 100,
        employment_conditions: 100,
        languages: null,
        other_requirements: null
      },
      confidence: "MEDIUM",
      notification: {
        message: "Backend Developer — Example\nScore: 85/100\nhttps://example.com/jobs/job-analysis-1",
        detectedAt: new Date("2026-09-24T10:00:00Z")
      }
    });

    const persistedRequirements = await connection.db
      .select()
      .from(requirements);

    const persistedMatches = await connection.db
      .select()
      .from(requirementMatches);

    const [persistedAnalysis] = await connection.db
      .select()
      .from(jobAnalyses);

    expect(persistedRequirements).toHaveLength(1);
    expect(persistedRequirements[0]).toMatchObject({
      id: requirement.id,
      jobOfferId,
      category: "TECHNOLOGY",
      type: "SINGLE",
      importance: "REQUIRED",
      active: true,
      data: { technology: "JavaScript" }
    });

    expect(persistedMatches).toHaveLength(1);
    expect(persistedMatches[0]).toMatchObject({
      jobAnalysisId,
      requirementId: requirement.id,
      result: "MATCH",
      evidence: { source: "technology_profile" }
    });

    expect(persistedAnalysis).toMatchObject({
      id: jobAnalysisId,
      requirementExtractionStatus: "COMPLETED",
      matchingSummary
    })

    expect(persistedAnalysis?.score).toBe(85);
    expect(persistedAnalysis?.coverage).toBe(90);
    expect(persistedAnalysis?.coverageBreakdown).toEqual({
      job_type: 100,
      technologies: 50,
      experience: null,
      location: 100,
      employment_conditions: 100,
      languages: null,
      other_requirements: null
    });
    expect(persistedAnalysis?.confidenceLevel).toBe("MEDIUM");

    const persistedNotifications = await connection.db
      .select()
      .from(notifications);

    expect(persistedNotifications).toHaveLength(1);
    expect(persistedNotifications[0]).toMatchObject({
      jobOfferId,
      jobAnalysisId,
      status: "PENDING",
      message: expect.stringContaining("Backend Developer"),
      detectedAt: new Date("2026-09-24T10:00:00Z")
    });
  });

  it("reutiliza los IDs de requisitos activos cuando el conjunto no cambia", async () => {
    const repository = new JobRepository(connection.db);

    await service.accept(input);
    const [run] = await connection.db.select().from(processingRuns);

    const jobOfferId = randomUUID();
    const firstAnalysisId = randomUUID();
    const secondAnalysisId = randomUUID();
    const requirementId = randomUUID();

    await connection.db.insert(jobOffers).values({
      id: jobOfferId,
      source: "linkedin",
      sourceJobId: "reuse-requirement",
      normalizedUrl: "https://example.com/jobs/reuse-requirement",
      title: "Desarrollador Web",
      company: "Example",
      jobFamily: "WEB",
      role: "WEB_DEVELOPER",
      country: "España",
      city: "Castellón de la Plana",
      modality: "REMOTE",
      distanceKm: null,
      contract: "PERMANENT",
      employmentType: "EMPLOYEE",
      workingHours: "FULL_TIME"
    });

    const requirement: Requirement = {
      id: requirementId,
      category: "technology",
      type: "single",
      importance: "required",
      data: { technology: "JavaScript" }
    };

    const firstMatch: RequirementMatch = {
      requirementId,
      result: "MATCH",
      evidence: { source: "technology_profile" }
    };

    await connection.db.insert(jobAnalyses).values([
      {
        id: firstAnalysisId,
        jobOfferId,
        processingRunId: run.id,
        version: 1,
        matchingSummary: null,
        requirementExtractionStatus: "PENDING",
        createdAt: new Date()
      },
      {
        id: secondAnalysisId,
        jobOfferId,
        processingRunId: run.id,
        version: 1,
        matchingSummary: null,
        requirementExtractionStatus: "PENDING",
        createdAt: new Date()
      }
    ]);

    await repository.persistCompletedJobAnalysis({
      jobAnalysisId: firstAnalysisId,
      requirements: [requirement],
      matches: [firstMatch],
      matchingSummary: buildMatchingSummary([
        { requirement, match: firstMatch }
      ]),
      score: 85,
      coverage: 90,
      coverageBreakdown: {
        job_type: 100,
        technologies: 50,
        experience: null,
        location: 100,
        employment_conditions: 100,
        languages: null,
        other_requirements: null
      },
      confidence: "MEDIUM",
      notification: {
        message: "Backend Developer\nScore: 85/100\nhttps://example.com/jobs/reuse-requirement",
        detectedAt: new Date("2026-09-24T10:00:00Z")
      }
    });

    // La segunda extracción trae el mismo requisito con otro ID.
    const newlyExtractedRequirement: Requirement = {
      ...requirement,
      id: randomUUID()
    };

    const secondMatch: RequirementMatch = {
      requirementId: newlyExtractedRequirement.id,
      result: "MATCH",
      evidence: { source: "technology_profile" }
    };

    await repository.persistCompletedJobAnalysis({
      jobAnalysisId: secondAnalysisId,
      requirements: [newlyExtractedRequirement],
      matches: [secondMatch],
      matchingSummary: buildMatchingSummary([
        {
          requirement: newlyExtractedRequirement,
          match: secondMatch
        }
      ]),
      score: 85,
      coverage: 90,
      coverageBreakdown: {
        job_type: 100,
        technologies: 50,
        experience: null,
        location: 100,
        employment_conditions: 100,
        languages: null,
        other_requirements: null
      },
      confidence: "MEDIUM",
      notification: {
        message: "Backend Developer\nScore: 85/100\nhttps://example.com/jobs/reuse-requirement",
        detectedAt: new Date("2026-09-24T10:00:00Z")
      }
    });

    const persistedRequirements = await connection.db
      .select()
      .from(requirements);

    const persistedMatches = await connection.db
      .select()
      .from(requirementMatches);

    expect(persistedRequirements).toHaveLength(1);
    expect(persistedRequirements[0]).toMatchObject({
      id: requirementId,
      active: true
    });

    expect(persistedMatches).toHaveLength(2);
    expect(persistedMatches.map((match) => match.requirementId)).toEqual([
      requirementId,
      requirementId
    ]);

    const persistedNotifications = await connection.db
      .select()
      .from(notifications);

    expect(persistedNotifications).toHaveLength(1);
    expect(persistedNotifications[0]).toMatchObject({
      jobOfferId,
      status: "PENDING"
    });
  });

  it("desactiva los requisitos anteriores cuando cambia el conjunto", async () => {
    const repository = new JobRepository(connection.db);

    await service.accept(input);
    const [run] = await connection.db.select().from(processingRuns);

    const jobOfferId = randomUUID();
    const firstAnalysisId = randomUUID();
    const secondAnalysisId = randomUUID();

    await connection.db.insert(jobOffers).values({
      id: jobOfferId,
      source: "linkedin",
      sourceJobId: "replace-requirement",
      normalizedUrl: "https://example.com/jobs/replace-requirement",
      title: "Desarrollador Web",
      company: "Example",
      jobFamily: "WEB",
      role: "WEB_DEVELOPER",
      country: "España",
      city: "Castellón de la Plana",
      modality: "REMOTE",
      distanceKm: null,
      contract: "PERMANENT",
      employmentType: "EMPLOYEE",
      workingHours: "FULL_TIME"
    });

    await connection.db.insert(jobAnalyses).values([
      {
        id: firstAnalysisId,
        jobOfferId,
        processingRunId: run.id,
        version: 1,
        matchingSummary: null,
        requirementExtractionStatus: "PENDING",
        createdAt: new Date()
      },
      {
        id: secondAnalysisId,
        jobOfferId,
        processingRunId: run.id,
        version: 1,
        matchingSummary: null,
        requirementExtractionStatus: "PENDING",
        createdAt: new Date()
      }
    ]);

    const oldRequirement: Requirement = {
      id: randomUUID(),
      category: "technology",
      type: "single",
      importance: "required",
      data: { technology: "JavaScript" }
    };

    const oldMatch: RequirementMatch = {
      requirementId: oldRequirement.id,
      result: "MATCH",
      evidence: { source: "technology_profile" }
    };

    await repository.persistCompletedJobAnalysis({
      jobAnalysisId: firstAnalysisId,
      requirements: [oldRequirement],
      matches: [oldMatch],
      matchingSummary: buildMatchingSummary([
        { requirement: oldRequirement, match: oldMatch }
      ]),
      score: 85,
      coverage: 90,
      coverageBreakdown: {
        job_type: 100,
        technologies: 50,
        experience: null,
        location: 100,
        employment_conditions: 100,
        languages: null,
        other_requirements: null
      },
      confidence: "MEDIUM"
    });

    const newRequirement: Requirement = {
      id: randomUUID(),
      category: "technology",
      type: "single",
      importance: "required",
      data: { technology: "TypeScript" }
    };

    const newMatch: RequirementMatch = {
      requirementId: newRequirement.id,
      result: "MATCH",
      evidence: { source: "technology_profile" }
    };

    await repository.persistCompletedJobAnalysis({
      jobAnalysisId: secondAnalysisId,
      requirements: [newRequirement],
      matches: [newMatch],
      matchingSummary: buildMatchingSummary([
        { requirement: newRequirement, match: newMatch }
      ]),
      score: 85,
      coverage: 90,
      coverageBreakdown: {
        job_type: 100,
        technologies: 50,
        experience: null,
        location: 100,
        employment_conditions: 100,
        languages: null,
        other_requirements: null
      },
      confidence: "MEDIUM"
    });

    const persistedRequirements = await connection.db
      .select()
      .from(requirements);

    const persistedMatches = await connection.db
      .select()
      .from(requirementMatches);

    expect(persistedRequirements).toHaveLength(2);
    expect(persistedRequirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: oldRequirement.id,
          active: false,
          data: { technology: "JavaScript" }
        }),
        expect.objectContaining({
          id: newRequirement.id,
          active: true,
          data: { technology: "TypeScript" }
        })
      ])
    );

    // La coincidencia histórica sigue apuntando al requisito antiguo.
    expect(persistedMatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          jobAnalysisId: firstAnalysisId,
          requirementId: oldRequirement.id
        }),
        expect.objectContaining({
          jobAnalysisId: secondAnalysisId,
          requirementId: newRequirement.id
        })
      ])
    );
  });

  it("marca como FAILED un JobAnalysis pendiente", async () => {
    const repository = new JobRepository(connection.db);

    await service.accept(input);
    const [run] = await connection.db.select().from(processingRuns);

    const jobOfferId = randomUUID();
    const jobAnalysisId = randomUUID();

    await connection.db.insert(jobOffers).values({
      id: jobOfferId,
      source: "linkedin",
      sourceJobId: "failed-analysis",
      normalizedUrl: "https://example.com/jobs/failed-analysis",
      title: "Desarrollador Web",
      company: "Example",
      jobFamily: "WEB",
      role: "WEB_DEVELOPER",
      country: "España",
      city: "Castellón de la Plana",
      modality: "REMOTE",
      distanceKm: null,
      contract: "PERMANENT",
      employmentType: "EMPLOYEE",
      workingHours: "FULL_TIME"
    });

    await connection.db.insert(jobAnalyses).values({
      id: jobAnalysisId,
      jobOfferId,
      processingRunId: run.id,
      version: 1,
      matchingSummary: null,
      requirementExtractionStatus: "PENDING",
      createdAt: new Date()
    });

    await repository.markRequirementExtractionFailed(jobAnalysisId);

    const [analysis] = await connection.db
      .select()
      .from(jobAnalyses)
      .where(eq(jobAnalyses.id, jobAnalysisId));

    expect(analysis?.requirementExtractionStatus).toBe("FAILED");

    await expect(
      repository.markRequirementExtractionFailed(jobAnalysisId)
    ).rejects.toThrow(
      "JobAnalysis no encontrado o no está en estado PENDING"
    );
  });

  it("crea y reutiliza un JobAnalysis pendiente", async () => {
    const repository = new JobRepository(connection.db);
    await service.accept(input);

    const [run] = await connection.db.select().from(processingRuns);
    expect(run).toBeDefined();

    const jobOfferId = randomUUID();

    await connection.db.insert(jobOffers).values({
      id: jobOfferId,
      source: "linkedin",
      sourceJobId: "pending-analysis",
      normalizedUrl: "https://example.com/jobs/pending-analysis",
      title: "Desarrollador Web",
      company: "Example",
      jobFamily: "WEB",
      role: "WEB_DEVELOPER",
      country: "España",
      city: "Castellón de la Plana",
      modality: "REMOTE",
      distanceKm: null,
      contract: "PERMANENT",
      employmentType: "EMPLOYEE",
      workingHours: "FULL_TIME"
    });

    const first = await repository.createPendingJobAnalysis({
      jobOfferId,
      processingRunId: run!.id
    });

    const second = await repository.createPendingJobAnalysis({
      jobOfferId,
      processingRunId: run!.id
    });

    expect(first.id).toBe(second.id);
    expect(first.requirementExtractionStatus).toBe("PENDING");
    expect(second.requirementExtractionStatus).toBe("PENDING");

    const analyses = await connection.db
      .select()
      .from(jobAnalyses);

    expect(analyses).toHaveLength(1);
  });

  it.each(["COMPLETED", "FAILED"] as const)(
    "recupera un JobAnalysis existente en estado %s",
    async (status) => {
      const repository = new JobRepository(connection.db);
      await service.accept(input);

      const [run] = await connection.db.select().from(processingRuns);
      expect(run).toBeDefined();

      const jobOfferId = randomUUID();
      const jobAnalysisId = randomUUID();

      await connection.db.insert(jobOffers).values({
        id: jobOfferId,
        source: "linkedin",
        sourceJobId: `analysis-${status.toLowerCase()}`,
        normalizedUrl: `https://example.com/jobs/analysis-${status.toLowerCase()}`,
        title: "Desarrollador Web",
        company: "Example",
        jobFamily: "WEB",
        role: "WEB_DEVELOPER",
        country: "España",
        city: "Castellón de la Plana",
        modality: "REMOTE",
        distanceKm: null,
        contract: "PERMANENT",
        employmentType: "EMPLOYEE",
        workingHours: "FULL_TIME"
      });

      await connection.db.insert(jobAnalyses).values({
        id: jobAnalysisId,
        jobOfferId,
        processingRunId: run!.id,
        version: 1,
        matchingSummary: null,
        requirementExtractionStatus: status,
        createdAt: new Date()
      });

      const result = await repository.createPendingJobAnalysis({
        jobOfferId,
        processingRunId: run!.id
      });

      expect(result).toEqual({
        id: jobAnalysisId,
        requirementExtractionStatus: status,
        createdAt: expect.any(Date)
      });

      const analyses = await connection.db
        .select()
        .from(jobAnalyses);

      expect(analyses).toHaveLength(1);
    }
  );
});