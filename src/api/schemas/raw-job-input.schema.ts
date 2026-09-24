import { z } from "zod";

export const rawJobInputSchema = z
  .object({
    source: z.string().min(1),
    source_job_id: z.string().min(1).optional(),
    title: z.string().min(1),
    company: z.string().min(1),
    url: z.string().url(),
    description: z.string().optional(),
    location: z.string().optional(),
    detected_at: z.string().datetime({ offset: true }).transform((value) => new Date(value)),
    raw_metadata: z.record(z.string(), z.unknown()).nullable().optional()
  })
  .strict();

export type RawJobInput = z.infer<typeof rawJobInputSchema>;
