import { and, eq } from "drizzle-orm";

import type { RawJobInput } from "../../api/schemas/raw-job-input.schema.js";
import type { Database } from "../../database/client.js";
import {
  aiUsage,
  jobAnalyses,
  jobDetections,
  jobOffers,
  processingRuns,
  rawJobInputs
} from "../../database/schema/index.js";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { JobFilterResult } from "./job.filter.js";
import type { Requirement } from "./requirement.js";
import { requirementEntitySchema } from "./requirement.js";
import type { RequirementMatch } from "./requirement-match.js";
import { buildMatchingSummary } from "./matching-summary.js";
import { haveSameRequirementSet } from "./requirement.normalizer.js";
import { requirements } from "../../database/schema/index.js";
import { requirementMatches } from "../../database/schema/index.js";
import type { ConfidenceLevel } from "./confidence.js";
import type { CoverageBreakdown } from "./coverage.js";
import type { ScoringResult } from "./scoring.js";

type JobOfferInsert = InferInsertModel<typeof jobOffers>;
type JobOffer = InferSelectModel<typeof jobOffers>;

export class JobRepository {
  constructor(private readonly db: Database) { }

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

  async findOrCreateJobOffer(
    candidate: JobOfferInsert
  ): Promise<JobOffer> {
    if (candidate.sourceJobId) {
      const existingBySourceJobId = await this.db
        .select()
        .from(jobOffers)
        .where(
          and(
            eq(jobOffers.source, candidate.source),
            eq(jobOffers.sourceJobId, candidate.sourceJobId)
          )
        )
        .limit(1);

      if (existingBySourceJobId.length === 1) {
        return this.updateJobOffer(existingBySourceJobId[0], candidate);
      }
    }

    if (candidate.normalizedUrl) {
      const existingByUrl = await this.db
        .select()
        .from(jobOffers)
        .where(eq(jobOffers.normalizedUrl, candidate.normalizedUrl))
        .limit(1);

      if (existingByUrl.length === 1) {
        return this.updateJobOffer(existingByUrl[0], candidate);
      }
    }

    const inserted = await this.db
      .insert(jobOffers)
      .values(candidate)
      .returning();

    return inserted[0];
  }

  async createAIUsage(input: {
    detectionId: string;
    provider: string;
    model: string;
    purpose: "ENRICHMENT" | "REQUIREMENT_EXTRACTION";
    promptVersion: string | null;
    inputTokens: number;
    outputTokens: number;
    estimatedCost?: string | null;
  }) {
    const inserted = await this.db
      .insert(aiUsage)
      .values({
        id: randomUUID(),
        detectionId: input.detectionId,
        provider: input.provider,
        model: input.model,
        purpose: input.purpose,
        promptVersion: input.promptVersion,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        estimatedCost: input.estimatedCost ?? null,
        createdAt: new Date()
      })
      .returning();

    return inserted[0];
  }

  async createPendingJobAnalysis(input: {
    jobOfferId: string;
    processingRunId: string;
  }): Promise<{
    id: string;
    requirementExtractionStatus: "PENDING" | "COMPLETED" | "FAILED";
    createdAt: Date;
  }> {
    const [existingAnalysis] = await this.db
      .select({
        id: jobAnalyses.id,
        jobOfferId: jobAnalyses.jobOfferId,
        requirementExtractionStatus: jobAnalyses.requirementExtractionStatus,
        createdAt: jobAnalyses.createdAt
      })
      .from(jobAnalyses)
      .where(eq(jobAnalyses.processingRunId, input.processingRunId))
      .limit(1);

    if (existingAnalysis) {
      if (existingAnalysis.jobOfferId !== input.jobOfferId) {
        throw new Error(
          `El JobAnalysis existente para ProcessingRun ${input.processingRunId} pertenece a otro JobOffer`
        );
      }

      return {
        id: existingAnalysis.id,
        requirementExtractionStatus:
          existingAnalysis.requirementExtractionStatus,
        createdAt: existingAnalysis.createdAt
      };
    }

    const id = randomUUID();
    const createdAt = new Date();

    await this.db.insert(jobAnalyses).values({
      id,
      jobOfferId: input.jobOfferId,
      processingRunId: input.processingRunId,
      version: 1,
      matchingSummary: null,
      requirementExtractionStatus: "PENDING",
      createdAt: createdAt
    });

    return {
      id,
      requirementExtractionStatus: "PENDING",
      createdAt
    };
  }

