
import {
    and,
    asc,
    eq,
    inArray,
    sql
} from "drizzle-orm";

import type { Database } from "../../database/client.js";
import {
    jobAnalyses,
    notifications
} from "../../database/schema/index.js";
import { orderNotificationsByPriority } from "./notification-priority.js";

export type ReservedNotification = {
    id: string;
    jobOfferId: string;
    jobAnalysisId: string;
    message: string;
    detectedAt: Date;
    createdAt: Date;
    score: number | null;
    coverage: number | null;
    confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | null;
};

export class NotificationRepository {
    constructor(private readonly db: Database) { }

    /**
     * Reserva hasta cinco notificaciones.
     * Devuelve null si todavía no corresponde enviar el lote.
     *
     * El bloqueo asesor de PostgreSQL coordina las reservas entre
     * instancias de este repositorio. La transacción termina antes
     * de que el llamador contacte con Telegram.
     */
    async reserveBatch(
        batchWindowMs: number,
        now = new Date()
    ): Promise<ReservedNotification[] | null> {
        if (!Number.isInteger(batchWindowMs) || batchWindowMs <= 0) {
            throw new Error("batchWindowMs debe ser un entero positivo");
        }

        return this.db.transaction(async (transaction) => {
            // Bloqueo transaccional compartido por las instancias del servicio.
            await transaction.execute(
                sql`SELECT pg_advisory_xact_lock(19031, 1)`
            );

            const pending = await transaction
                .select({
                    notification: notifications,
                    score: jobAnalyses.score,
                    coverage: jobAnalyses.coverage,
                    confidenceLevel: jobAnalyses.confidenceLevel
                })
                .from(notifications)
                .innerJoin(
                    jobAnalyses,
                    eq(notifications.jobAnalysisId, jobAnalyses.id)
                )
                .where(eq(notifications.status, "PENDING"))
                .orderBy(asc(notifications.createdAt))
                .for("update", {
                    of: notifications,
                    skipLocked: true
                });

            if (pending.length === 0) {
                return null;
            }

            const oldestCreatedAt = pending.reduce(
                (oldest, row) =>
                    row.notification.createdAt.getTime() < oldest.getTime()
                        ? row.notification.createdAt
                        : oldest,
                pending[0].notification.createdAt
            );

            const batchWindowExpired =
                now.getTime() - oldestCreatedAt.getTime() >= batchWindowMs;

            if (pending.length < 5 && !batchWindowExpired) {
                return null;
            }

            const priorityItems = pending.map((row) => ({
                id: row.notification.id,
                score: row.score,
                coverage: row.coverage,
                confidence: row.confidenceLevel,
                detectedAt: row.notification.detectedAt
            }));

            const ordered = orderNotificationsByPriority(priorityItems);
            const selectedIds = ordered.slice(0, 5).map((item) => item.id);

            const selectedIdSet = new Set(selectedIds);
            const selectedRows = pending.filter((row) =>
                selectedIdSet.has(row.notification.id)
            );

            const reservedRows = await transaction
                .update(notifications)
                .set({ status: "SENDING" })
                .where(
                    and(
                        eq(notifications.status, "PENDING"),
                        inArray(notifications.id, selectedIds)
                    )
                )
                .returning({ id: notifications.id });

            if (reservedRows.length !== selectedIds.length) {
                throw new Error(
                    "La reserva de notificaciones no coincide con el lote seleccionado"
                );
            }

            const rowsById = new Map(
                selectedRows.map((row) => [row.notification.id, row])
            );

            return ordered
                .filter((item) => selectedIdSet.has(item.id))
                .map((item) => {
                    const row = rowsById.get(item.id);

                    if (!row) {
                        throw new Error(
                            `No se encuentra la notificación reservada ${item.id}`
                        );
                    }

                    return {
                        id: row.notification.id,
                        jobOfferId: row.notification.jobOfferId,
                        jobAnalysisId: row.notification.jobAnalysisId,
                        message: row.notification.message,
                        detectedAt: row.notification.detectedAt,
                        createdAt: row.notification.createdAt,
                        score: row.score,
                        coverage: row.coverage,
                        confidenceLevel: row.confidenceLevel
                    };
                });
        });
    }

    async markSent(
        ids: readonly string[],
        sentAt = new Date()
    ): Promise<void> {
        if (ids.length === 0) return;

        await this.db
            .update(notifications)
            .set({
                status: "SENT",
                sentAt,
                lastError: null
            })
            .where(
                and(
                    eq(notifications.status, "SENDING"),
                    inArray(notifications.id, [...ids])
                )
            );
    }

    async markFailed(
        ids: readonly string[],
        reason: string
    ): Promise<void> {
        if (ids.length === 0) return;

        await this.db
            .update(notifications)
            .set({
                status: "FAILED",
                lastError: reason
            })
            .where(
                and(
                    eq(notifications.status, "SENDING"),
                    inArray(notifications.id, [...ids])
                )
            );
    }

    async markUnknown(
        ids: readonly string[],
        reason: string
    ): Promise<void> {
        if (ids.length === 0) return;

        await this.db
            .update(notifications)
            .set({
                status: "UNKNOWN",
                lastError: reason
            })
            .where(
                and(
                    eq(notifications.status, "SENDING"),
                    inArray(notifications.id, [...ids])
                )
            );
    }

    /**
     * Al arrancar, cualquier envío que siga en SENDING se considera
     * ambiguo: no se reenvía automáticamente para evitar duplicados.
     */
    async markAbandonedSendingUnknown(): Promise<number> {
        const abandoned = await this.db
            .update(notifications)
            .set({
                status: "UNKNOWN",
                lastError:
                    "Proceso interrumpido mientras el envío estaba en curso; resultado desconocido"
            })
            .where(eq(notifications.status, "SENDING"))
            .returning({ id: notifications.id });

        return abandoned.length;
    }
}
