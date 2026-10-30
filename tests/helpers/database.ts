import { sql } from "drizzle-orm";

import { createDatabase } from "../../src/database/client.js";

function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;

  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL debe estar configurada para ejecutar tests de integración"
    );
  }

  return url;
}

export function createTestDatabase() {
  return createDatabase(getTestDatabaseUrl());
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
