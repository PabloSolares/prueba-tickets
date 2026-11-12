import { and, asc, count, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { Hono } from "hono";
import { requireSession, type AuthVariables } from "../auth/session";
import { db } from "../db/client";
import { tickets } from "../db/schema";
import { forbidden } from "../http/errors";

const summary = {
    id: tickets.id,
    title: tickets.title,
    status: tickets.status,
    createdAt: tickets.createdAt,
};

export const dashboardRoutes = new Hono<AuthVariables>();

dashboardRoutes.get("/", requireSession, async (c) => {
    if (c.get("actor").role !== "agente") throw forbidden();

    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const [states, priorities, resolution, overdue, recent] = await Promise.all([
        db.select({ status: tickets.status, total: count() })
        .from(tickets).groupBy(tickets.status),
        db.select({ priority: tickets.priority, total: count() })
        .from(tickets).groupBy(tickets.priority),
        db.select({
        hours: sql<string | null>`avg(extract(epoch from (${tickets.resolvedAt} - ${tickets.createdAt})) / 3600.0)`,
        }).from(tickets),
        db.select(summary).from(tickets)
        .where(and(eq(tickets.status, "abierto"), isNull(tickets.assignedTo), lt(tickets.createdAt, cutoff)))
        .orderBy(asc(tickets.createdAt), asc(tickets.id)),
        db.select(summary).from(tickets)
        .orderBy(desc(tickets.createdAt), desc(tickets.id)).limit(5),
    ]);

    const byStatus = { abierto: 0, en_progreso: 0, resuelto: 0, cerrado: 0 };
    const byPriority = { critica: 0, alta: 0, media: 0, baja: 0 };
    for (const row of states) byStatus[row.status] = row.total;
    for (const row of priorities) byPriority[row.priority] = row.total;

    const hours = resolution[0]?.hours;
    return c.json({ data: {
        byStatus, byPriority, averageResolutionHours: hours == null ? null : Number(hours),
        overdue, recent,
    } });
});