  async persistCompletedJobAnalysis(input: {
    jobAnalysisId: string;
    requirements: Requirement[];
    matches: RequirementMatch[];
    matchingSummary: ReturnType<typeof buildMatchingSummary>;
    score: number | null;
    coverage: number | null;
    coverageBreakdown: CoverageBreakdown;
    confidence: ConfidenceLevel;
  }): Promise<void> {
    const categoryToDb = {
      technology: "TECHNOLOGY",
      experience: "EXPERIENCE",
      language: "LANGUAGE",
      other: "OTHER"
    } as const;

    const typeToDb = {
      single: "SINGLE",
      alternative: "ALTERNATIVE",
      group: "GROUP"
    } as const;

    const importanceToDb = {
      required: "REQUIRED",
      preferred: "PREFERRED"
    } as const;

    const resultToDb = {
      MATCH: "MATCH",
      PARTIAL: "PARTIAL",
      MISSING: "MISSING",
      UNKNOWN: "UNKNOWN",
      "N/A": "N_A"
    } as const;

    const identity = (requirement: Requirement): string =>
      JSON.stringify({
        category: requirement.category,
        type: requirement.type,
        importance: requirement.importance,
        data: requirement.data
      });

    // Cada requisito debe tener exactamente una coincidencia.
    const matchesByRequirementId = new Map(
      input.matches.map((match) => [match.requirementId, match])
    );

    if (
      matchesByRequirementId.size !== input.matches.length ||
      input.matches.length !== input.requirements.length ||
      input.requirements.some(
        (requirement) => !matchesByRequirementId.has(requirement.id)
      ) ||
      input.matches.some(
        (match) => !input.requirements.some(
          (requirement) => requirement.id === match.requirementId
        )
      )
    ) {
      throw new Error(
        "Los requisitos y sus coincidencias no corresponden entre sí"
      );
    }

    await this.db.transaction(async (transaction) => {
      const [analysis] = await transaction
        .select()
        .from(jobAnalyses)
        .where(eq(jobAnalyses.id, input.jobAnalysisId))
        .limit(1);

      if (!analysis) {
        throw new Error("JobAnalysis no encontrado");
      }

      if (analysis.requirementExtractionStatus !== "PENDING") {
        throw new Error("JobAnalysis no está en estado PENDING");
      }

      const activeRows = await transaction
        .select()
        .from(requirements)
        .where(
          and(
            eq(requirements.jobOfferId, analysis.jobOfferId),
            eq(requirements.active, true)
          )
        );

      const existingRequirements = activeRows.map((row) =>
        requirementEntitySchema.parse({
          id: row.id,
          category: row.category.toLowerCase(),
          type: row.type.toLowerCase(),
          importance: row.importance.toLowerCase(),
          data: row.data
        })
      );

      const persistedIdByIdentity = new Map<string, string>();

      if (
        haveSameRequirementSet(
          existingRequirements,
          input.requirements
        )
      ) {
        // El conjunto no ha cambiado: conservamos los IDs persistidos.
        for (const requirement of existingRequirements) {
          persistedIdByIdentity.set(
            identity(requirement),
            requirement.id
          );
        }
      } else {
        // El conjunto ha cambiado: desactivamos los requisitos anteriores.
        await transaction
          .update(requirements)
          .set({ active: false })
          .where(
            and(
              eq(requirements.jobOfferId, analysis.jobOfferId),
              eq(requirements.active, true)
            )
          );

        // Insertamos el conjunto nuevo, si no está vacío.
        if (input.requirements.length > 0) {
          await transaction.insert(requirements).values(
            input.requirements.map((requirement) => ({
              id: requirement.id,
              jobOfferId: analysis.jobOfferId,
              category: categoryToDb[requirement.category],
              type: typeToDb[requirement.type],
              importance: importanceToDb[requirement.importance],
              data: requirement.data,
              active: true
            }))
          );
        }

        for (const requirement of input.requirements) {
          persistedIdByIdentity.set(
            identity(requirement),
            requirement.id
          );
        }
      }

      // Guardamos las coincidencias con los IDs realmente persistidos.
      if (input.matches.length > 0) {
        await transaction.insert(requirementMatches).values(
          input.matches.map((match) => {
            const requirement = input.requirements.find(
              (item) => item.id === match.requirementId
            );

            if (!requirement) {
              throw new Error(
                `No se encuentra el requisito ${match.requirementId}`
              );
            }

            const persistedRequirementId = persistedIdByIdentity.get(
              identity(requirement)
            );

            if (!persistedRequirementId) {
              throw new Error(
                `No se ha podido resolver el ID persistido de ${match.requirementId}`
              );
            }

            return {
              id: randomUUID(),
              jobAnalysisId: input.jobAnalysisId,
              requirementId: persistedRequirementId,
              result: resultToDb[match.result],
              evidence: match.evidence
            };
          })
        );
      }

      await transaction
        .update(jobAnalyses)
        .set({
          matchingSummary: input.matchingSummary,
          score: input.score,
          coverage: input.coverage,
          coverageBreakdown: input.coverageBreakdown,
          confidenceLevel: input.confidence,
          requirementExtractionStatus: "COMPLETED"
        })
        .where(eq(jobAnalyses.id, input.jobAnalysisId));
    });
  }

