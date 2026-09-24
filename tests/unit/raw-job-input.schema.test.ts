import { describe, expect, it } from "vitest";

import { rawJobInputSchema } from "../../src/api/schemas/raw-job-input.schema.js";

const validInput = {
  source: "linkedin",
  title: "Developer",
  company: "Example",
  url: "https://example.com/jobs/1",
  detected_at: "2026-09-24T10:00:00Z"
};

describe("rawJobInputSchema", () => {
  it("acepta metadatos nulos", () => {
    const result = rawJobInputSchema.safeParse({ ...validInput, raw_metadata: null });

    expect(result.success).toBe(true);
  });

  it("rechaza propiedades desconocidas", () => {
    const result = rawJobInputSchema.safeParse({ ...validInput, unexpected: true });

    expect(result.success).toBe(false);
  });

  it("rechaza una URL inválida", () => {
    const result = rawJobInputSchema.safeParse({ ...validInput, url: "not-a-url" });

    expect(result.success).toBe(false);
  });

  it("rechaza detected_at inválido", () => {
    const result = rawJobInputSchema.safeParse({ ...validInput, detected_at: "yesterday" });

    expect(result.success).toBe(false);
  });

  it("rechaza source vacío", () => {
    const result = rawJobInputSchema.safeParse({ ...validInput, source: "" });

    expect(result.success).toBe(false);
  });

  it("rechaza title vacío", () => {
    const result = rawJobInputSchema.safeParse({ ...validInput, title: "" });

    expect(result.success).toBe(false);
  });

  it("rechaza company vacío", () => {
    const result = rawJobInputSchema.safeParse({ ...validInput, company: "" });

    expect(result.success).toBe(false);
  });

  it("rechaza raw_metadata que no es un objeto", () => {
    const result = rawJobInputSchema.safeParse({ ...validInput, raw_metadata: "invalid" });

    expect(result.success).toBe(false);
  });
});
