import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from './db/client';
import { bodyLimit } from "hono/body-limit";
import { authRoutes } from './auth/routes';

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

app.use("/api/auth/*", bodyLimit({
  maxSize: 16 * 1024,
  onError: (c) => c.json({
    error: {
      code: "PAYLOAD_TOO_LARGE",
      message: "La solicitud es demasiado grande.",
    },
  }, 413),
}));

app.route("/api/auth", authRoutes);

app.notFound((c) => c.json({
    error: {
        code: "NOT_FOUND",
        message: "Ruta no encontrada",
    },
}, 404));