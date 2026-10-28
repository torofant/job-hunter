
import { describe, expect, it } from "vitest";

import {
  orderNotificationsByPriority,
  type NotificationPriorityItem
} from "../../src/modules/notifications/notification-priority.js";

function item(
  id: string,
  score: number | null,
  coverage: number | null = 80,
  confidence: NotificationPriorityItem["confidence"] = "MEDIUM",
  detectedAt = new Date("2026-01-01T10:00:00Z")
): NotificationPriorityItem {
  return { id, score, coverage, confidence, detectedAt };
}

describe("orderNotificationsByPriority", () => {
  it("agrupa los Scores situados hasta tres puntos por debajo del máximo", () => {
    const result = orderNotificationsByPriority([
      item("89", 89),
      item("91", 91),
      item("93", 93),
      item("95", 95)
    ]);

    expect(result.map((entry) => entry.id)).toEqual([
      "93",
      "95",
      "89",
      "91"
    ]);
  });

  it("ordena por Coverage dentro del grupo", () => {
    const result = orderNotificationsByPriority([
      item("high-score", 95, 70),
      item("high-coverage", 93, 100)
    ]);

    expect(result.map((entry) => entry.id)).toEqual([
      "high-coverage",
      "high-score"
    ]);
  });

  it("desempata por Confidence y después por fecha de detección", () => {
    const result = orderNotificationsByPriority([
      item("older-high", 90, 80, "HIGH", new Date("2026-01-01T09:00:00Z")),
      item("newer-high", 90, 80, "HIGH", new Date("2026-01-01T11:00:00Z")),
      item("medium", 90, 80, "MEDIUM", new Date("2026-01-01T12:00:00Z"))
    ]);

    expect(result.map((entry) => entry.id)).toEqual([
      "newer-high",
      "older-high",
      "medium"
    ]);
  });

  it("usa el ID como último desempate estable", () => {
    const result = orderNotificationsByPriority([
      item("b", 90),
      item("a", 90)
    ]);

    expect(result.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("sitúa los valores nulos por debajo de los valores conocidos", () => {
    const result = orderNotificationsByPriority([
      item("unknown", null, null, null),
      item("known", 80, 50, "LOW")
    ]);

    expect(result.map((entry) => entry.id)).toEqual([
      "known",
      "unknown"
    ]);
  });
});
