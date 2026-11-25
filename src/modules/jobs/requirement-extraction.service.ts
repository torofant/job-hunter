
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import {
  claudeRequirementExtractionResultSchema,
  requirementExtractionResultSchema,
  type ClaudeRequirementExtractionResult,
  type RequirementExtractionResult
} from "./requirement-extraction.js";
import {
  REQUIREMENT_EXTRACTION_PROMPT_VERSION,
  REQUIREMENT_EXTRACTION_SYSTEM_PROMPT
} from "./prompts/requirement-extraction.prompt.js";
import type { RequirementExtractionInput } from "./requirement-extraction-input.js";
import { normalizeLanguageLevel } from "./requirement.normalizer.js";

const CLAUDE_MODEL = "claude-haiku-4-5";

export type RequirementExtractionResultWithUsage = {
  result: RequirementExtractionResult;
  inputTokens: number;
  outputTokens: number;
  model: string;
  promptVersion: string;
};

type ClaudeRequirement = ClaudeRequirementExtractionResult["requirements"][number];

function convertClaudeRequirement(
  requirement: ClaudeRequirement
): Record<string, unknown> | null {
  const { category, type, importance, items } = requirement;

  if (type === "single" && items.length !== 1) {
    throw new Error(
      `Claude devolvió ${items.length} elementos para un requisito single`
    );
  }

  if (type !== "single" && items.length < 2) {
    throw new Error(
      `Claude devolvió menos de dos elementos para un requisito ${type}`
    );
  }

  let mappedItems: Record<string, unknown>[];

  switch (category) {
    case "technology":
      mappedItems = items.map((item) => {
        if (
          item.targetType !== null ||
          item.minimumYears !== null ||
          item.minimumLevel !== null
        ) {
          throw new Error(
            "Claude devolvió campos incompatibles con un requisito technology"
          );
        }

        return { technology: item.value };
      });
      break;

    case "experience":
      mappedItems = items.map((item) => {
        if (
          item.targetType === null ||
          item.minimumYears === null ||
          item.minimumLevel !== null
        ) {
          throw new Error(
            "Claude devolvió datos incompletos o incompatibles con un requisito experience"
          );
        }

        return {
          target: {
            type: item.targetType,
            value: item.value
          },
          minimumYears: item.minimumYears
        };
      });
      break;

    case "language": {
      const languageItems: Record<string, unknown>[] = [];

      for (const item of items) {
        if (
          item.targetType !== null ||
          item.minimumYears !== null ||
          item.minimumLevel === null
        ) {
          throw new Error(
            "Claude devolvió datos incompletos o incompatibles con un requisito language"
          );
        }

        const minimumLevel = normalizeLanguageLevel(item.minimumLevel);

        // Si no reconocemos la expresión, omitimos este requisito
        // para no inventar un nivel CEFR.
        if (minimumLevel === null) {
          return null;
        }

        languageItems.push({
          language: item.value,
          minimumLevel
        });
      }

      mappedItems = languageItems;
      break;
    }
  }

  let data: Record<string, unknown>;

  if (type === "single") {
    data = mappedItems[0];
  } else if (type === "alternative") {
    data = { options: mappedItems };
  } else {
    data = { components: mappedItems };
  }

  return {
    category,
    type,
    importance,
    data
  };
}

function convertClaudeResult(
  result: ClaudeRequirementExtractionResult
): RequirementExtractionResult {
  const requirements = result.requirements
    .map(convertClaudeRequirement)
    .filter(
      (requirement): requirement is Record<string, unknown> =>
        requirement !== null
    );

  return requirementExtractionResultSchema.parse({
    requirements
  });
}

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
      max_tokens: 2048,
      system: REQUIREMENT_EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: JSON.stringify(input)
        }
      ],
      output_config: {
        format: zodOutputFormat(claudeRequirementExtractionResultSchema)
      }
    });

    const claudeResult = response.parsed_output;

    if (!claudeResult) {
      throw new Error(
        "Claude no devolvió un resultado válido de extracción de requisitos"
      );
    }

    const result = convertClaudeResult(claudeResult);

    return {
      result,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: response.model,
      promptVersion: REQUIREMENT_EXTRACTION_PROMPT_VERSION
    };
  }
}
