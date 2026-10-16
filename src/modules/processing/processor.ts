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

const PROCESSOR_INTERVAL_MS = 1_000;

export class Processor {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

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
    this.runSafely();

    this.timer = setInterval(() => {
      this.runSafely();
    }, PROCESSOR_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async processAvailable(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      await this.processingRepository.recoverAbandonedRuns(
        this.recoveryTimeoutMs
      );

      let run = await this.processingRepository.claimNextRun();

      while (run) {
        await this.processRun(run);
        run = await this.processingRepository.claimNextRun();
      }
    } finally {
      this.running = false;
    }
  }

  private async processRun(run: ClaimedProcessingRun): Promise<void> {
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
        return;
      }

      const analysis = await this.jobRepository.createPendingJobAnalysis({
        jobOfferId: jobOffer.id,
        processingRunId: run.id
      });

      // No repetimos la extracción de un análisis que ya terminó.
      if (analysis.requirementExtractionStatus !== "PENDING") {
        await this.processingRepository.completeRun(run.id);
        return;
      }

      // Comprobamos el perfil antes de consumir otra llamada a Claude.
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
      } catch (error) {
        // Un fallo de Claude no se convierte en requisitos inventados
        // ni en un fallo de matching.
        await this.jobRepository.markRequirementExtractionFailed(
          analysis.id
        );

        await this.processingRepository.completeRun(run.id);
        return;
      }

      // El registro de consumo queda fuera del catch de extracción:
      // si falla la persistencia de AIUsage, el procesamiento se reintenta.
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

      await this.jobRepository.persistCompletedJobAnalysis({
        jobAnalysisId: analysis.id,
        requirements,
        matches,
        matchingSummary
      });

      await this.processingRepository.completeRun(run.id);
    } catch (error) {
      console.error("Error completo al procesar la oferta:", error);

      if (error instanceof Error && error.cause) {
        console.error("Causa original:", error.cause);
      }

      const message = error instanceof Error
        ? error.message
        : "Error de procesamiento desconocido";

      await this.processingRepository.retryOrFailRun(
        run.id,
        run.attempt,
        message
      );
    }
  }

  private runSafely(): void {
    void this.processAvailable().catch((error: unknown) => {
      this.reportError(error);
    });
  }
}