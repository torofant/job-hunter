import { describe, expect, it } from "vitest";

import { loadEnvironment } from "../../src/config/env.js";

describe("loadEnvironment", () => {
  it("acepta la configuración requerida", () => {
    const environment = loadEnvironment({
      DATABASE_URL: "postgresql://user:password@localhost:5432/jobs",
      API_KEY: "secret",
      ANTHROPIC_API_KEY: "test-anthropic-key",
      PROCESSING_RECOVERY_TIMEOUT_MS: "60000"
    });

    expect(environment.PORT).toBe(3000);
    expect(environment.NODE_ENV).toBe("development");
    expect(environment.TELEGRAM_BATCH_WINDOW_MS).toBe(10_800_000);
    expect(environment.TELEGRAM_BOT_TOKEN).toBeUndefined();
    expect(environment.TELEGRAM_CHAT_ID).toBeUndefined();
  });

  it("rechaza una clave de API vacía", () => {
    expect(() =>
      loadEnvironment({
        DATABASE_URL: "postgresql://user:password@localhost:5432/jobs",
        API_KEY: "",
        ANTHROPIC_API_KEY: "test-anthropic-key",
        PROCESSING_RECOVERY_TIMEOUT_MS: "60000"
      })
    ).toThrow();
  });
});
