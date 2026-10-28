
export type NotificationPriorityItem = {
  id: string;
  score: number | null;
  coverage: number | null;
  confidence: "HIGH" | "MEDIUM" | "LOW" | null;
  detectedAt: Date;
};

const confidenceRank: Record<
  "HIGH" | "MEDIUM" | "LOW",
  number
> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

function compareWithinGroup(
  a: NotificationPriorityItem,
  b: NotificationPriorityItem
): number {
  const coverageA = a.coverage ?? Number.NEGATIVE_INFINITY;
  const coverageB = b.coverage ?? Number.NEGATIVE_INFINITY;

  if (coverageA !== coverageB) {
    return coverageB - coverageA;
  }

  const confidenceA = a.confidence
    ? confidenceRank[a.confidence]
    : 0;
  const confidenceB = b.confidence
    ? confidenceRank[b.confidence]
    : 0;

  if (confidenceA !== confidenceB) {
    return confidenceB - confidenceA;
  }

  const detectedDifference =
    b.detectedAt.getTime() - a.detectedAt.getTime();

  if (detectedDifference !== 0) {
    return detectedDifference;
  }

  return a.id.localeCompare(b.id);
}

export function orderNotificationsByPriority<
  T extends NotificationPriorityItem
>(items: readonly T[]): T[] {
  const remaining = [...items];
  const ordered: T[] = [];

  while (remaining.length > 0) {
    const maximumScore = Math.max(
      ...remaining.map(
        (item) => item.score ?? Number.NEGATIVE_INFINITY
      )
    );

    const group = remaining.filter((item) => {
      if (item.score === null) {
        return maximumScore === Number.NEGATIVE_INFINITY;
      }

      return item.score >= maximumScore - 3;
    });

    group.sort(compareWithinGroup);
    ordered.push(...group);

    const groupIds = new Set(group.map((item) => item.id));

    for (let i = remaining.length - 1; i >= 0; i--) {
      if (groupIds.has(remaining[i].id)) {
        remaining.splice(i, 1);
      }
    }
  }

  return ordered;
}
