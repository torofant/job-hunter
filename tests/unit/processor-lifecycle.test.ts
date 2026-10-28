
import { afterEach, describe, expect, it, vi } from "vitest";

import { Processor } from "../../src/modules/processing/processor.js";
import type { ProcessingRepository } from "../../src/modules/processing/processing.repository.js";
import type { JobRepository } from "../../src/modules/jobs/job.repository.js";
import type { JobEnrichmentService } from "../../src/modules/jobs/job-enrichment.service.js";
import type { UserProfileRepository } from "../../src/modules/jobs/user-profile.repository.js";
import type { JobRequirementExtractionService } from "../../src/modules/jobs/requirement-extraction.service.js";

function createProcessor(
  recoverAbandonedRuns = vi.fn().mockResolvedValue(undefined)
) {
  const processingRepository = {
    recoverAbandonedRuns,
    claimNextRun: vi.fn().mockResolvedValue(undefined)
  } as unknown as ProcessingRepository;

  const processor = new Processor(
    processingRepository,
    {} as JobRepository,
    {} as JobEnrichmentService,
    1_000,
    {} as UserProfileRepository,
    {} as JobRequirementExtractionService
  );

  return { processor, recoverAbandonedRuns };
}

describe("Processor: ciclo de vida", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("no crea varios intervalos cuando start se llama repetidamente", async () => {
    vi.useFakeTimers();

    const { processor } = createProcessor();

    processor.start();
    processor.start();

    expect(vi.getTimerCount()).toBe(1);

    await processor.stop();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("espera a que termine el procesamiento activo al ejecutar stop", async () => {
    let releaseRecovery!: () => void;

    const recoveryGate = new Promise<void>((resolve) => {
      releaseRecovery = resolve;
    });

    const recoverAbandonedRuns = vi.fn(
      () => recoveryGate
    );

    const { processor } = createProcessor(recoverAbandonedRuns);

    processor.start();

    expect(recoverAbandonedRuns).toHaveBeenCalledOnce();

    let stopResolved = false;

    const stopping = processor.stop().then(() => {
      stopResolved = true;
    });

    await Promise.resolve();

    expect(stopResolved).toBe(false);

    releaseRecovery();

    await stopping;

    expect(stopResolved).toBe(true);
  });
});
