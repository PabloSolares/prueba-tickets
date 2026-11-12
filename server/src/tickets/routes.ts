import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  isNull,
  or,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import { requireSession, type AuthVariables } from "../auth/session";
import { db } from "../db/client";
import { comments, statuses, statusHistory, tickets, user } from "../db/schema";
import { ApiError, forbidden, notFound, parse, readJson } from "../http/errors";
import {
  commentInput,
  listInput,
  statusInput,
  ticketEdit,
  ticketId,
  ticketInput,
} from "./validation";

type Actor = AuthVariables["Variables"]["actor"];

type TicketStatus = (typeof statuses)[number];

const nextStatus: Record<TicketStatus, TicketStatus | null> = {
  abierto: "en_progreso",
  en_progreso: "resuelto",
  resuelto: "cerrado",
  cerrado: null,
};

function ticketVisibility(actor: Actor){
    return actor.role === "empleado"
        ? eq(tickets.createdBy, actor.id)
        : undefined
}

function visibleTicketById(id: string, actor: Actor) {
    return and(eq(tickets.id, id), ticketVisibility(actor));
}

async function findVisibleTicket(id: string, actor: Actor){
    const [ticket] = await db.select().from(tickets)
        .where(visibleTicketById(id, actor));
    if(!ticket) throw notFound();

    return ticket;
}


export const ticketRoutes = new Hono<AuthVariables>();
ticketRoutes.use("*", requireSession);
ticketRoutes.post("/", async (context) => {
    const actor = context.get("actor");
    if(actor.role !== "empleado") throw forbidden();

    const input = await readJson(context, ticketInput);
    const [ticket] = await db.insert(tickets)
        .values({ ...input, createdBy: actor.id })
        .returning();
    
    return context.json({data: ticket}, 201)
})

ticketRoutes.get("/", async (context) => {
    const actor = context.get("actor");
    const filters = parse(listInput, context.req.query());

    const search = filters.q
        ? `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`
        : undefined;

    const conditions = and(
        ticketVisibility(actor),
        filters.status ? eq(tickets.status, filters.status) : undefined,
        filters.priority ? eq(tickets.priority, filters.priority) : undefined,
        filters.category ? eq(tickets.category, filters.category) : undefined,
        search
        ? or(ilike(tickets.title, search), ilike(tickets.description, search))
        : undefined,
    );

    const { page, pageSize } = filters;

    const [items, totals] = await Promise.all([
        db.select()
            .from(tickets)
            .where(conditions)
            .orderBy(desc(tickets.createdAt), desc(tickets.id))
            .limit(pageSize)
            .offset((page - 1) * pageSize),
        db.select({ total: count() })
            .from(tickets)
            .where(conditions),
    ]);

    return context.json({
        data: {items, total: totals[0]?.total ?? 0, page, pageSize},
    });
});

ticketRoutes.get("/:id", async (context) => {
    const actor = context.get("actor");
    const id = parse(ticketId, context.req.param("id"));
    const assignee = alias(user, "assignee");

    const [ticket] = await db.select({
        ...getTableColumns(tickets),
        creatorName: user.name,
        assigneeName: assignee.name,
    }).from(tickets)
        .innerJoin(user, eq(tickets.createdBy, user.id))
        .leftJoin(assignee, eq(tickets.assignedTo, assignee.id))
        .where(visibleTicketById(id, actor));

    if (!ticket) throw notFound();

    const [messages, history] = await Promise.all([
        db.select({
        id: comments.id,
        author: user.name,
        content: comments.content,
        createdAt: comments.createdAt,
        }).from(comments)
        .innerJoin(user, eq(comments.userId, user.id))
        .where(eq(comments.ticketId, id))
        .orderBy(asc(comments.createdAt), asc(comments.id)),
        db.select({
        id: statusHistory.id,
        author: user.name,
        fromStatus: statusHistory.fromStatus,
        toStatus: statusHistory.toStatus,
        createdAt: statusHistory.createdAt,
        }).from(statusHistory)
        .innerJoin(user, eq(statusHistory.userId, user.id))
        .where(eq(statusHistory.ticketId, id))
        .orderBy(asc(statusHistory.createdAt), asc(statusHistory.id)),
    ]);

    return context.json({ data: { ...ticket, comments: messages, history } });
});

ticketRoutes.patch("/:id", async (context) => {
    const actor = context.get("actor");
    const id = parse(ticketId, context.req.param("id"));
    const ticket = await findVisibleTicket(id, actor);

    if (actor.role !== "empleado" || ticket.createdBy !== actor.id) {
        throw forbidden();
    }

    const changes = await readJson(context, ticketEdit);
    const [updatedTicket] = await db.update(tickets)
        .set({ ...changes, updatedAt: new Date() })
        .where(and(
        eq(tickets.id, id),
        eq(tickets.createdBy, actor.id),
        eq(tickets.status, "abierto"),
        ))
        .returning();

    if (!updatedTicket) {
        throw new ApiError(409, "CONFLICT", "Solo puedes editar un ticket abierto.");
    }

    return context.json({ data: updatedTicket });
});

ticketRoutes.post("/:id/assign", async (context) => {
    const actor = context.get("actor");
    const id = parse(ticketId, context.req.param("id"));

    if (actor.role !== "agente") throw forbidden();
    await findVisibleTicket(id, actor);

    const [assignedTicket] = await db.update(tickets)
        .set({ assignedTo: actor.id, updatedAt: new Date() })
        .where(and(
        eq(tickets.id, id),
        eq(tickets.status, "abierto"),
        isNull(tickets.assignedTo),
        ))
        .returning();

    if (!assignedTicket) {
        throw new ApiError(409, "CONFLICT", "El ticket ya está asignado o dejó de estar abierto.");
    }

    return context.json({ data: assignedTicket });
});

ticketRoutes.patch("/:id/status", async (context) => {
    const actor = context.get("actor");
    const id = parse(ticketId, context.req.param("id"));
    const ticket = await findVisibleTicket(id, actor);

    if (actor.role !== "agente" || ticket.assignedTo !== actor.id) {
        throw forbidden();
    }

    const { status } = await readJson(context, statusInput);

    if (nextStatus[ticket.status] !== status) {
        throw new ApiError(409, "CONFLICT", "Solo puedes avanzar al siguiente estado.");
    }

    const changedAt = new Date();

    const updatedTicket = await db.transaction(async (transaction) => {
        const [updated] = await transaction.update(tickets)
        .set({
            status,
            updatedAt: changedAt,
            ...(status === "resuelto" ? { resolvedAt: changedAt } : {}),
        })
        .where(and(
            eq(tickets.id, id),
            eq(tickets.assignedTo, actor.id),
            eq(tickets.status, ticket.status),
        ))
        .returning();

        if (!updated) {
        throw new ApiError(409, "CONFLICT", "El ticket cambió. Vuelve a consultarlo.");
        }

        await transaction.insert(statusHistory).values({
        ticketId: id,
        userId: actor.id,
        fromStatus: ticket.status,
        toStatus: status,
        createdAt: changedAt,
        });

        return updated;
    });

    return context.json({ data: updatedTicket });
});

ticketRoutes.post("/:id/comments", async (context) => {
    const actor = context.get("actor");
    const id = parse(ticketId, context.req.param("id"));
    const ticket = await findVisibleTicket(id, actor);

    if (actor.id !== ticket.createdBy && actor.id !== ticket.assignedTo) {
        throw forbidden();
    }

    const { content } = await readJson(context, commentInput);

    const [comment] = await db.insert(comments)
        .values({ ticketId: id, userId: actor.id, content })
        .returning();

    return context.json({ data: comment }, 201);
});
