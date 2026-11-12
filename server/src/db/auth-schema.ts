import {
    boolean,
    index,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
} from "drizzle-orm/pg-core";

const timestampWithZone = (name: string) =>
    timestamp(name, { withTimezone: true });

export const roles = ["empleado", "agente"] as const;
export const userRole = pgEnum("user_role", roles);

export const user = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    role: userRole("role").default("empleado").notNull(),
    createdAt: timestampWithZone("created_at").defaultNow().notNull(),
    updatedAt: timestampWithZone("updated_at").defaultNow().notNull(),
});

export const session = pgTable("session", {
    id: text("id").primaryKey(),
    expiresAt: timestampWithZone("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestampWithZone("created_at").defaultNow().notNull(),
    updatedAt: timestampWithZone("updated_at").defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
}, (table) => [
    index("session_user_idx").on(table.userId),
]);

export const account = pgTable("account", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestampWithZone("access_token_expires_at"),
    refreshTokenExpiresAt: timestampWithZone("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestampWithZone("created_at").defaultNow().notNull(),
    updatedAt: timestampWithZone("updated_at").defaultNow().notNull(),
}, (table) => [
    index("account_user_idx").on(table.userId),
    uniqueIndex("account_provider_identifier_idx")
        .on(table.providerId, table.accountId),
]);

export const verification = pgTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestampWithZone("expires_at").notNull(),
    createdAt: timestampWithZone("created_at").defaultNow().notNull(),
    updatedAt: timestampWithZone("updated_at").defaultNow().notNull(),
}, (table) => [
    index("verification_identifier_idx").on(table.identifier),
]);