import type { JobRepository } from "../jobs/job.repository.js";
import type { JobEnrichmentService } from "../jobs/job-enrichment.service.js";
import { normalizeJobOfferWithAI } from "../jobs/job.normalizer.js";
import {
  ProcessingRepository,
  type ClaimedProcessingRun
} from "./processing.repository.js";
import { filterJobOffer } from "../jobs/job.filter.js";

const PROCESSOR_INTERVAL_MS = 1_000;

export class Processor {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly processingRepository: ProcessingRepository,
    private readonly jobRepository: JobRepository,
    private readonly jobEnrichmentService: JobEnrichmentService,
    private readonly recoveryTimeoutMs: number,
    private readonly reportError: (error: unknown) => void = () => undefined
  ) {}

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

    await this.processingRepository.completeRun(run.id);
  } catch (error) {
    const message =
      error instanceof Error
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