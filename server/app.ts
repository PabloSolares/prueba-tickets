import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from './src/db/client';

export const app = new Hono();

app.get("/api/health", async (c) => {
    try {
        await db.execute(sql`SELECT 1`);
        return c.json({data: {status: "ok"}});
    } catch (error) {
        console.error("Fallo la conexión con PostgreSQL", error instanceof Error ? error.name : "Error desconocido");
        return c.json({
            error: {
                code: "DB_UNAVAILABLE",
                message: "La base de datos no esta disponible"
            }
        }, 503)
    }
});

app.notFound((c) => c.json({
    error: {
        code: "NOT_FOUND",
        message: "Ruta no encontrada",
    },
}, 404));