import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType } from "zod";

import {
  requirementExtractionResultSchema,
  type RequirementExtractionResult
} from "./requirement-extraction.js";
import {
  REQUIREMENT_EXTRACTION_PROMPT_VERSION,
  REQUIREMENT_EXTRACTION_SYSTEM_PROMPT
} from "./prompts/requirement-extraction.prompt.js";
import type { RequirementExtractionInput } from "./requirement-extraction-input.js";

const CLAUDE_MODEL = "claude-haiku-4-5";

export type RequirementExtractionResultWithUsage = {
  result: RequirementExtractionResult;
  inputTokens: number;
  outputTokens: number;
  model: string;
  promptVersion: string;
};

export class JobRequirementExtractionService {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async extract(
    input: RequirementExtractionInput
  ): Promise<RequirementExtractionResultWithUsage> {
    const response = await this.client.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: REQUIREMENT_EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: JSON.stringify(input)
        }
      ],
      output_config: {
        format: zodOutputFormat(requirementExtractionResultSchema)
      }
    });

    const result = response.parsed_output;

    if (!result) {
      throw new Error(
        "Claude no devolvió un resultado válido de extracción de requisitos"
      );
    }

    return {
      result,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: response.model,
      promptVersion: REQUIREMENT_EXTRACTION_PROMPT_VERSION
    };
  }
}