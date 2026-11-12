import { sql } from "drizzle-orm";
import {
    check,
    index,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

export const categories = [
    "hardware",
    "software",
    "red",
    "accesos",
    "otro",
] as const;

export const priorities = ["critica", "alta", "media", "baja"] as const;

export const statuses = [
    "abierto",
    "en_progreso",
    "resuelto",
    "cerrado",
] as const;

export const ticketCategory = pgEnum("ticket_category", categories);
export const ticketPriority = pgEnum("ticket_priority", priorities);
export const ticketStatus = pgEnum("ticket_status", statuses);

const timestampWithZone = (name: string) =>
    timestamp(name, { withTimezone: true });

export const tickets = pgTable("tickets", {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: ticketCategory("category").notNull(),
    priority: ticketPriority("priority").notNull(),
    status: ticketStatus("status").default("abierto").notNull(),
    createdBy: text("created_by").notNull().references(() => user.id),
    assignedTo: text("assigned_to").references(() => user.id),
    createdAt: timestampWithZone("created_at").defaultNow().notNull(),
    updatedAt: timestampWithZone("updated_at").defaultNow().notNull(),
    resolvedAt: timestampWithZone("resolved_at"),
}, (table) => [
    index("tickets_created_at_idx").on(table.createdAt, table.id),
    index("tickets_owner_created_idx").on(table.createdBy, table.createdAt),
    check(
        "ticket_resolution_matches_status",
        sql`(${table.status} in ('resuelto', 'cerrado')) =
            (${table.resolvedAt} is not null)`,
    ),
]);

export const comments = pgTable("comments", {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id")
        .notNull()
        .references(() => tickets.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id),
    content: text("content").notNull(),
    createdAt: timestampWithZone("created_at").defaultNow().notNull(),
}, (table) => [
    index("comments_ticket_date_idx").on(table.ticketId, table.createdAt),
]);

export const statusHistory = pgTable("ticket_status_history", {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id")
        .notNull()
        .references(() => tickets.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id),
    fromStatus: ticketStatus("from_status").notNull(),
    toStatus: ticketStatus("to_status").notNull(),
    createdAt: timestampWithZone("created_at").defaultNow().notNull(),
}, (table) => [
    index("history_ticket_date_idx").on(table.ticketId, table.createdAt),
]);