import { describe, expect, it } from "vitest";

import { loadEnvironment } from "../../src/config/env.js";

describe("loadEnvironment", () => {
  it("acepta la configuración requerida", () => {
    const environment = loadEnvironment({
      DATABASE_URL: "postgresql://user:password@localhost:5432/jobs",
      API_KEY: "secret",
      PROCESSING_RECOVERY_TIMEOUT_MS: "60000"
    });

    expect(environment.PORT).toBe(3000);
    expect(environment.NODE_ENV).toBe("development");
  });

  it("rechaza una clave de API vacía", () => {
    expect(() =>
      loadEnvironment({
        DATABASE_URL: "postgresql://user:password@localhost:5432/jobs",
        API_KEY: "",
        PROCESSING_RECOVERY_TIMEOUT_MS: "60000"
      })
    ).toThrow();
  });
});
