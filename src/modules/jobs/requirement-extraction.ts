import { z } from "zod";

const technologyItemSchema = z.object({
  technology: z.string().min(1)
});

const experienceItemSchema = z.object({
  target: z.object({
    type: z.enum(["technology", "role", "area"]),
    value: z.string().min(1)
  }),
  minimumYears: z.number().nonnegative()
});

const languageItemSchema = z.object({
  language: z.string().min(1),
  minimumLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"])
});

const requirementImportanceSchema = z.enum([
  "required",
  "preferred"
]);

export const extractedRequirementSchema = z.union([
  z.object({
    category: z.literal("technology"),
    type: z.literal("single"),
    importance: requirementImportanceSchema,
    data: technologyItemSchema
  }),
  z.object({
    category: z.literal("technology"),
    type: z.literal("alternative"),
    importance: requirementImportanceSchema,
    data: z.object({
      options: z.array(technologyItemSchema).min(2)
    })
  }),
  z.object({
    category: z.literal("technology"),
    type: z.literal("group"),
    importance: requirementImportanceSchema,
    data: z.object({
      components: z.array(technologyItemSchema).min(2)
    })
  }),

  z.object({
    category: z.literal("experience"),
    type: z.literal("single"),
    importance: requirementImportanceSchema,
    data: experienceItemSchema
  }),
  z.object({
    category: z.literal("experience"),
    type: z.literal("alternative"),
    importance: requirementImportanceSchema,
    data: z.object({
      options: z.array(experienceItemSchema).min(2)
    })
  }),
  z.object({
    category: z.literal("experience"),
    type: z.literal("group"),
    importance: requirementImportanceSchema,
    data: z.object({
      components: z.array(experienceItemSchema).min(2)
    })
  }),

  z.object({
    category: z.literal("language"),
    type: z.literal("single"),
    importance: requirementImportanceSchema,
    data: languageItemSchema
  }),
  z.object({
    category: z.literal("language"),
    type: z.literal("alternative"),
    importance: requirementImportanceSchema,
    data: z.object({
      options: z.array(languageItemSchema).min(2)
    })
  }),

  z.object({
    category: z.literal("language"),
    type: z.literal("group"),
    importance: requirementImportanceSchema,
    data: z.object({
      components: z.array(languageItemSchema).min(2)
    })
  }),

  z.object({
    category: z.literal("other"),
    type: z.literal("single"),
    importance: requirementImportanceSchema,
    data: z.object({
      description: z.string().min(1)
    })
  }),
  z.object({
    category: z.literal("other"),
    type: z.literal("alternative"),
    importance: requirementImportanceSchema,
    data: z.object({
      options: z.array(
        z.object({
          description: z.string().min(1)
        })
      ).min(2)
    })
  }),
  z.object({
    category: z.literal("other"),
    type: z.literal("group"),
    importance: requirementImportanceSchema,
    data: z.object({
      components: z.array(
        z.object({
          description: z.string().min(1)
        })
      ).min(2)
    })
  })
]);

export const requirementExtractionResultSchema = z.object({
  requirements: z.array(extractedRequirementSchema)
});

export type ExtractedRequirement = z.infer<
  typeof extractedRequirementSchema
>;

export type RequirementExtractionResult = z.infer<
  typeof requirementExtractionResultSchema
>;