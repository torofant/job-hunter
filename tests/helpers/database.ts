import { sql } from "drizzle-orm";

import { createDatabase } from "../../src/database/client.js";

export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://job_hunter:job_hunter@localhost:5432/job_hunter";

export function createTestDatabase() {
  return createDatabase(testDatabaseUrl);
}

export async function clearDatabase(connection: ReturnType<typeof createDatabase>): Promise<void> {
  await connection.db.execute(sql`
  TRUNCATE TABLE
    job_detections,
    job_offers,
    processing_runs,
    raw_job_inputs
  CASCADE
`);
}
