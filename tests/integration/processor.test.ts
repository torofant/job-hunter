import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql, and } from "drizzle-orm";

import { JobRepository } from "../../src/modules/jobs/job.repository.js";
import { JobService } from "../../src/modules/jobs/job.service.js";
import { Processor } from "../../src/modules/processing/processor.js";
import { ProcessingRepository } from "../../src/modules/processing/processing.repository.js";
import type { JobEnrichmentService } from "../../src/modules/jobs/job-enrichment.service.js";
import { clearDatabase, createTestDatabase } from "../helpers/database.js";
import type { UserProfileRepository } from "../../src/modules/jobs/user-profile.repository.js";
import type { JobRequirementExtractionService } from "../../src/modules/jobs/requirement-extraction.service.js";
import type { UserProfile } from "../../src/modules/jobs/user-profile.js";
import {
  aiUsage,
  jobAnalyses,
  jobDetections,
  jobOffers,
  processingRuns,
  requirementMatches
} from "../../src/database/schema/index.js";

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

  const jobEnrichmentService = {
    enrich: vi.fn().mockResolvedValue({
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
  } as unknown as JobEnrichmentService;


  const testUserProfile: UserProfile = {
    id: "00000000-0000-4000-8000-000000000001",
    targetRoles: [],
    technologies: [],
    experiences: [],
    languages: [],
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
  };

  const userProfileRepository = {
    getProfile: vi.fn().mockResolvedValue(testUserProfile)
  } as unknown as UserProfileRepository;

  const requirementExtractionService = {
    extract: vi.fn().mockResolvedValue({
      result: { requirements: [] },
      inputTokens: 100,
      outputTokens: 20,
      model: "claude-haiku-4-5",
      promptVersion: "1.0.0"
    })
  } as unknown as JobRequirementExtractionService;

  const processor = new Processor(
    runs,
    jobs,
    jobEnrichmentService,
    50,
    userProfileRepository,
    requirementExtractionService
  );

  beforeEach(async () => {
    await clearDatabase(connection);
    vi.clearAllMocks();

    vi.mocked(jobEnrichmentService.enrich).mockResolvedValue({
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
    });
  });

  afterAll(async () => {
    await connection.close();
  });

  it("completa el procesamiento básico", async () => {
    await service.accept(input);

    await processor.processAvailable();

    const result = await connection.db.select().from(processingRuns);

    expect(result[0]).toEqual(
      expect.objectContaining({
        status: "COMPLETED",
        attempt: 1
      })
    );
  });

  it("recupera una ejecución PROCESSING abandonada", async () => {
    await service.accept(input);

    const [run] = await connection.db.select().from(processingRuns);

    await connection.db
      .update(processingRuns)
      .set({
        status: "PROCESSING",
        startedAt: new Date(Date.now() - 1_000)
      })
      .where(eq(processingRuns.id, run.id));

    await processor.processAvailable();

    const [recovered] = await connection.db.select().from(processingRuns);

    expect(recovered).toEqual(
      expect.objectContaining({
        status: "COMPLETED",
        attempt: 1
      })
    );
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
      await transaction.execute(
        sql`SET LOCAL statement_timeout = '200ms'`
      );

      await transaction.execute(
        sql`SELECT id FROM processing_runs WHERE id = ${run.id} FOR UPDATE`
      );

      const claimedWhileLocked = await runs.claimNextRun();

      expect(claimedWhileLocked).toBeUndefined();
    });

    const claimedAfterRelease = await runs.claimNextRun();

    expect(claimedAfterRelease).toEqual(
      expect.objectContaining({
        id: run.id,
        attempt: 1
      })
    );
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
        lastError:
          "No existe una detección para la ejecución de procesamiento"
      })
    );
  });

  it("ejecuta el enriquecimiento y persiste AIUsage", async () => {
    const { detectionId } = await service.accept(input);

    await processor.processAvailable();

    expect(jobEnrichmentService.enrich).toHaveBeenCalledTimes(1);

    const usage = await connection.db
      .select()
      .from(aiUsage)
      .where(
        and(
          eq(aiUsage.detectionId, detectionId),
          eq(aiUsage.purpose, "ENRICHMENT")
        )
      );

    expect(usage).toHaveLength(1);

    expect(usage[0]).toEqual(
      expect.objectContaining({
        detectionId,
        provider: "anthropic",
        model: "claude-haiku-4-5",
        inputTokens: 100,
        outputTokens: 50,
        estimatedCost: null
      })
    );

    const [run] = await connection.db.select().from(processingRuns);

    expect(run).toEqual(
      expect.objectContaining({
        status: "COMPLETED",
        attempt: 1
      })
    );
  });

  it("crea y asocia el JobOffer y persiste el resultado del filtro", async () => {
    const { detectionId } = await service.accept(input);

    await processor.processAvailable();

    const [jobOffer] = await connection.db
      .select()
      .from(jobOffers);

    expect(jobOffer).toEqual(
      expect.objectContaining({
        title: "Developer",
        company: "Example",
        source: "linkedin",
        normalizedUrl: "https://example.com/jobs/1",
        jobFamily: "WEB",
        role: "WEB_DEVELOPER",
        country: "Spain",
        city: "Castellón de la Plana",
        modality: "REMOTE",
        contract: "PERMANENT",
        employmentType: "EMPLOYEE",
        workingHours: "FULL_TIME"
      })
    );

    const [detection] = await connection.db
      .select()
      .from(jobDetections)
      .where(eq(jobDetections.id, detectionId));

    expect(detection).toEqual(
      expect.objectContaining({
        jobOfferId: jobOffer.id,
        filterStatus: "ACCEPTED",
        filterReasons: []
      })
    );

    const [run] = await connection.db
      .select()
      .from(processingRuns);

    expect(run).toEqual(
      expect.objectContaining({
        status: "COMPLETED",
        attempt: 1
      })
    );
  });

  it("persiste una oferta REJECTED con todas las razones aplicables", async () => {
    const { detectionId } = await service.accept(input);

    vi.mocked(jobEnrichmentService.enrich).mockResolvedValueOnce({
      enrichment: {
        jobFamily: "OTHER",
        role: "HARDWARE_TECHNICIAN",
        country: "Spain",
        city: "Madrid",
        modality: "ONSITE",
        contract: "TEMPORARY",
        employmentType: "INTERNSHIP",
        workingHours: "FULL_TIME"
      },
      inputTokens: 100,
      outputTokens: 50,
      model: "claude-haiku-4-5"
    });

    await processor.processAvailable();

    const [detection] = await connection.db
      .select()
      .from(jobDetections)
      .where(eq(jobDetections.id, detectionId));

    expect(detection).toEqual(
      expect.objectContaining({
        filterStatus: "REJECTED",
        filterReasons: [
          "INTERNSHIP",
          "TEMPORARY_CONTRACT",
          "IRRELEVANT_JOB_FAMILY",
          "HARDWARE_SUPPORT",
          "ONSITE_TOO_FAR"
        ]
      })
    );

    const [run] = await connection.db
      .select()
      .from(processingRuns);

    expect(run).toEqual(
      expect.objectContaining({
        status: "COMPLETED",
        attempt: 1
      })
    );
  });

  it("continúa el procesamiento cuando falla el enriquecimiento con Claude", async () => {
    const { detectionId } = await service.accept(input);

    vi.mocked(jobEnrichmentService.enrich).mockRejectedValueOnce(
      new Error("Error de Claude")
    );

    await processor.processAvailable();

    expect(jobEnrichmentService.enrich).toHaveBeenCalledTimes(1);

    const usage = await connection.db
      .select()
      .from(aiUsage)
      .where(
        and(
          eq(aiUsage.detectionId, detectionId),
          eq(aiUsage.purpose, "ENRICHMENT")
        )
      );

    expect(usage).toHaveLength(0);

    const [jobOffer] = await connection.db
      .select()
      .from(jobOffers);

    expect(jobOffer).toEqual(
      expect.objectContaining({
        title: "Developer",
        company: "Example",
        source: "linkedin",
        normalizedUrl: "https://example.com/jobs/1",
        jobFamily: "UNKNOWN",
        role: "UNKNOWN",
        country: null,
        city: null,
        modality: "UNKNOWN",
        contract: "UNKNOWN",
        employmentType: "UNKNOWN",
        workingHours: "UNKNOWN"
      })
    );

    const [detection] = await connection.db
      .select()
      .from(jobDetections)
      .where(eq(jobDetections.id, detectionId));

    expect(detection).toEqual(
      expect.objectContaining({
        jobOfferId: jobOffer.id,
        filterStatus: "ACCEPTED",
        filterReasons: []
      })
    );

    const [run] = await connection.db
      .select()
      .from(processingRuns);

    expect(run).toEqual(
      expect.objectContaining({
        status: "COMPLETED",
        attempt: 1
      })
    );
  });

  it("marca el análisis como FAILED cuando falla la extracción de requisitos", async () => {
    const { detectionId } = await service.accept(input);

    vi.mocked(requirementExtractionService.extract).mockRejectedValueOnce(
      new Error("Error al extraer requisitos")
    );

    await processor.processAvailable();

    const analyses = await connection.db
      .select()
      .from(jobAnalyses);

    expect(analyses).toHaveLength(1);
    expect(analyses[0]?.requirementExtractionStatus).toBe("FAILED");
    expect(analyses[0]?.matchingSummary).toBeNull();

    const matches = await connection.db
      .select()
      .from(requirementMatches);

    expect(matches).toHaveLength(0);

    const extractionUsage = await connection.db
      .select()
      .from(aiUsage)
      .where(
        and(
          eq(aiUsage.detectionId, detectionId),
          eq(aiUsage.purpose, "REQUIREMENT_EXTRACTION")
        )
      );

    expect(extractionUsage).toHaveLength(0);

    const [run] = await connection.db
      .select()
      .from(processingRuns);

    expect(run).toEqual(
      expect.objectContaining({
        status: "COMPLETED",
        attempt: 1
      })
    );
  });

  it("extrae requisitos, ejecuta matching y completa el análisis", async () => {
    const { detectionId } = await service.accept(input);

    vi.mocked(requirementExtractionService.extract).mockResolvedValueOnce({
      result: {
        requirements: [
          {
            category: "technology",
            type: "single",
            importance: "required",
            data: { technology: "JavaScript" }
          }
        ]
      },
      inputTokens: 120,
      outputTokens: 30,
      model: "claude-haiku-4-5",
      promptVersion: "1.0.0"
    });

    vi.mocked(userProfileRepository.getProfile).mockResolvedValueOnce({
      ...testUserProfile,
      technologies: [{ name: "Java", level: null, context: null }]
    });

    await processor.processAvailable();

    const usage = await connection.db
      .select()
      .from(aiUsage)
      .where(
        and(
          eq(aiUsage.detectionId, detectionId),
          eq(aiUsage.purpose, "REQUIREMENT_EXTRACTION")
        )
      );

    expect(usage).toHaveLength(1);
    expect(usage[0]).toEqual(
      expect.objectContaining({
        detectionId,
        provider: "anthropic",
        model: "claude-haiku-4-5",
        purpose: "REQUIREMENT_EXTRACTION",
        promptVersion: "1.0.0",
        inputTokens: 120,
        outputTokens: 30
      })
    );

    const analyses = await connection.db
      .select()
      .from(jobAnalyses);

    expect(analyses).toHaveLength(1);
    expect(analyses[0]?.requirementExtractionStatus).toBe("COMPLETED");

    const matches = await connection.db
      .select()
      .from(requirementMatches);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.result).toBe("MISSING");

    const [run] = await connection.db.select().from(processingRuns);
    expect(run?.status).toBe("COMPLETED");
  });

  it("no repite la extracción cuando recupera una ejecución con el análisis COMPLETED", async () => {
    const { detectionId } = await service.accept(input);

    await processor.processAvailable();

    const [completedRun] = await connection.db
      .select()
      .from(processingRuns);

    const [completedAnalysis] = await connection.db
      .select()
      .from(jobAnalyses);

    expect(completedRun?.status).toBe("COMPLETED");
    expect(completedAnalysis?.requirementExtractionStatus).toBe("COMPLETED");

    const extractionCallsBeforeRecovery =
      vi.mocked(requirementExtractionService.extract).mock.calls.length;

    await connection.db
      .update(processingRuns)
      .set({
        status: "PROCESSING",
        startedAt: new Date(Date.now() - 60_000)
      })
      .where(eq(processingRuns.id, completedRun!.id));

    await processor.processAvailable();

    const [recoveredRun] = await connection.db
      .select()
      .from(processingRuns);

    const analyses = await connection.db
      .select()
      .from(jobAnalyses);

    const extractionUsage = await connection.db
      .select()
      .from(aiUsage)
      .where(
        and(
          eq(aiUsage.detectionId, detectionId),
          eq(aiUsage.purpose, "REQUIREMENT_EXTRACTION")
        )
      );

    expect(recoveredRun?.status).toBe("COMPLETED");
    expect(analyses).toHaveLength(1);
    expect(
      vi.mocked(requirementExtractionService.extract).mock.calls
    ).toHaveLength(extractionCallsBeforeRecovery);
    expect(extractionUsage).toHaveLength(1);
  });

  it("reintenta el procesamiento cuando falla la persistencia del análisis", async () => {
    await service.accept(input);

    const persistSpy = vi
      .spyOn(jobs, "persistCompletedJobAnalysis")
      .mockRejectedValueOnce(new Error("Error de persistencia"));

    await processor.processAvailable();

    const [run] = await connection.db
      .select()
      .from(processingRuns);

    const [analysis] = await connection.db
      .select()
      .from(jobAnalyses);

    expect(persistSpy).toHaveBeenCalledTimes(2);

    expect(run).toEqual(
      expect.objectContaining({
        status: "COMPLETED",
        attempt: 2,
        lastError: null
      })
    );

    expect(analysis?.requirementExtractionStatus).toBe("COMPLETED");
    expect(analysis?.matchingSummary).not.toBeNull();

    persistSpy.mockRestore();
  });

  it("incluye el salario de raw_metadata en el scoring del análisis", async () => {
    await service.accept({
      ...input,
      raw_metadata: {
        salary: 25000,
        salary_currency: "EUR",
        salary_period: "annual"
      }
    });

    const results = await processor.processAvailable();

    const [persistedAnalysis] = await connection.db
      .select()
      .from(jobAnalyses);

    expect(persistedAnalysis).toEqual(
      expect.objectContaining({
        requirementExtractionStatus: "COMPLETED",
        score: expect.any(Number),
        coverage: expect.any(Number),
        coverageBreakdown: expect.any(Object),
        confidenceLevel: "MEDIUM"
      })
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.scoringResult.breakdown.employmentConditions).toBe(10);
  });
});