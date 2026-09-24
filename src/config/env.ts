import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  PROCESSING_RECOVERY_TIMEOUT_MS: z.coerce.number().int().positive()
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(values = process.env): Environment {
  return environmentSchema.parse(values);
}
