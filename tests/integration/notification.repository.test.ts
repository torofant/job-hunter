import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it
} from "vitest";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { createTestDatabase, clearDatabase } from "../helpers/database.js";
import {
    jobAnalyses,
    jobOffers,
    notifications,
    processingRuns
} from "../../src/database/schema/index.js";
import { NotificationRepository } from "../../src/modules/notifications/notification.repository.js";

const connection = createTestDatabase();
const repository = new NotificationRepository(connection.db);

const BATCH_WINDOW_MS = 10_800_000;

type CreateNotificationInput = {
    score?: number | null;
    coverage?: number | null;
    confidenceLevel?: "HIGH" | "MEDIUM" | "LOW" | null;
    createdAt?: Date;
    detectedAt?: Date;
};

async function createNotification(
    input: CreateNotificationInput = {}
) {
    const id = randomUUID();
    const jobOfferId = randomUUID();
    const jobAnalysisId = randomUUID();
    const processingRunId = randomUUID();

    const createdAt = input.createdAt ?? new Date("2026-10-26T08:00:00Z");
    const detectedAt = input.detectedAt ?? createdAt;

    await connection.db.insert(processingRuns).values({
        id: processingRunId,
        status: "COMPLETED",
        attempt: 1
    });

    await connection.db.insert(jobOffers).values({
        id: jobOfferId,
        source: "test",
        sourceJobId: `job-${id}`,
        normalizedUrl: `https://example.com/jobs/${id}`,
        title: `Developer ${id}`,
        company: "Example",
        jobFamily: "WEB",
        role: "WEB_DEVELOPER",
        country: "España",
        city: "Valencia",
        modality: "REMOTE",
        distanceKm: null,
        contract: "PERMANENT",
        employmentType: "EMPLOYEE",
        workingHours: "FULL_TIME"
    });

    await connection.db.insert(jobAnalyses).values({
        id: jobAnalysisId,
        jobOfferId,
        processingRunId,
        version: 1,
        matchingSummary: null,
        score: input.score ?? 80,
        coverage: input.coverage ?? 80,
        confidenceLevel: input.confidenceLevel ?? "MEDIUM",
        requirementExtractionStatus: "COMPLETED",
        createdAt
    });

    await connection.db.insert(notifications).values({
        id,
        jobOfferId,
        jobAnalysisId,
        status: "PENDING",
        message: `Oferta ${id}`,
        detectedAt,
        createdAt
    });

    return { id, jobOfferId, jobAnalysisId };
}

