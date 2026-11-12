import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const {
    POSTGRES_HOST,
    POSTGRES_USER,
    POSTGRES_DB,
    POSTGRES_PASSWORD
}  = process.env;


if (!POSTGRES_HOST || !POSTGRES_USER || !POSTGRES_DB || !POSTGRES_PASSWORD) {
    throw new Error("Falta la configuración de PostgreSQL.");
}

export const client = postgres({
    host: POSTGRES_HOST,
    port: 5432,
    username: POSTGRES_USER,
    database: POSTGRES_DB,
    password: POSTGRES_PASSWORD,
    max: 10,
    connect_timeout: 5,
});

export const db = drizzle(client, { schema });