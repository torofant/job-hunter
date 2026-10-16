import { z } from "zod";

const importanceSchema = z.enum(["required", "preferred"]);

const requirementBaseSchema = z.object({
  importance: importanceSchema
});

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

export const requirementSchema = z.union([
  requirementBaseSchema.extend({
    category: z.literal("technology"),
    type: z.literal("single"),
    data: technologyItemSchema
  }),
  requirementBaseSchema.extend({
    category: z.literal("technology"),
    type: z.literal("alternative"),
    data: z.object({
      options: z.array(technologyItemSchema).min(2)
    })
  }),
  requirementBaseSchema.extend({
    category: z.literal("technology"),
    type: z.literal("group"),
    data: z.object({
      components: z.array(technologyItemSchema).min(2)
    })
  }),

  requirementBaseSchema.extend({
    category: z.literal("experience"),
    type: z.literal("single"),
    data: experienceItemSchema
  }),
  requirementBaseSchema.extend({
    category: z.literal("experience"),
    type: z.literal("alternative"),
    data: z.object({
      options: z.array(experienceItemSchema).min(2)
    })
  }),
  requirementBaseSchema.extend({
    category: z.literal("experience"),
    type: z.literal("group"),
    data: z.object({
      components: z.array(experienceItemSchema).min(2)
    })
  }),

  requirementBaseSchema.extend({
    category: z.literal("language"),
    type: z.literal("single"),
    data: languageItemSchema
  }),
  requirementBaseSchema.extend({
    category: z.literal("language"),
    type: z.literal("alternative"),
    data: z.object({
      options: z.array(languageItemSchema).min(2)
    })
  }),
  requirementBaseSchema.extend({
    category: z.literal("language"),
    type: z.literal("group"),
    data: z.object({
      components: z.array(languageItemSchema).min(2)
    })
  })
]);

export const requirementEntitySchema = z.union([
  requirementSchema.options[0].extend({
    id: z.string().uuid()
  }),
  requirementSchema.options[1].extend({
    id: z.string().uuid()
  }),
  requirementSchema.options[2].extend({
    id: z.string().uuid()
  }),
  requirementSchema.options[3].extend({
    id: z.string().uuid()
  }),
  requirementSchema.options[4].extend({
    id: z.string().uuid()
  }),
  requirementSchema.options[5].extend({
    id: z.string().uuid()
  }),
  requirementSchema.options[6].extend({
    id: z.string().uuid()
  }),
  requirementSchema.options[7].extend({
    id: z.string().uuid()
  }),
  requirementSchema.options[8].extend({
    id: z.string().uuid()
  })
]);

export type Requirement = z.infer<typeof requirementEntitySchema>;