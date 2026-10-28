import type { JobRepository } from "../jobs/job.repository.js";
import type { JobEnrichmentService } from "../jobs/job-enrichment.service.js";
import { normalizeJobOfferWithAI } from "../jobs/job.normalizer.js";
import {
  ProcessingRepository,
  type ClaimedProcessingRun
} from "./processing.repository.js";
import { filterJobOffer } from "../jobs/job.filter.js";
import { JOB_ENRICHMENT_PROMPT_VERSION } from "../jobs/job-enrichment.service.js";
import type { UserProfileRepository } from "../jobs/user-profile.repository.js";
import type { JobRequirementExtractionService } from "../jobs/requirement-extraction.service.js";
import { buildRequirementExtractionInput } from "../jobs/requirement-extraction-input.js";
import { normalizeAndDeduplicateRequirements } from "../jobs/requirement.normalizer.js";
import { matchRequirement } from "../jobs/requirement.matcher.js";
import { buildMatchingSummary } from "../jobs/matching-summary.js";
import { calculateGlobalCoverageScore } from "../jobs/coverage.js";
import { evaluateCoverage } from "../jobs/coverage-evaluator.js";
import { calculateConfidence } from "../jobs/confidence.js";
import type { JobAnalysisResult } from "../jobs/job-analysis-result.js";
import { buildScoringInputs } from "../jobs/scoring-inputs.js";
import { calculateScoringResult } from "../jobs/scoring.js";
import {
  buildNotificationMessage,
  formatSalaryMetadata
} from "../notifications/notification-message.js";

const PROCESSOR_INTERVAL_MS = 1_000;

export class Processor {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private activeRun: Promise<void> | undefined;
  private started = false;

  constructor(
    private readonly processingRepository: ProcessingRepository,
    private readonly jobRepository: JobRepository,
    private readonly jobEnrichmentService: JobEnrichmentService,
    private readonly recoveryTimeoutMs: number,
    private readonly userProfileRepository: UserProfileRepository,
    private readonly requirementExtractionService: JobRequirementExtractionService,
    private readonly reportError: (error: unknown) => void = () => undefined
  ) { }

