import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  PROCESSING_RECOVERY_TIMEOUT_MS: z.coerce.number().int().positive(),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_CHAT_ID: z.string().min(1).optional(),
  TELEGRAM_BATCH_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(10_800_000)
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(values = process.env): Environment {
  return environmentSchema.parse(values);
}