describe("NotificationRepository", () => {
    beforeAll(async () => {
        await connection.db.execute(
            (await import("drizzle-orm")).sql`SELECT 1`
        );
    });

    beforeEach(async () => {
        await clearDatabase(connection);
    });

    afterAll(async () => {
        await connection.close();
    });

    it("no reserva menos de cinco notificaciones antes del vencimiento", async () => {
        const createdAt = new Date("2026-10-26T08:00:00Z");

        await createNotification({ createdAt });
        await createNotification({ createdAt });
        await createNotification({ createdAt });

        const result = await repository.reserveBatch(
            BATCH_WINDOW_MS,
            new Date("2026-10-26T09:00:00Z")
        );

        expect(result).toBeNull();

        const pending = await connection.db
            .select()
            .from(notifications)
            .where(eq(notifications.status, "PENDING"));

        expect(pending).toHaveLength(3);
    });

    it("reserva cinco notificaciones cuando se alcanza el límite", async () => {
        for (let i = 0; i < 6; i++) {
            await createNotification();
        }

        const result = await repository.reserveBatch(
            BATCH_WINDOW_MS,
            new Date("2026-10-26T09:00:00Z")
        );

        expect(result).toHaveLength(5);

        const sending = await connection.db
            .select()
            .from(notifications)
            .where(eq(notifications.status, "SENDING"));

        const pending = await connection.db
            .select()
            .from(notifications)
            .where(eq(notifications.status, "PENDING"));

        expect(sending).toHaveLength(5);
        expect(pending).toHaveLength(1);
    });

    it("reserva un lote incompleto cuando vence la ventana", async () => {
        const createdAt = new Date("2026-10-26T08:00:00Z");

        await createNotification({ createdAt });
        await createNotification({ createdAt });

        const result = await repository.reserveBatch(
            BATCH_WINDOW_MS,
            new Date("2026-10-26T11:00:00Z")
        );

        expect(result).toHaveLength(2);
        expect(result?.every((item) => item.message.startsWith("Oferta "))).toBe(
            true
        );
    });

    it("ordena por score y reserva como máximo cinco", async () => {
        for (const score of [88, 92, 95, 93, 94, 70]) {
            await createNotification({
                score,
                coverage: 80,
                confidenceLevel: "MEDIUM"
            });
        }

        const result = await repository.reserveBatch(
            BATCH_WINDOW_MS,
            new Date("2026-10-26T11:00:00Z")
        );

        expect(result).toHaveLength(5);
        const scores = result?.map((item) => item.score) ?? [];

        expect(scores.slice(0, 4).sort((a, b) => (b ?? 0) - (a ?? 0))).toEqual([
            95, 94, 93, 92
        ]);

        expect(scores[4]).toBe(88);
    });

    it("actualiza los estados SENT, FAILED y UNKNOWN", async () => {
        const sent = await createNotification();
        const failed = await createNotification();
        const unknown = await createNotification();

        const ids = [sent.id, failed.id, unknown.id];

        await connection.db
            .update(notifications)
            .set({ status: "SENDING" });

        await repository.markSent([sent.id]);
        await repository.markFailed([failed.id], "Telegram rechazó la petición");
        await repository.markUnknown([unknown.id], "Resultado ambiguo");

        const rows = await connection.db
            .select()
            .from(notifications);

        expect(rows.find((row) => row.id === sent.id)).toMatchObject({
            status: "SENT",
            lastError: null
        });

        expect(rows.find((row) => row.id === failed.id)).toMatchObject({
            status: "FAILED",
            lastError: "Telegram rechazó la petición"
        });

        expect(rows.find((row) => row.id === unknown.id)).toMatchObject({
            status: "UNKNOWN",
            lastError: "Resultado ambiguo"
        });

        expect(ids).toHaveLength(3);
    });

    it("no reserva dos veces las mismas notificaciones concurrentemente", async () => {
        for (let i = 0; i < 10; i++) {
            await createNotification();
        }

        const secondRepository = new NotificationRepository(connection.db);

        const [firstBatch, secondBatch] = await Promise.all([
            repository.reserveBatch(
                BATCH_WINDOW_MS,
                new Date("2026-10-26T11:00:00Z")
            ),
            secondRepository.reserveBatch(
                BATCH_WINDOW_MS,
                new Date("2026-10-26T11:00:00Z")
            )
        ]);

        expect(firstBatch).toHaveLength(5);
        expect(secondBatch).toHaveLength(5);

        const firstIds = new Set(firstBatch!.map((item) => item.id));
        const secondIds = new Set(secondBatch!.map((item) => item.id));

        expect([...firstIds].some((id) => secondIds.has(id))).toBe(false);
    });

    it("convierte envíos SENDING abandonados en UNKNOWN", async () => {
        const first = await createNotification();
        const second = await createNotification();

        await connection.db
            .update(notifications)
            .set({ status: "SENDING" });

        const count = await repository.markAbandonedSendingUnknown();

        expect(count).toBe(2);

        const rows = await connection.db
            .select()
            .from(notifications);

        expect(rows.every((row) => row.status === "UNKNOWN")).toBe(true);
        expect(rows.find((row) => row.id === first.id)?.lastError).toContain(
            "Proceso interrumpido"
        );
        expect(rows.find((row) => row.id === second.id)?.lastError).toContain(
            "Proceso interrumpido"
        );
    });
});