  start(): void {
    if (this.started) return;

    this.started = true;
    this.runSafely();

    this.timer = setInterval(() => {
      this.runSafely();
    }, PROCESSOR_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    this.started = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    await this.activeRun;
  }

  private runSafely(): void {
    if (this.activeRun) return;

    const run = this.processAvailable()
      .then(
        () => undefined,
        (error: unknown) => {
          this.reportError(error);
        }
      )
      .finally(() => {
        if (this.activeRun === run) {
          this.activeRun = undefined;
        }
      });

    this.activeRun = run;
  }

  async processAvailable(): Promise<JobAnalysisResult[]> {
    if (this.running) return [];

    this.running = true;
    const results: JobAnalysisResult[] = [];

    try {
      await this.processingRepository.recoverAbandonedRuns(
        this.recoveryTimeoutMs
      );

      let run = await this.processingRepository.claimNextRun();

      while (run) {
        const result = await this.processRun(run);

        if (result) {
          results.push(result);
        }

        run = await this.processingRepository.claimNextRun();
      }

      return results;
    } finally {
      this.running = false;
    }
  }

  private async processRun(
    run: ClaimedProcessingRun
  ): Promise<JobAnalysisResult | null> {
    try {
      const detection = await this.jobRepository.getDetectionForRun(run.id);

      if (!detection) {
        throw new Error(
          "No existe una detección para la ejecución de procesamiento"
        );
      }

      const normalized = await normalizeJobOfferWithAI(
        detection.rawInput,
        this.jobEnrichmentService
      );

      if (normalized.aiUsage) {
        await this.jobRepository.createAIUsage({
          detectionId: detection.detectionId,
          provider: normalized.aiUsage.provider,
          model: normalized.aiUsage.model,
          purpose: "ENRICHMENT",
          promptVersion: JOB_ENRICHMENT_PROMPT_VERSION,
          inputTokens: normalized.aiUsage.inputTokens,
          outputTokens: normalized.aiUsage.outputTokens,
          estimatedCost: null
        });
      }

      const jobOffer = await this.jobRepository.findOrCreateJobOffer(
        normalized.candidate
      );

      await this.jobRepository.updateDetectionJobOffer(
        detection.detectionId,
        jobOffer.id
      );

      const filterResult = filterJobOffer(jobOffer);

      await this.jobRepository.updateFilterResult(
        detection.detectionId,
        filterResult
      );

      if (filterResult.status !== "ACCEPTED") {
        await this.processingRepository.completeRun(run.id);
        return null;
      }

      const analysis = await this.jobRepository.createPendingJobAnalysis({
        jobOfferId: jobOffer.id,
        processingRunId: run.id
      });

      // No repetimos la extracción si el análisis ya no está pendiente.
      if (analysis.requirementExtractionStatus !== "PENDING") {
        await this.processingRepository.completeRun(run.id);
        return null;
      }

      const userProfile = await this.userProfileRepository.getProfile();

      const extractionInput = buildRequirementExtractionInput(
        detection.rawInput
      );

      let extraction: Awaited<
        ReturnType<JobRequirementExtractionService["extract"]>
      >;

      try {
        extraction = await this.requirementExtractionService.extract(
          extractionInput
        );
      } catch {
        await this.jobRepository.markRequirementExtractionFailed(analysis.id);
        await this.processingRepository.completeRun(run.id);
        return null;
      }

      // Si falla el registro del consumo, el procesamiento se reintenta.
      await this.jobRepository.createAIUsage({
        detectionId: detection.detectionId,
        provider: "anthropic",
        model: extraction.model,
        purpose: "REQUIREMENT_EXTRACTION",
        promptVersion: extraction.promptVersion,
        inputTokens: extraction.inputTokens,
        outputTokens: extraction.outputTokens,
        estimatedCost: null
      });

      const requirements = normalizeAndDeduplicateRequirements(
        extraction.result.requirements
      );

      const referenceDate = analysis.createdAt.toISOString().slice(0, 10);

      const matches = requirements.map((requirement) =>
        matchRequirement(requirement, userProfile, referenceDate)
      );

      const matchingSummary = buildMatchingSummary(
        requirements.map((requirement, index) => ({
          requirement,
          match: matches[index]!
        }))
      );

      const scoringInputs = buildScoringInputs({
        jobOffer,
        userProfile,
        requirements,
        matches,
        salaryMetadata: detection.rawInput.raw_metadata
      });

      const scoringResult = calculateScoringResult(scoringInputs);

      const coverageBreakdown = evaluateCoverage({
        jobFamily: jobOffer.jobFamily,
        role: jobOffer.role,
        country: jobOffer.country,
        city: jobOffer.city,
        modality: jobOffer.modality,
        contract: jobOffer.contract,
        employmentType: jobOffer.employmentType,
        workingHours: jobOffer.workingHours,
        extractionStatus: "COMPLETED",
        requirements
      });

      const globalCoverageScore =
        calculateGlobalCoverageScore(coverageBreakdown);

      const confidence = calculateConfidence({
        extractionStatus: "COMPLETED",
        hasDeterministicUnreliabilitySignal: false
      });

      // La extracción está completada, por lo que confidence no es null.
      if (confidence === null) {
        throw new Error(
          "La confianza no puede ser null para una extracción completada"
        );
      }

      const notificationResult = buildNotificationMessage({
        title: jobOffer.title,
        company: jobOffer.company,
        city: jobOffer.city,
        country: jobOffer.country,
        modality: jobOffer.modality,
        salary: formatSalaryMetadata(detection.rawInput.raw_metadata),
        score: scoringResult.score,
        category: scoringResult.category,
        coverage: globalCoverageScore,
        url: detection.rawInput.url
      });

      if (!notificationResult.ok) {
        console.warn(
          "Notificación omitida:",
          notificationResult.reason,
          jobOffer.id
        );
      }

      await this.jobRepository.persistCompletedJobAnalysis({
        jobAnalysisId: analysis.id,
        requirements,
        matches,
        matchingSummary,
        score: scoringResult.score,
        coverage: globalCoverageScore,
        coverageBreakdown,
        confidence,
        notification: notificationResult.ok
          ? {
            message: notificationResult.message,
            detectedAt: detection.rawInput.detected_at
          }
          : null
      });

      await this.processingRepository.completeRun(run.id);

      return {
        jobOfferId: jobOffer.id,
        jobAnalysisId: analysis.id,
        requirements,
        matches,
        matchingSummary,
        coverageBreakdown,
        globalCoverageScore,
        confidence,
        scoringResult
      };
    } catch (error) {
      console.error("Error completo al procesar la oferta:", error);

      if (error instanceof Error && error.cause) {
        console.error("Causa original:", error.cause);
      }

      const message =
        error instanceof Error
          ? error.message
          : "Error de procesamiento desconocido";

      await this.processingRepository.retryOrFailRun(
        run.id,
        run.attempt,
        message
      );

      return null;
    }
  }
}
