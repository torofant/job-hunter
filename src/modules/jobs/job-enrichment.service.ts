import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import {
  jobEnrichmentSchema,
  type JobEnrichment
} from "./job-enrichment.js";
import {
  JOB_ENRICHMENT_PROMPT_VERSION,
  JOB_ENRICHMENT_SYSTEM_PROMPT
} from "./prompts/job-enrichment.prompt.js";
import type { JobEnrichmentInput } from "./job-enrichment-input.js";

const CLAUDE_MODEL = "claude-haiku-4-5";

export type JobEnrichmentResult = {
  enrichment: JobEnrichment;
  inputTokens: number;
  outputTokens: number;
  model: string;
};

export class JobEnrichmentService {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async enrich(input: JobEnrichmentInput): Promise<JobEnrichmentResult> {
    const response = await this.client.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      system: JOB_ENRICHMENT_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: JSON.stringify(input)
        }
      ],
      output_config: {
        format: zodOutputFormat(jobEnrichmentSchema)
      }
    });

    const enrichment = response.parsed_output;

    if (!enrichment) {
      throw new Error("Claude did not return a structured enrichment");
    }

    return {
      enrichment,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: response.model
    };
  }
}

export { JOB_ENRICHMENT_PROMPT_VERSION };