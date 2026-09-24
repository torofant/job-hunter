import type { Environment } from "../../src/config/env.js";
import { testDatabaseUrl } from "./database.js";

export const testEnvironment: Environment = {
  NODE_ENV: "test",
  DATABASE_URL: testDatabaseUrl,
  API_KEY: "test-api-key",
  PORT: 3000,
  PROCESSING_RECOVERY_TIMEOUT_MS: 50
};