  private async updateJobOffer(
    existing: JobOffer,
    candidate: JobOfferInsert
  ): Promise<JobOffer> {
    const updates = Object.fromEntries(
      Object.entries(candidate).filter(
        ([key, value]) =>
          key !== "id" && value !== null && value !== undefined
      )
    ) as Partial<JobOfferInsert>;

    if (Object.keys(updates).length === 0) {
      return existing;
    }

    const updated = await this.db
      .update(jobOffers)
      .set(updates)
      .where(eq(jobOffers.id, existing.id))
      .returning();

    return updated[0];
  }

  async hasDetectionForRun(processingRunId: string): Promise<boolean> {
    const detection = await this.db
      .select({ id: jobDetections.id })
      .from(jobDetections)
      .where(eq(jobDetections.processingRunId, processingRunId))
      .limit(1);

    return detection.length === 1;
  }

  async getDetectionForRun(processingRunId: string): Promise<{
    detectionId: string;
    rawInput: RawJobInput;
  } | undefined> {
    const result = await this.db
      .select({
        detectionId: jobDetections.id,
        rawInput: rawJobInputs
      })
      .from(jobDetections)
      .innerJoin(
        rawJobInputs,
        eq(jobDetections.rawInputId, rawJobInputs.id)
      )
      .where(eq(jobDetections.processingRunId, processingRunId))
      .limit(1);

    const row = result[0];

    if (!row) {
      return undefined;
    }

    return {
      detectionId: row.detectionId,
      rawInput: {
        source: row.rawInput.source,
        source_job_id: row.rawInput.sourceJobId ?? undefined,
        title: row.rawInput.title,
        company: row.rawInput.company,
        url: row.rawInput.url,
        description: row.rawInput.description ?? undefined,
        location: row.rawInput.location ?? undefined,
        detected_at: row.rawInput.detectedAt,
        raw_metadata: row.rawInput.rawMetadata as Record<string, unknown> | null
      }
    };
  }

  async updateFilterResult(
    detectionId: string,
    result: JobFilterResult
  ): Promise<void> {
    await this.db
      .update(jobDetections)
      .set({
        filterStatus: result.status,
        filterReasons: result.reasons
      })
      .where(eq(jobDetections.id, detectionId));
  }

  async updateDetectionJobOffer(
    detectionId: string,
    jobOfferId: string
  ): Promise<void> {
    await this.db
      .update(jobDetections)
      .set({
        jobOfferId
      })
      .where(eq(jobDetections.id, detectionId));
  }

  async markRequirementExtractionFailed(
    jobAnalysisId: string
  ): Promise<void> {
    const updated = await this.db
      .update(jobAnalyses)
      .set({
        requirementExtractionStatus: "FAILED"
      })
      .where(
        and(
          eq(jobAnalyses.id, jobAnalysisId),
          eq(jobAnalyses.requirementExtractionStatus, "PENDING")
        )
      )
      .returning({ id: jobAnalyses.id });

    if (updated.length === 0) {
      throw new Error(
        "JobAnalysis no encontrado o no está en estado PENDING"
      );
    }
  }
}
